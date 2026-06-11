<?php

namespace App\Console\Commands;

use App\Models\Schedule;
use App\WorkflowEngine\WorkflowExecutor;
use App\WorkflowEngine\WorkflowValidator;
use App\WorkflowEngine\TopologicalSorter;
use App\WorkflowEngine\RetryManager;
use App\WorkflowEngine\SafeExpressionEvaluator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RunDueSchedules extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'schedules:run-due';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run all schedules that are due to execute';

    private WorkflowExecutor $executor;

    public function __construct(
        WorkflowValidator $validator,
        TopologicalSorter $sorter,
        RetryManager $retryManager,
        SafeExpressionEvaluator $expressionEvaluator
    ) {
        parent::__construct();
        $this->executor = new WorkflowExecutor($validator, $sorter, $retryManager, $expressionEvaluator);
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Checking for due schedules...');

        // Get all schedules that should run now
        $schedules = Schedule::shouldRun()->with(['workflow.currentVersion'])->get();

        if ($schedules->isEmpty()) {
            $this->info('No due schedules found.');
            return self::SUCCESS;
        }

        $this->info("Found {$schedules->count()} due schedule(s).");

        foreach ($schedules as $schedule) {
            $this->info("Processing schedule: {$schedule->name}");

            try {
                // Get workflow version to use
                $version = $schedule->workflowVersion ?? $schedule->workflow->currentVersion;

                if (!$version) {
                    $this->warn("  - Skipped: Workflow has no active version");
                    continue;
                }

                // Execute workflow
                $input = [
                    'schedule_id' => $schedule->id,
                    'schedule_name' => $schedule->name,
                    'triggered_at' => now()->toDateTimeString(),
                    'trigger_type' => 'cron',
                ];

                $workflowRun = $this->executor->execute($version, $input);

                // Record the run and update next run time
                $schedule->recordRun();

                $this->info("  ✓ Executed successfully - Run ID: {$workflowRun->id} ({$workflowRun->status})");

            } catch (\Exception $e) {
                $this->error("  ✗ Failed: {$e->getMessage()}");
                Log::error('Schedule execution failed', [
                    'schedule_id' => $schedule->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        $this->info('Schedule execution completed.');

        return self::SUCCESS;
    }
}
