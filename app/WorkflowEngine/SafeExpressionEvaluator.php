<?php

namespace App\WorkflowEngine;

use Exception;

/**
 * Safe Expression Evaluator
 *
 * Evaluates conditional expressions without using eval() for security.
 * Supports basic comparison and logical operations.
 */
class SafeExpressionEvaluator
{
    /**
     * Evaluate a conditional expression safely.
     *
     * Supported operators: ==, !=, >, <, >=, <=, &&, ||, !
     * Supported functions: isset(), empty(), is_null()
     *
     * @param string $expression
     * @param array $variables
     * @return bool
     * @throws Exception
     */
    public function evaluate(string $expression, array $variables = []): bool
    {
        // Replace variables in expression
        $expression = $this->replaceVariables($expression, $variables);

        // Tokenize and parse the expression
        $tokens = $this->tokenize($expression);
        $result = $this->parseExpression($tokens);

        return (bool) $result;
    }

    /**
     * Replace variables in expression with their values.
     *
     * @param string $expression
     * @param array $variables
     * @return string
     */
    private function replaceVariables(string $expression, array $variables): string
    {
        foreach ($variables as $key => $value) {
            // Support both {key} and $key formats
            $expression = str_replace("{{$key}}", $this->valueToString($value), $expression);
            $expression = str_replace("{$key}", $this->valueToString($value), $expression);
        }

        return $expression;
    }

    /**
     * Convert value to string representation.
     *
     * @param mixed $value
     * @return string
     */
    private function valueToString($value): string
    {
        if ($value === null) {
            return 'null';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_string($value)) {
            return '"' . addslashes($value) . '"';
        }

        if (is_numeric($value)) {
            return (string) $value;
        }

        if (is_array($value)) {
            return 'array';
        }

        return 'null';
    }

    /**
     * Tokenize expression into tokens.
     *
     * @param string $expression
     * @return array
     * @throws Exception
     */
    private function tokenize(string $expression): array
    {
        // Remove whitespace
        $expression = preg_replace('/\s+/', ' ', trim($expression));

        if (empty($expression)) {
            throw new Exception('Empty expression');
        }

        // Tokenize using regex
        $pattern = '/(
            \&\&|\|\||>=|<=|==|!=|>|<|!         # Operators
            |true|false|null                     # Literals
            |"[^"]*"                             # Strings
            |[\-]?\d+\.?\d*                      # Numbers
            |\w+                                 # Identifiers
            |\(|\)                               # Parentheses
            |\S                                  # Other single chars
        )/x';

        preg_match_all($pattern, $expression, $matches);
        $tokens = array_filter($matches[0], fn($token) => trim($token) !== '');

        return array_values($tokens);
    }

    /**
     * Parse expression tokens and evaluate.
     *
     * @param array $tokens
     * @param int $precedence
     * @return mixed
     * @throws Exception
     */
    private function parseExpression(array &$tokens, int $precedence = 0)
    {
        if (empty($tokens)) {
            throw new Exception('Invalid expression: no tokens');
        }

        // Get left operand
        $left = $this->parsePrimary($tokens);

        // Process operators with proper precedence
        while (!empty($tokens)) {
            $operator = $tokens[0];
            $opPrecedence = $this->getOperatorPrecedence($operator);

            if ($opPrecedence < $precedence) {
                break;
            }

            array_shift($tokens); // Consume operator

            // Get right operand with higher precedence
            $right = $this->parseExpression($tokens, $opPrecedence + 1);

            // Evaluate operation
            $left = $this->evaluateOperation($left, $operator, $right);
        }

        return $left;
    }

    /**
     * Parse primary expression (literals, variables, parenthesized expressions).
     *
     * @param array $tokens
     * @return mixed
     * @throws Exception
     */
    private function parsePrimary(array &$tokens)
    {
        if (empty($tokens)) {
            throw new Exception('Unexpected end of expression');
        }

        $token = array_shift($tokens);

        // Handle parentheses
        if ($token === '(') {
            $result = $this->parseExpression($tokens);

            if (empty($tokens) || array_shift($tokens) !== ')') {
                throw new Exception('Missing closing parenthesis');
            }

            return $result;
        }

        // Handle NOT operator
        if ($token === '!') {
            $operand = $this->parsePrimary($tokens);
            return !$this->toBoolean($operand);
        }

        // Handle literals
        if ($token === 'true') return true;
        if ($token === 'false') return false;
        if ($token === 'null') return null;

        // Handle strings
        if (str_starts_with($token, '"') && str_ends_with($token, '"')) {
            return substr($token, 1, -1);
        }

        // Handle numbers
        if (is_numeric($token)) {
            return strpos($token, '.') !== false ? (float) $token : (int) $token;
        }

        // Handle functions
        if ($token === 'isset(' || $token === 'empty(' || $token === 'is_null(') {
            return $this->evaluateFunction($token, $tokens);
        }

        throw new Exception("Unknown token: {$token}");
    }

    /**
     * Evaluate built-in functions.
     *
     * @param string $function
     * @param array $tokens
     * @return mixed
     * @throws Exception
     */
    private function evaluateFunction(string $function, array &$tokens)
    {
        $operand = $this->parseExpression($tokens);

        if (empty($tokens) || array_shift($tokens) !== ')') {
            throw new Exception("Missing closing parenthesis for {$function}");
        }

        switch ($function) {
            case 'isset(':
                return $operand !== null;
            case 'empty(':
                return empty($operand);
            case 'is_null(':
                return $operand === null;
            default:
                throw new Exception("Unknown function: {$function}");
        }
    }

    /**
     * Get operator precedence.
     *
     * @param string $operator
     * @return int
     */
    private function getOperatorPrecedence(string $operator): int
    {
        $precedence = [
            '||' => 1,
            '&&' => 2,
            '==' => 3, '!=' => 3,
            '>' => 4, '<' => 4, '>=' => 4, '<=' => 4,
        ];

        return $precedence[$operator] ?? 0;
    }

    /**
     * Evaluate operation.
     *
     * @param mixed $left
     * @param string $operator
     * @param mixed $right
     * @return mixed
     * @throws Exception
     */
    private function evaluateOperation($left, string $operator, $right)
    {
        switch ($operator) {
            case '==':
                return $left == $right;
            case '!=':
                return $left != $right;
            case '>':
                return $left > $right;
            case '<':
                return $left < $right;
            case '>=':
                return $left >= $right;
            case '<=':
                return $left <= $right;
            case '&&':
                return $this->toBoolean($left) && $this->toBoolean($right);
            case '||':
                return $this->toBoolean($left) || $this->toBoolean($right);
            default:
                throw new Exception("Unknown operator: {$operator}");
        }
    }

    /**
     * Convert value to boolean.
     *
     * @param mixed $value
     * @return bool
     */
    private function toBoolean($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return $value != 0;
        }

        if (is_string($value)) {
            return strtolower($value) === 'true' || $value !== '';
        }

        return !empty($value);
    }
}