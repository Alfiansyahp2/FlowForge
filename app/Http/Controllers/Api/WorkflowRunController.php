<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkflowRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkflowRunController extends Controller
{
    /**
     * List workflow runs, optionally filtered by workflow.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage    = $request->input('per_page', 15);
        $workflowId = $request->input('workflow_id');
        $status     = $request->input('status');

        $query = WorkflowRun::with(['workflow:id,name', 'triggeredBy:id,name'])
            ->orderBy('created_at', 'desc');

        if ($workflowId) {
            $query->where('workflow_id', $workflowId);
        }

        if ($status) {
            $query->where('status', $status);
        }

        $runs = $query->paginate($perPage);

        return response()->json([
            'data' => $runs->map(fn($r) => $this->format($r)),
            'meta' => [
                'current_page' => $runs->currentPage(),
                'last_page'    => $runs->lastPage(),
                'per_page'     => $runs->perPage(),
                'total'        => $runs->total(),
            ],
        ]);
    }

    /**
     * Show a single workflow run with its step runs.
     */
    public function show(WorkflowRun $run): JsonResponse
    {
        $run->load(['workflow:id,name', 'triggeredBy:id,name', 'stepRuns']);

        return response()->json([
            'data' => array_merge($this->format($run), [
                'step_runs' => $run->stepRuns->map(fn($s) => [
                    'id'            => $s->id,
                    'node_id'       => $s->node_id,
                    'node_type'     => $s->node_type,
                    'status'        => $s->status,
                    'started_at'    => $s->started_at?->toISOString(),
                    'finished_at'   => $s->finished_at?->toISOString(),
                    'duration'      => $s->duration,
                    'input'         => $s->input,
                    'output'        => $s->output,
                    'error_message' => $s->error_message,
                    'retry_count'   => $s->retry_count,
                ]),
            ]),
        ]);
    }

    /**
     * Cancel a running workflow run.
     */
    public function cancel(WorkflowRun $run): JsonResponse
    {
        if (!in_array($run->status, ['pending', 'running'])) {
            return response()->json([
                'message' => 'Only pending or running workflow runs can be cancelled.',
            ], 422);
        }

        $run->update([
            'status'      => 'failed',
            'finished_at' => now(),
            'error_message' => 'Cancelled by user',
        ]);

        return response()->json(['message' => 'Workflow run cancelled.']);
    }

    private function format(WorkflowRun $run): array
    {
        return [
            'id'                  => $run->id,
            'workflow_id'         => $run->workflow_id,
            'workflow'            => $run->workflow ? ['id' => $run->workflow->id, 'name' => $run->workflow->name] : null,
            'workflow_version_id' => $run->workflow_version_id,
            'status'              => $run->status,
            'trigger_type'        => $run->trigger_type,
            'triggered_by'        => $run->triggeredBy?->name,
            'started_at'          => $run->started_at?->toISOString(),
            'finished_at'         => $run->finished_at?->toISOString(),
            'duration'            => $run->duration,
            'input'               => $run->input,
            'output'              => $run->output,
            'error_message'       => $run->error_message,
            'created_at'          => $run->created_at?->toISOString(),
        ];
    }
}
