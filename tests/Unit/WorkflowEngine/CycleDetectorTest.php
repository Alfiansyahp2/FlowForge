<?php

use App\WorkflowEngine\CycleDetector;
use Tests\TestCase;

class CycleDetectorTest extends TestCase
{
    private CycleDetector $detector;

    protected function setUp(): void
    {
        parent::setUp();
        $this->detector = new CycleDetector();
    }

    /** @test */
    public function it_returns_false_for_empty_workflow(): void
    {
        $definition = ['nodes' => [], 'edges' => []];

        $this->assertFalse($this->detector->hasCycle($definition));
    }

    /** @test */
    public function it_returns_false_for_workflow_without_edges(): void
    {
        $definition = [
            'nodes' => [
                ['id' => '1', 'type' => 'http'],
                ['id' => '2', 'type' => 'delay'],
            ],
            'edges' => [],
        ];

        $this->assertFalse($this->detector->hasCycle($definition));
    }

    /** @test */
    public function it_returns_false_for_valid_dag(): void
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

        $this->assertFalse($this->detector->hasCycle($definition));
    }

    /** @test */
    public function it_detects_simple_cycle(): void
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

        $this->assertTrue($this->detector->hasCycle($definition));
    }

    /** @test */
    public function it_detects_complex_cycle(): void
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
                ['source' => 'C', 'target' => 'A'],
            ],
        ];

        $this->assertTrue($this->detector->hasCycle($definition));
    }

    /** @test */
    public function it_detects_self_loop(): void
    {
        $definition = [
            'nodes' => [
                ['id' => 'A', 'type' => 'http'],
            ],
            'edges' => [
                ['source' => 'A', 'target' => 'A'],
            ],
        ];

        $this->assertTrue($this->detector->hasCycle($definition));
    }

    /** @test */
    public function it_returns_false_for_parallel_execution(): void
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

        $this->assertFalse($this->detector->hasCycle($definition));
    }

    /** @test */
    public function it_gets_cycles_info(): void
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

        $cycles = $this->detector->getCycles($definition);

        $this->assertNotEmpty($cycles);
        $this->assertIsArray($cycles);
    }

    /** @test */
    public function it_validates_workflow_without_throwing_for_valid_dag(): void
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

        $this->expectNotToPerformAssertions();

        $this->detector->validate($definition);
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
        $this->expectExceptionMessage('Workflow contains circular dependencies');

        $this->detector->validate($definition);
    }
}
