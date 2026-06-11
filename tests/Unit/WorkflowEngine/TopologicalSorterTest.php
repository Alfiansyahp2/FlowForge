<?php

use App\WorkflowEngine\TopologicalSorter;
use Tests\TestCase;

class TopologicalSorterTest extends TestCase
{
    private TopologicalSorter $sorter;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sorter = new TopologicalSorter();
    }

    /** @test */
    public function it_returns_empty_array_for_empty_workflow(): void
    {
        $definition = ['nodes' => [], 'edges' => []];

        $result = $this->sorter->sort($definition);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    /** @test */
    public function it_returns_single_node_for_workflow_without_edges(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
            ],
            'edges' => [],
        ];

        $result = $this->sorter->sort($definition);

        $this->assertEquals(['A'], $result);
    }

    /** @test */
    public function it_sorts_simple_linear_workflow(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
                ['id' => 'C', 'type' => 'condition'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'B', 'target' => 'C'],
            ],
        ];

        $result = $this->sorter->sort($definition);

        $this->assertEquals(['A', 'B', 'C'], $result);
    }

    /** @test */
    public function it_handles_complex_dag_with_multiple_dependencies(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
                ['id' => 'C', 'type' => 'condition'],
                ['id' => 'D', 'type' => 'http'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'A', 'target' => 'C'],
                ['source' => 'B', 'target' => 'D'],
                ['source' => 'C', 'target' => 'D'],
            ],
        ];

        $result = $this->sorter->sort($definition);

        // A must come first
        $this->assertEquals('A', $result[0]);

        // B and C must come after A but before D
        $this->assertContains('B', $result);
        $this->assertContains('C', $result);
        $bIndex = array_search('B', $result);
        $cIndex = array_search('C', $result);
        $this->assertGreaterThan(0, $bIndex);
        $this->assertGreaterThan(0, $cIndex);

        // D must come last
        $this->assertEquals('D', $result[3]);
    }

    /** @test */
    public function it_throws_exception_for_workflow_with_cycle(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'B', 'target' => 'A'],
            ],
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('graph contains cycles');

        $this->sorter->sort($definition);
    }

    /** @test */
    public function it_gets_execution_levels(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
                ['id' => 'C', 'type' => 'condition'],
                ['id' => 'D', 'type' => 'http'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'A', 'target' => 'C'],
                ['source' => 'B', 'target' => 'D'],
                ['source' => 'C', 'target' => 'D'],
            ],
        ];

        $levels = $this->sorter->getExecutionLevels($definition);

        // Level 0: A (no dependencies)
        $this->assertContains('A', $levels[0]);
        $this->assertCount(1, $levels[0]);

        // Level 1: B, C (depend on A)
        $this->assertContains('B', $levels[1]);
        $this->assertContains('C', $levels[1]);
        $this->assertCount(2, $levels[1]);

        // Level 2: D (depends on B and C)
        $this->assertContains('D', $levels[2]);
        $this->assertCount(1, $levels[2]);
    }

    /** @test */
    public function it_gets_execution_batches(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
                ['id' => 'C', 'type' => 'condition'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'B', 'target' => 'C'],
            ],
        ];

        $batches = $this->sorter->getExecutionBatches($definition);

        $this->assertCount(3, $batches);
        $this->assertEquals(1, $batches[0]['batch']);
        $this->assertEquals(['A'], $batches[0]['nodes']);
        $this->assertFalse($batches[0]['can_run_in_parallel']);

        $this->assertEquals(2, $batches[1]['batch']);
        $this->assertEquals(['B'], $batches[1]['nodes']);
        $this->assertFalse($batches[1]['can_run_in_parallel']);
    }

    /** @test */
    public function it_identifies_parallel_execution_in_batches(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
                ['id' => 'C', 'type' => 'condition'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'A', 'target' => 'C'],
            ],
        ];

        $batches = $this->sorter->getExecutionBatches($definition);

        // Second batch can run in parallel
        $this->assertTrue($batches[1]['can_run_in_parallel']);
        $this->assertCount(2, $batches[1]['nodes']);
    }

    /** @test */
    public function it_calculates_critical_path(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
                ['id' => 'C', 'type' => 'condition'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'B', 'target' => 'C'],
            ],
        ];

        $durations = [
            'A' => 5,
            'B' => 10,
            'C' => 5,
        ];

        $criticalPath = $this->sorter->getCriticalPath($definition, $durations);

        // Critical path should be A -> B -> C (total: 20)
        $this->assertEquals(['A', 'B', 'C'], $criticalPath);
    }

    /** @test */
    public function it_identifies_critical_path_in_parallel_workflow(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
                ['id' => 'C', 'type' => 'condition'],
                ['id' => 'D', 'type' => 'http'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'A', 'target' => 'C'],
                ['source' => 'B', 'target' => 'D'],
                ['source' => 'C', 'target' => 'D'],
            ],
        ];

        $durations = [
            'A' => 5,
            'B' => 15,  // Longer path
            'C' => 5,
            'D' => 5,
        ];

        $criticalPath = $this->sorter->getCriticalPath($definition, $durations);

        // Critical path should be A -> B -> D (total: 25)
        $this->assertContains('A', $criticalPath);
        $this->assertContains('B', $criticalPath);
        $this->assertContains('D', $criticalPath);
    }

    /** @test */
    public function it_returns_is_sortable_true_for_valid_dag(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
            ],
        ];

        $this->assertTrue($this->sorter->isSortable($definition));
    }

    /** @test */
    public function it_returns_is_sortable_false_for_workflow_with_cycle(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                ['source' => 'B', 'target' => 'A'],
            ],
        ];

        $this->assertFalse($this->sorter->isSortable($definition));
    }

    /** @test */
    public function it_handles_workflow_with_disconnected_components(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
                ['id' => 'B', 'type' => 'delay'],
                ['id' => 'C', 'type' => 'condition'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'B'],
                // C is disconnected
            ],
        ];

        $result = $this->sorter->sort($definition);

        $this->assertCount(3, $result);
        $this->assertContains('A', $result);
        $this->assertContains('B', $result);
        $this->assertContains('C', $result);
    }
}
