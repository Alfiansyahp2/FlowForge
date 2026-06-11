<?php

namespace App\WorkflowEngine;

use App\Events\StepCompleted;
use App\Events\StepFailed;
use App\Events\StepStarted;
use App\Events\WorkflowCompleted;
use App\Events\WorkflowFailed;
use App\Events\WorkflowStarted;
use App\Models\WorkflowRun;
use App\Models\StepRun;
use App\Models\WorkflowVersion;
use App\WorkflowEngine\SafeExpressionEvaluator;
use Exception;
use App\Jobs\RetryStepJob;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WorkflowExecutor
{
    private WorkflowValidator $validator;
    private TopologicalSorter $sorter;
    private RetryManager $retryManager;
    private SafeExpressionEvaluator $expressionEvaluator;

    // Node type handlers
    private const NODE_HANDLERS = [
        'http' => 'executeHttpNode',
        'delay' => 'executeDelayNode',
        'condition' => 'executeConditionNode',
        'math' => 'executeMathNode',
        'notification' => 'executeNotificationNode',
    ];

    public function __construct(
        WorkflowValidator $validator,
        TopologicalSorter $sorter,
        RetryManager $retryManager,
        ?SafeExpressionEvaluator $expressionEvaluator = null
    ) {
        $this->validator = $validator;
        $this->sorter = $sorter;
        $this->retryManager = $retryManager;
        $this->expressionEvaluator = $expressionEvaluator ?? app(SafeExpressionEvaluator::class);
    }

    /**
     * Execute a workflow.
     *
     * @param WorkflowVersion $version
     * @param array $input
     * @param string $triggerType  manual | webhook | cron
     * @param string|null $triggeredBy  User ID (for manual runs)
     * @return WorkflowRun
     * @throws Exception
     */
    public function execute(
        WorkflowVersion $version,
        array $input = [],
        string $triggerType = 'manual',
        ?string $triggeredBy = null
    ): WorkflowRun
    {
        $definition = $version->definition;

        // Validate workflow
        $this->validator->validateOrFail($definition);

        $now = now();
        $timeoutSeconds = $version->workflow->settings['timeout_seconds'] ?? 1800; // default 30 mins

        // Create workflow run
        $workflowRun = WorkflowRun::create([
            'tenant_id'           => $version->workflow->tenant_id,
            'workflow_id'         => $version->workflow->id,
            'workflow_version_id' => $version->id,
            'trigger_type'        => $triggerType,
            'triggered_by'        => $triggeredBy,
            'status'              => 'running',
            'input'               => $input,
            'started_at'          => $now,
            'timeout_seconds'     => $timeoutSeconds,
            'timeout_at'          => $now->copy()->addSeconds($timeoutSeconds),
        ]);

        // Broadcast workflow started event
        broadcast(new WorkflowStarted($workflowRun));

        // Start execution of Batch 0
        $this->startBatch($workflowRun, 0);

        return $workflowRun;
    }

    /**
     * Start execution of a batch.
     */
    public function startBatch(WorkflowRun $workflowRun, int $batchIndex): void
    {
        $workflowRun->refresh();

        if ($workflowRun->status !== 'running') {
            return;
        }

        $definition = $workflowRun->version->definition;
        $executionBatches = $this->sorter->getExecutionBatches($definition);

        // If no more batches, complete the workflow run
        if ($batchIndex >= count($executionBatches)) {
            $finishedAt = now();
            $duration = max(0, $finishedAt->diffInMilliseconds($workflowRun->started_at));

            $workflowRun->update([
                'status' => 'completed',
                'finished_at' => $finishedAt,
                'duration' => $duration,
            ]);

            broadcast(new WorkflowCompleted($workflowRun));
            return;
        }

        $batch = $executionBatches[$batchIndex];

        foreach ($batch['nodes'] as $nodePosition => $nodeId) {
            $node = $this->findNode($definition, $nodeId);
            if (!$node) {
                continue;
            }

            // sort_order = batchIndex * 100 + position within batch
            $sortOrder = ($batchIndex * 100) + $nodePosition;

            $stepRun = $this->createStepRun(
                $workflowRun->id,
                $nodeId,
                $node,
                $sortOrder,
                $workflowRun->input ?? []
            );

            // Dispatch as background job
            \App\Jobs\ExecuteStepJob::dispatch($stepRun);
        }
    }

    /**
     * Check if current batch is completed and proceed to next one safely.
     */
    public function checkAndProceedToNextBatch(WorkflowRun $workflowRun, int $currentSortOrder): void
    {
        $batchIndex = (int) floor($currentSortOrder / 100);

        DB::transaction(function () use ($workflowRun, $batchIndex) {
            // Lock workflow run to prevent race conditions
            $run = WorkflowRun::where('id', $workflowRun->id)->lockForUpdate()->first();

            if ($run->status !== 'running') {
                return;
            }

            $definition = $run->version->definition;
            $executionBatches = $this->sorter->getExecutionBatches($definition);

            if (!isset($executionBatches[$batchIndex])) {
                return;
            }

            $batch = $executionBatches[$batchIndex];

            // Check if all steps in current batch are completed
            $unfinished = StepRun::where('workflow_run_id', $run->id)
                ->whereBetween('sort_order', [$batchIndex * 100, $batchIndex * 100 + 99])
                ->where('status', '!=', 'completed')
                ->exists();

            if (!$unfinished) {
                // Check if next batch was already started
                $nextBatchIndex = $batchIndex + 1;
                $nextBatchStarted = StepRun::where('workflow_run_id', $run->id)
                    ->whereBetween('sort_order', [$nextBatchIndex * 100, $nextBatchIndex * 100 + 99])
                    ->exists();

                if (!$nextBatchStarted) {
                    $this->startBatch($run, $nextBatchIndex);
                }
            }
        });
    }

    /**
     * Execute a single node.
     *
     * @param array $node
     * @param array $context
     * @return array
     * @throws Exception
     */
    public function executeNode(array $node, array &$context): array
    {
        $nodeType = $node['type'];
        $handler = self::NODE_HANDLERS[$nodeType] ?? null;

        if (!$handler) {
            throw new Exception("Unsupported node type: {$nodeType}");
        }

        return $this->$handler($node, $context);
    }

    /**
     * Execute HTTP request node.
     *
     * @param array $node
     * @param array $context
     * @return array
     * @throws Exception
     */
    private function executeHttpNode(array $node, array &$context): array
    {
        $data = $node['data'];
        $url = $this->replaceVariables($data['url'] ?? '', $context['variables']);
        $method = strtoupper($data['method'] ?? 'GET');
        $headers = $data['headers'] ?? [];
        $body = $data['body'] ?? null;

        $response = Http::withHeaders($headers)
            ->timeout($data['timeout'] ?? 30)
            ->send($method, $url, $body ? ['body' => $body] : []);

        return [
            'status' => $response->status(),
            'headers' => $response->headers(),
            'body' => $response->body(),
        ];
    }

    /**
     * Execute delay node.
     *
     * @param array $node
     * @param array $context
     * @return array
     */
    private function executeDelayNode(array $node, array &$context): array
    {
        $seconds = $node['data']['seconds'] ?? 0;

        if ($seconds > 0) {
            sleep($seconds);
        }

        return [
            'delayed' => true,
            'seconds' => $seconds,
        ];
    }

    /**
     * Execute condition node.
     *
     * @param array $node
     * @param array $context
     * @return array
     * @throws Exception
     */
    private function executeConditionNode(array $node, array &$context): array
    {
        $expression = $node['data']['expression'] ?? '';

        // Use safe expression evaluator instead of eval()
        $result = $this->expressionEvaluator->evaluate($expression, $context['variables']);

        return [
            'condition_met' => $result,
            'expression' => $expression,
        ];
    }

    /**
     * Execute math node (safe alternative to script node).
     *
     * @param array $node
     * @param array $context
     * @return array
     * @throws Exception
     */
    private function executeMathNode(array $node, array &$context): array
    {
        $expression = $node['data']['expression'] ?? '';

        // Use safe expression evaluator for math operations
        try {
            $result = $this->expressionEvaluator->evaluate($expression, $context['variables']);

            return [
                'result' => $result,
                'expression' => $expression,
            ];
        } catch (Exception $e) {
            Log::warning('Math expression evaluation failed', [
                'expression' => $expression,
                'error' => $e->getMessage(),
            ]);

            throw new Exception("Math expression failed: {$e->getMessage()}");
        }
    }

    /**
     * Execute notification node (placeholder).
     *
     * @param array $node
     * @param array $context
     * @return array
     */
    private function executeNotificationNode(array $node, array &$context): array
    {
        $message = $this->replaceVariables($node['data']['message'] ?? '', $context['variables']);

        // Log notification (in production, send to notification service)
        Log::info('Workflow Notification', ['message' => $message]);

        return [
            'sent' => true,
            'message' => $message,
        ];
    }

    /**
     * Handle step execution failure.
     *
     * @param StepRun $stepRun
     * @param Exception $exception
     * @param array $node
     * @return void
     */
    public function handleStepFailure(StepRun $stepRun, Exception $exception, array $node): void
    {
        $maxRetries = $node['data']['max_retries'] ?? 3;
        $retryDelay = $node['data']['retry_delay'] ?? 5;

        $finishedAt = now();
        $duration = max(0, $finishedAt->diffInMilliseconds($stepRun->started_at ?? now()));

        $stepRun->update([
            'status' => 'failed',
            'finished_at' => $finishedAt,
            'duration' => $duration,
            'error_message' => $exception->getMessage(),
        ]);

        // Broadcast step failed event
        broadcast(new StepFailed($stepRun, $exception->getMessage()));

        // Check if we should retry
        if ($this->retryManager->shouldRetry($stepRun->retry_count, $maxRetries)) {
            $stepRun->increment('retry_count');
            $delay = $this->retryManager->calculateDelay($stepRun->retry_count, $retryDelay);
            $stepRun->update(['next_retry_at' => now()->addSeconds($delay)]);

            // Queue a retry job for the workflow run
            RetryStepJob::dispatch($stepRun)->delay(now()->addSeconds($delay));

            Log::info("Step {$stepRun->node_id} failed, scheduled retry in {$delay}s", [
                'workflow_run_id' => $stepRun->workflow_run_id,
                'step_run_id' => $stepRun->id,
                'retry_count' => $stepRun->retry_count,
                'next_retry_at' => $stepRun->next_retry_at,
            ]);
        } else {
            // No retries left: Mark the entire workflow run as failed
            $workflowRun = $stepRun->workflowRun;
            $workflowRun->update([
                'status' => 'failed',
                'finished_at' => now(),
                'error_message' => "Step {$stepRun->node_id} failed: " . $exception->getMessage(),
                'duration' => (int) $workflowRun->started_at->diffInMilliseconds(now()),
            ]);

            broadcast(new WorkflowFailed($workflowRun, $exception->getMessage()));
        }
    }

    /**
     * Create a step run record.
     *
     * @param string $workflowRunId
     * @param string $nodeId
     * @param array $node
     * @return StepRun
     */
    private function createStepRun(string $workflowRunId, string $nodeId, array $node, int $sortOrder, array $input): StepRun
    {
        return StepRun::create([
            'workflow_run_id' => $workflowRunId,
            'node_id' => $nodeId,
            'node_type' => $node['type'],
            'status' => 'pending',
            'sort_order' => $sortOrder,
            'input' => $input,
            'retry_config' => [
                'max_retries' => $node['data']['max_retries'] ?? 3,
                'retry_delay' => $node['data']['retry_delay'] ?? 5,
            ],
        ]);
    }

    /**
     * Find node by ID in definition.
     *
     * @param array $definition
     * @param string $nodeId
     * @return array|null
     */
    private function findNode(array $definition, string $nodeId): ?array
    {
        foreach ($definition['nodes'] ?? [] as $node) {
            if ($node['id'] === $nodeId) {
                return $node;
            }
        }

        return null;
    }

    /**
     * Replace variables in string.
     *
     * @param string $string
     * @param array $variables
     * @return string
     */
    private function replaceVariables(string $string, array $variables): string
    {
        foreach ($variables as $key => $value) {
            // Convert value to string - skip arrays/objects
            if (is_scalar($value)) {
                $string = str_replace("{{$key}}", (string)$value, $string);
            }
        }

        return $string;
    }

}
