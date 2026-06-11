<?php

namespace App\WorkflowEngine;

use Exception;

class CycleDetector
{
    /**
     * Detect if a workflow definition contains cycles.
     *
     * @param array $definition
     * @return bool
     */
    public function hasCycle(array $definition): bool
    {
        if (empty($definition['edges'])) {
            return false;
        }

        // Build adjacency list
        $graph = $this->buildGraph($definition);

        // Use DFS to detect cycles
        $visited = [];
        $recursionStack = [];

        foreach ($graph as $node => $neighbors) {
            if (!isset($visited[$node])) {
                if ($this->hasCycleUtil($node, $graph, $visited, $recursionStack)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get all nodes involved in cycles.
     *
     * @param array $definition
     * @return array
     */
    public function getCycles(array $definition): array
    {
        if (empty($definition['edges'])) {
            return [];
        }

        $graph = $this->buildGraph($definition);
        $cycles = [];
        $visited = [];
        $path = [];

        foreach ($graph as $node => $neighbors) {
            if (!isset($visited[$node])) {
                $this->findCyclesUtil($node, $graph, $visited, $path, $cycles);
            }
        }

        return $cycles;
    }

    /**
     * Validate workflow and throw exception if cycles found.
     *
     * @param array $definition
     * @return void
     * @throws Exception
     */
    public function validate(array $definition): void
    {
        if ($this->hasCycle($definition)) {
            $cycles = $this->getCycles($definition);
            throw new Exception(
                'Workflow contains circular dependencies. Cycles detected: ' .
                json_encode($cycles)
            );
        }
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
            if (!isset($graph[$target])) {
                $graph[$target] = [];
            }

            $graph[$source][] = $target;
        }

        return $graph;
    }

    /**
     * DFS utility to detect cycles.
     *
     * @param string $node
     * @param array $graph
     * @param array &$visited
     * @param array &$recursionStack
     * @return bool
     */
    private function hasCycleUtil(string $node, array $graph, array &$visited, array &$recursionStack): bool
    {
        if (!isset($visited[$node])) {
            $visited[$node] = true;
            $recursionStack[$node] = true;

            foreach ($graph[$node] ?? [] as $neighbor) {
                if (!isset($visited[$neighbor])) {
                    if ($this->hasCycleUtil($neighbor, $graph, $visited, $recursionStack)) {
                        return true;
                    }
                } elseif (isset($recursionStack[$neighbor])) {
                    return true;
                }
            }

            unset($recursionStack[$node]);
        }

        return false;
    }

    /**
     * DFS utility to find all cycles.
     *
     * @param string $node
     * @param array $graph
     * @param array &$visited
     * @param array $path
     * @param array &$cycles
     * @return void
     */
    private function findCyclesUtil(string $node, array $graph, array &$visited, array $path, array &$cycles): void
    {
        $visited[$node] = true;
        $path[] = $node;

        foreach ($graph[$node] ?? [] as $neighbor) {
            if (!isset($visited[$neighbor])) {
                $this->findCyclesUtil($neighbor, $graph, $visited, $path, $cycles);
            } elseif (in_array($neighbor, $path)) {
                // Found a cycle
                $cycleStart = array_search($neighbor, $path);
                $cycle = array_slice($path, $cycleStart);
                $cycle[] = $neighbor;
                $cycles[] = $cycle;
            }
        }
    }
}
