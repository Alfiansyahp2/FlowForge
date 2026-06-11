<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWorkflowRequest;
use App\Http\Requests\UpdateWorkflowRequest;
use App\Http\Resources\WorkflowResource;
use App\Models\Workflow;
use App\WorkflowEngine\WorkflowExecutor;
use App\WorkflowEngine\WorkflowValidator;
use App\WorkflowEngine\TopologicalSorter;
use App\WorkflowEngine\RetryManager;
use App\WorkflowEngine\SafeExpressionEvaluator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class WorkflowController extends Controller
{
    private WorkflowExecutor $executor;

    public function __construct(
        WorkflowValidator $validator,
        TopologicalSorter $sorter,
        RetryManager $retryManager,
        SafeExpressionEvaluator $expressionEvaluator
    ) {
        $this->executor = new WorkflowExecutor($validator, $sorter, $retryManager, $expressionEvaluator);
    }
    /**
     * Display a listing of workflows.
     *
     * @param Request $request
     * @return AnonymousResourceCollection
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = $request->input('per_page', 15);
        $search = $request->input('search');
        $status = $request->input('status');
        $sort = $request->input('sort', 'created_at');
        $order = $request->input('order', 'desc');

        $query = Workflow::query();

        // Search by name or description
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Filter by status
        if ($status) {
            $query->where('status', $status);
        }

        // Sort
        $query->orderBy($sort, $order);

        $workflows = $query->paginate($perPage);

        return WorkflowResource::collection($workflows);
    }

    /**
     * Store a newly created workflow in storage.
     *
     * @param StoreWorkflowRequest $request
     * @return WorkflowResource
     */
    public function store(StoreWorkflowRequest $request): WorkflowResource
    {
        return DB::transaction(function () use ($request) {
            $workflow = Workflow::create([
                'tenant_id' => $request->user()->tenant_id,
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'status' => $request->input('status', 'draft'),
                'settings' => $request->input('settings', []),
                'created_by' => $request->user()->id,
            ]);

            // Create initial version if definition provided
            if ($request->has('definition')) {
                $version = $workflow->versions()->create([
                    'definition' => $request->input('definition'),
                    'version' => 1,
                    'created_by' => $request->user()->id,
                ]);

                $workflow->update(['current_version_id' => $version->id]);
            }

            return new WorkflowResource($workflow->fresh('currentVersion'));
        });
    }

    /**
     * Display the specified workflow.
     *
     * @param Workflow $workflow
     * @return WorkflowResource
     */
    public function show(Workflow $workflow): WorkflowResource
    {
        $workflow->load(['currentVersion', 'creator']);

        return new WorkflowResource($workflow);
    }

    /**
     * Update the specified workflow in storage.
     *
     * @param UpdateWorkflowRequest $request
     * @param Workflow $workflow
     * @return WorkflowResource
     */
    public function update(UpdateWorkflowRequest $request, Workflow $workflow): WorkflowResource
    {
        return DB::transaction(function () use ($request, $workflow) {
            $workflow->update([
                'name' => $request->input('name', $workflow->name),
                'description' => $request->input('description', $workflow->description),
                'status' => $request->input('status', $workflow->status),
                'settings' => $request->input('settings', $workflow->settings),
            ]);

            // Create new version if definition changed
            if ($request->has('definition')) {
                $latestVersion = $workflow->versions()->max('version') ?? 0;

                $version = $workflow->versions()->create([
                    'definition' => $request->input('definition'),
                    'version' => $latestVersion + 1,
                    'created_by' => $request->user()->id,
                ]);

                $workflow->update(['current_version_id' => $version->id]);
            }

            return new WorkflowResource($workflow->fresh('currentVersion'));
        });
    }

    /**
     * Remove the specified workflow from storage.
     *
     * @param Workflow $workflow
     * @return JsonResponse
     */
    public function destroy(Workflow $workflow): JsonResponse
    {
        $workflow->delete();

        return response()->json([
            'message' => 'Workflow deleted successfully',
        ], 200);
    }

    /**
     * Archive the specified workflow.
     *
     * @param Workflow $workflow
     * @return WorkflowResource
     */
    public function archive(Workflow $workflow): WorkflowResource
    {
        $workflow->update(['status' => 'archived']);

        return new WorkflowResource($workflow->fresh());
    }

    /**
     * Activate the specified workflow.
     *
     * @param Workflow $workflow
     * @return WorkflowResource
     */
    public function activate(Workflow $workflow): WorkflowResource
    {
        if (!$workflow->currentVersion) {
            abort(400, 'Cannot activate workflow without a version');
        }

        $workflow->update(['status' => 'active']);

        return new WorkflowResource($workflow->fresh());
    }

    /**
     * Execute a workflow manually.
     *
     * @param Request $request
     * @param Workflow $workflow
     * @return JsonResponse
     */
    public function run(Request $request, Workflow $workflow): JsonResponse
    {
        if (!$workflow->currentVersion) {
            return response()->json([
                'message' => 'Workflow has no version to run. Please save a definition first.',
            ], 400);
        }

        if ($workflow->status === 'archived') {
            return response()->json([
                'message' => 'Cannot run an archived workflow. Activate it first.',
            ], 400);
        }

        try {
            $input = array_merge(
                $request->input('input', []),
                [
                    'trigger_type'   => 'manual',
                    'triggered_by'   => $request->user()?->id,
                    'triggered_at'   => now()->toDateTimeString(),
                ]
            );

            $workflowRun = $this->executor->execute(
                $workflow->currentVersion,
                $input,
                'manual',
                $request->user()?->id
            );

            return response()->json([
                'message'         => 'Workflow started successfully',
                'workflow_run_id' => $workflowRun->id,
                'status'          => $workflowRun->status,
                'started_at'      => $workflowRun->started_at,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Workflow execution failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Duplicate the specified workflow.
     *
     * @param Workflow $workflow
     * @param Request $request
     * @return WorkflowResource
     */
    public function duplicate(Workflow $workflow, Request $request): WorkflowResource
    {
        return DB::transaction(function () use ($workflow, $request) {
            $newWorkflow = Workflow::create([
                'tenant_id' => $request->user()->tenant_id,
                'name' => $request->input('name', "{$workflow->name} (Copy)"),
                'description' => $workflow->description,
                'status' => 'draft',
                'settings' => $workflow->settings,
                'created_by' => $request->user()->id,
            ]);

            // Copy versions
            foreach ($workflow->versions as $version) {
                $newVersion = $newWorkflow->versions()->create([
                    'definition' => $version->definition,
                    'version' => $version->version,
                    'created_by' => $request->user()->id,
                ]);

                if ($version->id === $workflow->current_version_id) {
                    $newWorkflow->update(['current_version_id' => $newVersion->id]);
                }
            }

            return new WorkflowResource($newWorkflow->fresh('currentVersion'));
        });
    }
}
