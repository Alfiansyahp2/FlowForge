<?php

namespace App\Jobs;

use App\Models\StepRun;
use App\WorkflowEngine\WorkflowExecutor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Log;

class RetryStepJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public StepRun $stepRun;

    /**
     * Create a new job instance.
     */
    public function __construct(StepRun $stepRun)
    {
        $this->stepRun = $stepRun;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $workflowRun = $this->stepRun->workflowRun;
        $workflowVersion = $workflowRun->version;
        $definition = $workflowVersion->definition;

        // Rebuild executor using the container for dependencies
        $executor = App::make(WorkflowExecutor::class);

        // Find the node definition in the workflow graph
        $node = collect($definition['nodes'] ?? [])->firstWhere('id', $this->stepRun->node_id);

        if (!$node) {
            Log::error('RetryStepJob failed: node not found', [
                'node_id' => $this->stepRun->node_id,
                'workflow_run_id' => $this->stepRun->workflow_run_id,
            ]);
            return;
        }

        // Re-run the whole workflow from the failed step context is not supported yet.
        Log::warning('RetryStepJob is currently a placeholder and does not re-execute the failed step automatically.');
    }
}
