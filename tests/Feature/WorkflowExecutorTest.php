<?php

namespace Tests\Feature;

use App\Jobs\ExecuteStepJob;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Workflow;
use App\Models\WorkflowRun;
use App\Models\WorkflowVersion;
use App\Models\StepRun;
use App\WorkflowEngine\WorkflowExecutor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WorkflowExecutorTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Workflow $workflow;
    private WorkflowVersion $version;
    private WorkflowExecutor $executor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('db:seed', ['--class' => 'RolesAndPermissionsSeeder']);

        $this->tenant = Tenant::create([
            'name' => 'Demo Org',
            'slug' => 'demo',
            'is_active' => true,
            'settings' => [],
        ]);

        $this->user = User::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Admin User',
            'email' => 'admin@demo.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_active' => true,
        ]);
        $this->user->assignRole('admin');

        // Setup a Workflow with a DAG:
        // Batch 0: http_1 and delay_1 (Parallel)
        // Batch 1: notify_1 (Depends on both http_1 and delay_1)
        $definition = [
            'nodes' => [
                [
                    'id' => 'http_1',
                    'type' => 'http',
                    'data' => [
                        'url' => 'https://api.example.com/payment',
                        'method' => 'POST',
                        'timeout' => 10,
                        'max_retries' => 2,
                        'retry_delay' => 1,
                    ],
                ],
                [
                    'id' => 'delay_1',
                    'type' => 'delay',
                    'data' => [
                        'seconds' => 1,
                    ],
                ],
                [
                    'id' => 'notify_1',
                    'type' => 'notification',
                    'data' => [
                        'message' => 'Status is: {http_1.status}',
                    ],
                ],
            ],
            'edges' => [
                ['source' => 'http_1', 'target' => 'notify_1'],
                ['source' => 'delay_1', 'target' => 'notify_1'],
            ],
        ];

        setTenant($this->tenant);

        $this->workflow = Workflow::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'name' => 'Parallel Workflow Test',
            'status' => 'active',
            'settings' => ['timeout_seconds' => 60],
        ]);

        $this->version = WorkflowVersion::create([
            'workflow_id' => $this->workflow->id,
            'version_number' => 1,
            'definition' => $definition,
            'is_active' => true,
        ]);

        $this->workflow->update(['current_version_id' => $this->version->id]);

        $this->executor = app(WorkflowExecutor::class);
    }

    /**
     * Test starting execution dispatches first batch of parallel nodes.
     */
    public function test_workflow_start_dispatches_parallel_jobs(): void
    {
        Queue::fake();

        $run = $this->executor->execute($this->version, [], 'manual', $this->user->id);

        $this->assertEquals('running', $run->status);

        // Ensure 2 jobs were pushed to queue for Batch 0
        Queue::assertPushed(ExecuteStepJob::class, 2);

        // Verify StepRuns are created in pending state
        $stepRuns = StepRun::where('workflow_run_id', $run->id)->get();
        $this->assertCount(2, $stepRuns);
        $this->assertTrue($stepRuns->contains('node_id', 'http_1'));
        $this->assertTrue($stepRuns->contains('node_id', 'delay_1'));
    }

    /**
     * Test sequential execution of batches as steps complete.
     */
    public function test_workflow_progresses_through_batches_sequentially(): void
    {
        Http::fake([
            'https://api.example.com/payment' => Http::response(['status' => 'ok'], 200),
        ]);

        // Trigger the workflow run
        $run = $this->executor->execute($this->version, [], 'manual', $this->user->id);

        $stepRunsBatch0 = StepRun::where('workflow_run_id', $run->id)->get();
        $this->assertCount(2, $stepRunsBatch0);

        // Manually execute the first job (http_1)
        $httpStep = $stepRunsBatch0->firstWhere('node_id', 'http_1');
        (new ExecuteStepJob($httpStep))->handle();

        $httpStep->refresh();
        $this->assertEquals('completed', $httpStep->status);
        $this->assertEquals(200, $httpStep->output['status']);

        // Since delay_1 is still pending/running, Batch 1 should NOT be dispatched yet
        $this->assertCount(2, StepRun::where('workflow_run_id', $run->id)->get());

        // Manually execute the second job (delay_1)
        $delayStep = $stepRunsBatch0->firstWhere('node_id', 'delay_1');
        (new ExecuteStepJob($delayStep))->handle();

        $delayStep->refresh();
        $this->assertEquals('completed', $delayStep->status);

        // After both Batch 0 steps complete, notify_1 (Batch 1) should be scheduled/created
        $allSteps = StepRun::where('workflow_run_id', $run->id)->get();
        $this->assertCount(3, $allSteps);
        $notifyStep = $allSteps->firstWhere('node_id', 'notify_1');
        $this->assertNotNull($notifyStep);

        // Execute notify_1
        (new ExecuteStepJob($notifyStep))->handle();

        $notifyStep->refresh();
        $this->assertEquals('completed', $notifyStep->status);
        
        // Assert output variable translation was correct
        $this->assertEquals('Status is: 200', $notifyStep->output['message']);

        // Finally, the workflow run should be marked completed
        $run->refresh();
        $this->assertEquals('completed', $run->status);
    }

    /**
     * Test step run failure handles retries and halts workflow when retries are exhausted.
     */
    public function test_step_failure_and_retry_exhaustion(): void
    {
        // Mock payment URL returning 500 error
        Http::fake([
            'https://api.example.com/payment' => Http::response('Error', 500),
        ]);

        $run = $this->executor->execute($this->version, [], 'manual', $this->user->id);

        $stepRuns = StepRun::where('workflow_run_id', $run->id)->get();
        $httpStep = $stepRuns->firstWhere('node_id', 'http_1');

        // Let's run the job - it should fail but retry delay/job should be set
        Queue::fake();
        (new ExecuteStepJob($httpStep))->handle();

        $httpStep->refresh();
        $this->assertEquals('failed', $httpStep->status);
        $this->assertEquals(1, $httpStep->retry_count); // Incremented to 1 retry

        // Entire workflow run is NOT marked failed yet because retry limit (2) is not exceeded
        $run->refresh();
        $this->assertEquals('running', $run->status);

        // Manually handle another failure (retry count 2)
        (new ExecuteStepJob($httpStep))->handle();
        $httpStep->refresh();
        $this->assertEquals(2, $httpStep->retry_count);

        $run->refresh();
        $this->assertEquals('running', $run->status);

        // Manually handle 3rd failure (retry count 2 exceeded max_retries limit of 2)
        (new ExecuteStepJob($httpStep))->handle();
        $httpStep->refresh();
        
        // Since retries are exhausted, the workflow run should be marked failed
        $run->refresh();
        $this->assertEquals('failed', $run->status);
        $this->assertStringContainsString('Step http_1 failed', $run->error_message);
    }
}
