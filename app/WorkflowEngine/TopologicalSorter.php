<?php

namespace App\WorkflowEngine;

use Exception;

class TopologicalSorter
{
    /**
     * Sort workflow nodes topologically.
     *
     * @param array $definition
     * @return array - Ordered list of node IDs ready for execution
     * @throws Exception
     */
    public function sort(array $definition): array
    {
        if (empty($definition['nodes'])) {
            return [];
        }

        // Build adjacency list and calculate in-degrees
        $graph = $this->buildGraph($definition);
        $inDegrees = $this->calculateInDegrees($definition);

        // Initialize queue with nodes having 0 in-degree
        $queue = $this->getZeroInDegreeNodes($inDegrees);
        $sorted = [];

        // Process nodes in topological order
        while (!empty($queue)) {
            $node = array_shift($queue);
            $sorted[] = $node;

            // Reduce in-degree for neighbors
            foreach ($graph[$node] ?? [] as $neighbor) {
                $inDegrees[$neighbor]--;

                if ($inDegrees[$neighbor] === 0) {
                    $queue[] = $neighbor;
                }
            }
        }

        // Check if topological sort is complete (no cycles)
        if (count($sorted) !== count($definition['nodes'])) {
            throw new Exception('Cannot sort workflow: graph contains cycles');
        }

        return $sorted;
    }

    /**
     * Get execution levels for parallel processing.
     *
     * Returns array where each element is a list of node IDs
     * that can be executed in parallel.
     *
     * @param array $definition
     * @return array - Array of arrays, each representing an execution level
     * @throws Exception
     */
    public function getExecutionLevels(array $definition): array
    {
        $sorted = $this->sort($definition);
        $graph = $this->buildGraph($definition);

        $levels = [];
        $nodeLevels = [];

        // Calculate levels for each node
        foreach ($sorted as $node) {
            $maxParentLevel = -1;

            // Find maximum level among parents
            foreach ($graph as $parentNode => $neighbors) {
                if (in_array($node, $neighbors) && isset($nodeLevels[$parentNode])) {
                    $maxParentLevel = max($maxParentLevel, $nodeLevels[$parentNode]);
                }
            }

            $level = $maxParentLevel + 1;
            $nodeLevels[$node] = $level;

            if (!isset($levels[$level])) {
                $levels[$level] = [];
            }

            $levels[$level][] = $node;
        }

        return array_values($levels);
    }

    /**
     * Get execution batches with dependency resolution.
     *
     * @param array $definition
     * @return array
     * @throws Exception
     */
    public function getExecutionBatches(array $definition): array
    {
        $levels = $this->getExecutionLevels($definition);

        return array_map(function ($level, $index) {
            return [
                'batch' => $index + 1,
                'nodes' => $level,
                'can_run_in_parallel' => count($level) > 1,
            ];
        }, $levels, array_keys($levels));
    }

    /**
     * Get critical path (longest path through the DAG).
     *
     * @param array $definition
     * @param array $nodeDurations - Array of node_id => duration in seconds
     * @return array - Array of node IDs in the critical path
     * @throws Exception
     */
    public function getCriticalPath(array $definition, array $nodeDurations = []): array
    {
        $levels = $this->getExecutionLevels($definition);
        $graph = $this->buildGraph($definition);

        if (empty($levels)) {
            return [];
        }

        // Calculate earliest start/finish times for each node
        $earliestStart = [];
        $earliestFinish = [];

        foreach ($levels as $levelNodes) {
            foreach ($levelNodes as $node) {
                $maxParentFinish = 0;

                // Find max finish time among parents
                foreach ($graph as $parentNode => $neighbors) {
                    if (in_array($node, $neighbors) && isset($earliestFinish[$parentNode])) {
                        $maxParentFinish = max($maxParentFinish, $earliestFinish[$parentNode]);
                    }
                }

                $duration = $nodeDurations[$node] ?? 0;
                $earliestStart[$node] = $maxParentFinish;
                $earliestFinish[$node] = $maxParentFinish + $duration;
            }
        }

        // Calculate latest start/finish times
        $latestFinish = [];
        $latestStart = [];

        $sorted = array_reverse($this->sort($definition));
        $maxFinish = max($earliestFinish);

        foreach ($sorted as $node) {
            $minChildStart = $maxFinish;

            // Find min start time among children
            foreach ($graph[$node] ?? [] as $childNode) {
                if (isset($latestStart[$childNode])) {
                    $minChildStart = min($minChildStart, $latestStart[$childNode]);
                }
            }

            $duration = $nodeDurations[$node] ?? 0;
            $latestFinish[$node] = $minChildStart;
            $latestStart[$node] = $minChildStart - $duration;
        }

        // Find nodes with zero slack (critical path)
        $criticalPath = [];
        foreach ($sorted as $node) {
            $slack = $latestStart[$node] - $earliestStart[$node];

            if ($slack === 0 || $slack < 0.01) { // Allow for floating point precision
                $criticalPath[] = $node;
            }
        }

        return array_reverse($criticalPath);
    }

    /**
     * Build adjacency list from definition.
     *
     * @param array $definition
     * @return array
     */
    private function buildGraph(array $definition): array
    {
        $graph = [];

        // Initialize all nodes
        foreach ($definition['nodes'] ?? [] as $node) {
            $graph[$node['id']] = [];
        }

        // Add edges
        foreach ($definition['edges'] ?? [] as $edge) {
            $source = $edge['source'];
            $target = $edge['target'];

            if (!isset($graph[$source])) {
                $graph[$source] = [];
            }

            $graph[$source][] = $target;
        }

        return $graph;
    }

    /**
     * Calculate in-degrees for all nodes.
     *
     * @param array $definition
     * @return array
     */
    private function calculateInDegrees(array $definition): array
    {
        $inDegrees = [];

        // Initialize all nodes with 0 in-degree
        foreach ($definition['nodes'] ?? [] as $node) {
            $inDegrees[$node['id']] = 0;
        }

        // Count in-degrees from edges
        foreach ($definition['edges'] ?? [] as $edge) {
            $target = $edge['target'];

            if (!isset($inDegrees[$target])) {
                $inDegrees[$target] = 0;
            }

            $inDegrees[$target]++;
        }

        return $inDegrees;
    }

    /**
     * Get nodes with 0 in-degree.
     *
     * @param array $inDegrees
     * @return array
     */
    private function getZeroInDegreeNodes(array $inDegrees): array
    {
        return array_keys(array_filter($inDegrees, fn($degree) => $degree === 0));
    }

    /**
     * Validate that a workflow is a DAG and can be sorted.
     *
     * @param array $definition
     * @return bool
     */
    public function isSortable(array $definition): bool
    {
        try {
            $this->sort($definition);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
}
