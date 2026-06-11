<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkflowResource;
use App\Http\Resources\WorkflowVersionResource;
use App\Models\Workflow;
use App\Models\WorkflowVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class WorkflowVersionController extends Controller
{
    /**
     * Display a listing of all workflow versions.
     *
     * @param Workflow $workflow
     * @return AnonymousResourceCollection
     */
    public function index(Workflow $workflow): AnonymousResourceCollection
    {
        $versions = $workflow->versions()->orderBy('version', 'desc')->paginate(20);

        // Mark which version is current
        $versions->getCollection()->each(function ($version) use ($workflow) {
            $version->is_current = $version->id === $workflow->current_version_id;
        });

        return WorkflowVersionResource::collection($versions);
    }

    /**
     * Store a newly created workflow version in storage.
     *
     * @param Request $request
     * @param Workflow $workflow
     * @return WorkflowVersionResource
     */
    public function store(Request $request, Workflow $workflow): WorkflowVersionResource
    {
        $request->validate([
            'definition' => ['required', 'json'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        return DB::transaction(function () use ($request, $workflow) {
            $latestVersion = $workflow->versions()->max('version') ?? 0;

            $version = $workflow->versions()->create([
                'definition' => $request->input('definition'),
                'version' => $latestVersion + 1,
                'comment' => $request->input('comment'),
                'created_by' => $request->user()->id,
            ]);

            // Automatically set as current version
            $workflow->update(['current_version_id' => $version->id]);

            $version->load('creator');

            return new WorkflowVersionResource($version);
        });
    }

    /**
     * Display the specified workflow version.
     *
     * @param Workflow $workflow
     * @param WorkflowVersion $version
     * @return WorkflowVersionResource
     */
    public function show(Workflow $workflow, WorkflowVersion $version): WorkflowVersionResource
    {
        // Verify version belongs to this workflow
        if ($version->workflow_id !== $workflow->id) {
            abort(404, 'Version not found for this workflow');
        }

        $version->load('creator');
        $version->is_current = $version->id === $workflow->current_version_id;

        return new WorkflowVersionResource($version);
    }

    /**
     * Rollback workflow to a specific version.
     *
     * @param Request $request
     * @param Workflow $workflow
     * @param WorkflowVersion $version
     * @return WorkflowResource
     */
    public function rollback(Request $request, Workflow $workflow, WorkflowVersion $version): WorkflowResource
    {
        // Verify version belongs to this workflow
        if ($version->workflow_id !== $workflow->id) {
            abort(404, 'Version not found for this workflow');
        }

        return DB::transaction(function () use ($request, $workflow, $version) {
            // Create a new version from the old one (preserves history)
            $latestVersion = $workflow->versions()->max('version') ?? 0;

            $newVersion = $workflow->versions()->create([
                'definition' => $version->definition,
                'version' => $latestVersion + 1,
                'comment' => "Rollback to version {$version->version}",
                'created_by' => $request->user()->id,
            ]);

            // Set as current version
            $workflow->update(['current_version_id' => $newVersion->id]);

            return new WorkflowResource($workflow->fresh('currentVersion'));
        });
    }

    /**
     * Activate a specific version.
     *
     * @param Request $request
     * @param Workflow $workflow
     * @param WorkflowVersion $version
     * @return WorkflowResource
     */
    public function activate(Request $request, Workflow $workflow, WorkflowVersion $version): WorkflowResource
    {
        // Verify version belongs to this workflow
        if ($version->workflow_id !== $workflow->id) {
            abort(404, 'Version not found for this workflow');
        }

        // Set as current version
        $workflow->update(['current_version_id' => $version->id]);

        return new WorkflowResource($workflow->fresh('currentVersion'));
    }

    /**
     * Compare two versions.
     *
     * @param Workflow $workflow
     * @param Request $request
     * @return JsonResponse
     */
    public function compare(Workflow $workflow, Request $request): JsonResponse
    {
        $request->validate([
            'from_version_id' => ['required', 'uuid'],
            'to_version_id' => ['required', 'uuid'],
        ]);

        $fromVersion = $workflow->versions()->findOrFail($request->input('from_version_id'));
        $toVersion = $workflow->versions()->findOrFail($request->input('to_version_id'));

        return response()->json([
            'data' => [
                'from' => new WorkflowVersionResource($fromVersion),
                'to' => new WorkflowVersionResource($toVersion),
                'diff' => [
                    'nodes_added' => $this->calculateNodesDiff($fromVersion->definition, $toVersion->definition, 'added'),
                    'nodes_removed' => $this->calculateNodesDiff($fromVersion->definition, $toVersion->definition, 'removed'),
                    'edges_added' => $this->calculateEdgesDiff($fromVersion->definition, $toVersion->definition, 'added'),
                    'edges_removed' => $this->calculateEdgesDiff($fromVersion->definition, $toVersion->definition, 'removed'),
                ],
            ],
        ]);
    }

    /**
     * Calculate nodes difference between two versions.
     */
    private function calculateNodesDiff(?array $from, ?array $to, string $type): array
    {
        $fromNodes = collect($from['nodes'] ?? [])->pluck('id')->toArray();
        $toNodes = collect($to['nodes'] ?? [])->pluck('id')->toArray();

        if ($type === 'added') {
            return array_values(array_diff($toNodes, $fromNodes));
        }

        return array_values(array_diff($fromNodes, $toNodes));
    }

    /**
     * Calculate edges difference between two versions.
     */
    private function calculateEdgesDiff(?array $from, ?array $to, string $type): array
    {
        $fromEdges = collect($from['edges'] ?? [])->map(function ($edge) {
            return $edge['source'] . '-' . $edge['target'];
        })->toArray();

        $toEdges = collect($to['edges'] ?? [])->map(function ($edge) {
            return $edge['source'] . '-' . $edge['target'];
        })->toArray();

        if ($type === 'added') {
            return array_values(array_diff($toEdges, $fromEdges));
        }

        return array_values(array_diff($fromEdges, $toEdges));
    }
}
