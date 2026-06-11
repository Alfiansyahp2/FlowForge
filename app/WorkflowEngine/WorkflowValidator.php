<?php

namespace App\WorkflowEngine;

use Exception;
use App\WorkflowEngine\CycleDetector;

class WorkflowValidator
{
    private CycleDetector $cycleDetector;

    // Supported node types
    private const SUPPORTED_NODE_TYPES = [
        'http',
        'delay',
        'condition',
        'math',
        'notification',
    ];

    // Required fields per node type
    private const REQUIRED_NODE_FIELDS = [
        'http' => ['url', 'method'],
        'delay' => ['seconds'],
        'condition' => ['expression'],
        'math' => ['expression'],
        'notification' => ['message'],
    ];

    public function __construct(CycleDetector $cycleDetector)
    {
        $this->cycleDetector = $cycleDetector;
    }

    /**
     * Validate complete workflow definition.
     *
     * @param array $definition
     * @return array - Returns array of errors (empty if valid)
     */
    public function validate(array $definition): array
    {
        $errors = [];

        // Validate structure
        if (!isset($definition['nodes']) || !is_array($definition['nodes'])) {
            $errors[] = 'Workflow must have a nodes array';
            return $errors;
        }

        if (!isset($definition['edges']) || !is_array($definition['edges'])) {
            $errors[] = 'Workflow must have an edges array';
            return $errors;
        }

        // Validate nodes
        $errors = array_merge($errors, $this->validateNodes($definition));

        // Validate edges
        $errors = array_merge($errors, $this->validateEdges($definition));

        // Validate node references in edges
        $errors = array_merge($errors, $this->validateNodeReferences($definition));

        // Check for cycles if no structural errors
        if (empty($errors)) {
            try {
                $this->cycleDetector->validate($definition);
            } catch (Exception $e) {
                $errors[] = $e->getMessage();
            }
        }

        return $errors;
    }

    /**
     * Validate nodes array.
     *
     * @param array $definition
     * @return array
     */
    private function validateNodes(array $definition): array
    {
        $errors = [];
        $nodeIds = [];

        if (empty($definition['nodes'])) {
            $errors[] = 'Workflow must have at least one node';
            return $errors;
        }

        foreach ($definition['nodes'] as $index => $node) {
            // Check required fields
            if (!isset($node['id'])) {
                $errors[] = "Node at index {$index} missing required field: id";
                continue;
            }

            if (!isset($node['type'])) {
                $errors[] = "Node '{$node['id']}' missing required field: type";
                continue;
            }

            // Check for duplicate IDs
            if (in_array($node['id'], $nodeIds)) {
                $errors[] = "Duplicate node ID: '{$node['id']}'";
            }
            $nodeIds[] = $node['id'];

            // Validate node type
            if (!in_array($node['type'], self::SUPPORTED_NODE_TYPES)) {
                $errors[] = "Node '{$node['id']}' has unsupported type: '{$node['type']}'. " .
                    "Supported types: " . implode(', ', self::SUPPORTED_NODE_TYPES);
                continue;
            }

            // Validate required fields for node type
            $requiredFields = self::REQUIRED_NODE_FIELDS[$node['type']] ?? [];
            foreach ($requiredFields as $field) {
                if (!isset($node['data'][$field])) {
                    $errors[] = "Node '{$node['id']}' (type: {$node['type']}) missing required data field: {$field}";
                }
            }
        }

        return $errors;
    }

    /**
     * Validate edges array.
     *
     * @param array $definition
     * @return array
     */
    private function validateEdges(array $definition): array
    {
        $errors = [];

        foreach ($definition['edges'] as $index => $edge) {
            // Check required fields
            if (!isset($edge['source'])) {
                $errors[] = "Edge at index {$index} missing required field: source";
            }

            if (!isset($edge['target'])) {
                $errors[] = "Edge at index {$index} missing required field: target";
            }

            // Source and target must be different
            if (isset($edge['source']) && isset($edge['target']) && $edge['source'] === $edge['target']) {
                $errors[] = "Edge at index {$index} cannot have same source and target: '{$edge['source']}'";
            }
        }

        return $errors;
    }

    /**
     * Validate that all edge references point to existing nodes.
     *
     * @param array $definition
     * @return array
     */
    private function validateNodeReferences(array $definition): array
    {
        $errors = [];
        $nodeIds = array_column($definition['nodes'], 'id');

        foreach ($definition['edges'] as $index => $edge) {
            if (isset($edge['source']) && !in_array($edge['source'], $nodeIds)) {
                $errors[] = "Edge at index {$index} references non-existent source node: '{$edge['source']}'";
            }

            if (isset($edge['target']) && !in_array($edge['target'], $nodeIds)) {
                $errors[] = "Edge at index {$index} references non-existent target node: '{$edge['target']}'";
            }
        }

        return $errors;
    }

    /**
     * Check if workflow definition is valid.
     *
     * @param array $definition
     * @return bool
     */
    public function isValid(array $definition): bool
    {
        return empty($this->validate($definition));
    }

    /**
     * Validate and throw exception if invalid.
     *
     * @param array $definition
     * @return void
     * @throws Exception
     */
    public function validateOrFail(array $definition): void
    {
        $errors = $this->validate($definition);

        if (!empty($errors)) {
            throw new Exception('Workflow validation failed: ' . implode(', ', $errors));
        }
    }
}
