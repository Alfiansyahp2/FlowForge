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
        SafeExpressionEvaluator $expressionEvaluator
    ) {
        $this->validator = $validator;
        $this->sorter = $sorter;
        $this->retryManager = $retryManager;
        $this->expressionEvaluator = $expressionEvaluator;
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
        // WorkflowVersion.definition is cast to array, so use it directly.
        $definition = $version->definition;

        // Validate workflow
        $this->validator->validateOrFail($definition);

        // Get execution order
        $executionBatches = $this->sorter->getExecutionBatches($definition);

        return DB::transaction(function () use ($version, $input, $executionBatches, $definition, $triggerType, $triggeredBy) {
            $now = now();

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
            ]);

            // Broadcast workflow started event
            broadcast(new WorkflowStarted($workflowRun));

            // Execute all batches
            $executionContext = [
                'workflow_run_id' => $workflowRun->id,
                'input' => $input,
                'variables' => [],
                'now' => $now,
            ];

            try {
                foreach ($executionBatches as $batchIndex => $batch) {
                    $this->executeBatch($batch, $definition, $executionContext, $batchIndex);
                }

                // Update workflow run status
                $finishedAt = now();
                $workflowRun->update([
                    'status'      => 'completed',
                    'finished_at' => $finishedAt,
                    'duration'    => (int) $workflowRun->started_at->diffInMilliseconds($finishedAt),
                ]);

                // Broadcast workflow completed event
                broadcast(new WorkflowCompleted($workflowRun));

                return $workflowRun->fresh('stepRuns');
            } catch (Exception $e) {
                // Update workflow run as failed
                $workflowRun->update([
                    'status' => 'failed',
                    'finished_at' => now(),
                ]);

                // Broadcast workflow failed event
                broadcast(new WorkflowFailed($workflowRun, $e->getMessage()));

                throw $e;
            }
        });
    }

    /**
     * Execute a batch of nodes (can run in parallel).
     *
     * @param array  $batch    Batch descriptor from TopologicalSorter
     * @param array  $definition
     * @param array  &$context
     * @param int    $batchIndex  Used to set sort_order on StepRun
     * @return void
     * @throws Exception
     */
    private function executeBatch(array $batch, array $definition, array &$context, int $batchIndex = 0): void
    {
        $nodeResults = [];

        foreach ($batch['nodes'] as $nodePosition => $nodeId) {
            $node = $this->findNode($definition, $nodeId);
            if (!$node) {
                continue;
            }

            // sort_order = batchIndex * 100 + position within batch
            $sortOrder = ($batchIndex * 100) + $nodePosition;

            $stepRun = $this->createStepRun(
                $context['workflow_run_id'],
                $nodeId,
                $node,
                $sortOrder,
                $context['input'] ?? []
            );

            $stepStartedAt = now();
            $stepRun->update(['status' => 'running', 'started_at' => $stepStartedAt]);

            broadcast(new StepStarted($stepRun));

            try {
                $result = $this->executeNode($node, $context);

                $stepFinishedAt = now();
                $stepRun->update([
                    'status'      => 'completed',
                    'finished_at' => $stepFinishedAt,
                    'duration'    => (int) $stepStartedAt->diffInMilliseconds($stepFinishedAt),
                    'output'      => $result,
                ]);

                broadcast(new StepCompleted($stepRun));
                $nodeResults[$nodeId] = $result;
            } catch (Exception $e) {
                $this->handleStepFailure($stepRun, $e, $node);
                throw $e;
            }
        }

        $context['variables'] = array_merge($context['variables'], $nodeResults);
    }

    /**
     * Execute a single node.
     *
     * @param array $node
     * @param array $context
     * @return array
     * @throws Exception
     */
    private function executeNode(array $node, array &$context): array
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
    private function handleStepFailure(StepRun $stepRun, Exception $exception, array $node): void
    {
        $maxRetries = $node['data']['max_retries'] ?? 3;
        $retryDelay = $node['data']['retry_delay'] ?? 5;

        $finishedAt = now();
        $duration = max(0, $finishedAt->diffInMilliseconds($stepRun->started_at));

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
