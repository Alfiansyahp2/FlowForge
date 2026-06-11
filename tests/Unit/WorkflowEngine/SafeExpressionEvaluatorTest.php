<?php

use App\WorkflowEngine\SafeExpressionEvaluator;
use Tests\TestCase;

class SafeExpressionEvaluatorTest extends TestCase
{
    private SafeExpressionEvaluator $evaluator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->evaluator = new SafeExpressionEvaluator();
    }

    /** @test */
    public function it_evaluates_simple_equality(): void
    {
        $result = $this->evaluator->evaluate('5 == 5');
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_inequality(): void
    {
        $result = $this->evaluator->evaluate('5 != 3');
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_greater_than(): void
    {
        $result = $this->evaluator->evaluate('10 > 5');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('3 > 10');
        $this->assertFalse($result);
    }

    /** @test */
    public function it_evaluates_less_than(): void
    {
        $result = $this->evaluator->evaluate('3 < 10');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('10 < 3');
        $this->assertFalse($result);
    }

    /** @test */
    public function it_evaluates_greater_than_or_equal(): void
    {
        $result = $this->evaluator->evaluate('5 >= 5');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('10 >= 3');
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_less_than_or_equal(): void
    {
        $result = $this->evaluator->evaluate('5 <= 5');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('3 <= 10');
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_logical_and(): void
    {
        $result = $this->evaluator->evaluate('true && true');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('true && false');
        $this->assertFalse($result);
    }

    /** @test */
    public function it_evaluates_logical_or(): void
    {
        $result = $this->evaluator->evaluate('true || false');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('false || false');
        $this->assertFalse($result);
    }

    /** @test */
    public function it_evaluates_logical_not(): void
    {
        $result = $this->evaluator->evaluate('!true');
        $this->assertFalse($result);

        $result = $this->evaluator->evaluate('!false');
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_complex_expressions(): void
    {
        $result = $this->evaluator->evaluate('(5 > 3) && (10 < 20)');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('(5 > 3) && (10 > 20)');
        $this->assertFalse($result);
    }

    /** @test */
    public function it_evaluates_with_variables(): void
    {
        $variables = ['status' => 200, 'count' => 5];

        $result = $this->evaluator->evaluate('{status} == 200', $variables);
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('{count} > 3', $variables);
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('{status} == 200 && {count} > 3', $variables);
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_string_variables(): void
    {
        $variables = ['environment' => 'production', 'status' => 'active'];

        $result = $this->evaluator->evaluate('{environment} == "production"', $variables);
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('{status} == "active"', $variables);
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_boolean_variables(): void
    {
        $variables = ['is_admin' => true, 'is_banned' => false];

        $result = $this->evaluator->evaluate('{is_admin} == true', $variables);
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('{is_banned} == false', $variables);
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('{is_admin} && !{is_banned}', $variables);
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_null_variables(): void
    {
        $variables = ['deleted_at' => null, 'created_at' => '2025-01-01'];

        $result = $this->evaluator->evaluate('isset({deleted_at})', $variables);
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('is_null({deleted_at})', $variables);
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('empty({deleted_at})', $variables);
        $this->assertTrue($result);
    }

    /** @test */
    public function it_prevents_code_injection(): void
    {
        $variables = ['input' => 'malicious'];

        // This should NOT execute code, it should just evaluate the expression
        $result = $this->evaluator->evaluate('{input} == "malicious"', $variables);
        $this->assertTrue($result);

        // Attempting to inject code should fail safely
        $this->expectException(\Exception::class);
        $this->evaluator->evaluate('system("ls")', $variables);
    }

    /** @test */
    public function it_handles_parentheses_correctly(): void
    {
        $result = $this->evaluator->evaluate('((5 > 3) && (10 < 20)) || (false)');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('(5 > 3) && ((10 < 20) || false)');
        $this->assertTrue($result);
    }

    /** @test */
    public function it_evaluates_math_expressions(): void
    {
        $result = $this->evaluator->evaluate('10 + 5 > 12');
        $this->assertTrue($result);

        $result = $this->evaluator->evaluate('2 * 3 == 6');
        $this->assertTrue($result);
    }
}