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

        if ($workflowRun->status !== 'running') {
            Log::info("RetryStepJob skipped: workflow run {$workflowRun->id} is in status {$workflowRun->status}");
            return;
        }

        Log::info("RetryStepJob: triggering retry for step {$this->stepRun->node_id} on workflow run {$workflowRun->id}");
        
        ExecuteStepJob::dispatch($this->stepRun);
    }
}
