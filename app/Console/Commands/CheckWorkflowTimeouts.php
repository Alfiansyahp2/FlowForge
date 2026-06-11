<?php

namespace App\Console\Commands;

use App\Models\WorkflowRun;
use App\Models\StepRun;
use App\Events\WorkflowFailed;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckWorkflowTimeouts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'workflows:check-timeouts';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Scan and fail running workflows that have exceeded their configured timeout';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Scanning for timed-out workflow runs...');

        $timedOutRuns = WorkflowRun::where('status', 'running')
            ->whereNotNull('timeout_at')
            ->where('timeout_at', '<=', now())
            ->get();

        if ($timedOutRuns->isEmpty()) {
            $this->info('No timed-out workflow runs found.');
            return self::SUCCESS;
        }

        $this->info("Found {$timedOutRuns->count()} timed-out workflow run(s).");

        foreach ($timedOutRuns as $run) {
            $this->warn("Timing out run: {$run->id}");

            // Update step runs that are still running or pending to timeout
            StepRun::where('workflow_run_id', $run->id)
                ->whereIn('status', ['pending', 'running'])
                ->update([
                    'status' => 'timeout',
                    'finished_at' => now(),
                ]);

            // Update the main workflow run
            $run->update([
                'status' => 'timeout',
                'finished_at' => now(),
                'error_message' => 'Workflow run timed out (exceeded limit of ' . $run->timeout_seconds . ' seconds)',
                'duration' => (int) $run->started_at->diffInMilliseconds(now()),
            ]);

            // Broadcast failed event
            broadcast(new WorkflowFailed($run, 'Workflow run timed out'));

            Log::warning("Workflow run {$run->id} was timed out by scheduler.", [
                'workflow_run_id' => $run->id,
                'timeout_seconds' => $run->timeout_seconds,
                'started_at' => $run->started_at,
            ]);
        }

        $this->info('Timeout check completed.');

        return self::SUCCESS;
    }
}
