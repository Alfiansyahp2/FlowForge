<?php

use App\WorkflowEngine\WorkflowValidator;
use App\WorkflowEngine\CycleDetector;
use Tests\TestCase;

class WorkflowValidatorTest extends TestCase
{
    private WorkflowValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $cycleDetector = new CycleDetector();
        $this->validator = new WorkflowValidator($cycleDetector);
    }

    /** @test */
    public function it_validates_correct_workflow(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://api.example.com', 'method' => 'POST']],
                ['id' => '2', 'type' => 'delay', 'data' => ['seconds' => 5]],
            ],
            'edges' => [
                ['source' => '1', 'target' => '2'],
            ],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertEmpty($errors);
    }

    /** @test */
    public function it_detects_missing_nodes_array(): void
    {
        $definition = ['edges' => []];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertContains('Workflow must have a nodes array', $errors);
    }

    /** @test */
    public function it_detects_missing_edges_array(): void
    {
        $definition = ['nodes' => []];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertContains('Workflow must have an edges array', $errors);
    }

    /** @test */
    public function it_detects_empty_nodes(): void
    {
        $definition = [
            'nodes' => [],
            'edges' => [],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertContains('Workflow must have at least one node', $errors);
    }

    /** @test */
    public function it_detects_node_without_id(): void
    {
        $definition = [
            'nodes' => [
                ['type' => 'http'],
            ],
            'edges' => [],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('missing required field: id', $errors[0]);
    }

    /** @test */
    public function it_detects_node_without_type(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1'],
            ],
            'edges' => [],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString("missing required field: type", $errors[0]);
    }

    /** @test */
    public function it_detects_unsupported_node_type(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'unsupported_type'],
            ],
            'edges' => [],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('has unsupported type', $errors[0]);
    }

    /** @test */
    public function it_detects_duplicate_node_ids(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http'],
                ['id' => '1', 'type' => 'delay'],
            ],
            'edges' => [],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertNotEmpty(array_filter($errors, fn($e) => str_contains($e, 'Duplicate node ID')));
    }

    /** @test */
    public function it_detects_missing_required_data_for_http_node(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com']],
            ],
            'edges' => [],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('missing required data field: method', $errors[0]);
    }

    /** @test */
    public function it_detects_missing_required_data_for_delay_node(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'delay', 'data' => []],
            ],
            'edges' => [],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('missing required data field: seconds', $errors[0]);
    }

    /** @test */
    public function it_detects_edge_without_source(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com', 'method' => 'GET']],
            ],
            'edges' => [
                ['target' => '1'],
            ],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('missing required field: source', $errors[0]);
    }

    /** @test */
    public function it_detects_edge_without_target(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com', 'method' => 'GET']],
            ],
            'edges' => [
                ['source' => '1'],
            ],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('missing required field: target', $errors[0]);
    }

    /** @test */
    public function it_detects_self_reference_edge(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com', 'method' => 'GET']],
            ],
            'edges' => [
                ['source' => '1', 'target' => '1'],
            ],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('cannot have same source and target', $errors[0]);
    }

    /** @test */
    public function it_detects_reference_to_non_existent_source_node(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com', 'method' => 'GET']],
            ],
            'edges' => [
                ['source' => 'non_existent', 'target' => '1'],
            ],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('non-existent source node', $errors[0]);
    }

    /** @test */
    public function it_detects_reference_to_non_existent_target_node(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com', 'method' => 'GET']],
            ],
            'edges' => [
                ['source' => '1', 'target' => 'non_existent'],
            ],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('non-existent target node', $errors[0]);
    }

    /** @test */
    public function it_detects_cycles(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com', 'method' => 'GET']],
                ['id' => '2', 'type' => 'delay', 'data' => ['seconds' => 5]],
            ],
            'edges' => [
                ['source' => '1', 'target' => '2'],
                ['source' => '2', 'target' => '1'],
            ],
        ];

        $errors = $this->validator->validate($definition);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('circular dependencies', $errors[0]);
    }

    /** @test */
    public function it_returns_is_valid_true_for_valid_workflow(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com', 'method' => 'GET']],
                ['id' => '2', 'type' => 'delay', 'data' => ['seconds' => 5]],
            ],
            'edges' => [
                ['source' => '1', 'target' => '2'],
            ],
        ];

        $this->assertTrue($this->validator->isValid($definition));
    }

    /** @test */
    public function it_returns_is_valid_false_for_invalid_workflow(): void
    {
        $definition = [
            'nodes' => [],
            'edges' => [],
        ];

        $this->assertFalse($this->validator->isValid($definition));
    }

    /** @test */
    public function it_validates_or_fail_succeeds_for_valid_workflow(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http', 'data' => ['url' => 'https://example.com', 'method' => 'GET']],
            ],
            'edges' => [],
        ];

        $this->expectNotToPerformAssertions();

        $this->validator->validateOrFail($definition);
    }

    /** @test */
    public function it_validates_or_fail_throws_for_invalid_workflow(): void
    {
        $definition = [
            'nodes' => [],
            'edges' => [],
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Workflow validation failed');

        $this->validator->validateOrFail($definition);
    }
}
