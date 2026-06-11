<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\WorkflowEngine\WorkflowValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class AIWorkflowController extends Controller
{
    private WorkflowValidator $validator;

    public function __construct(WorkflowValidator $validator)
    {
        $this->validator = $validator;
    }

    /**
     * Generate workflow DAG from natural language description.
     */
    public function generate(Request $request): JsonResponse
    {
        $request->validate([
            'prompt' => ['required', 'string', 'max:1000'],
        ]);

        $prompt = $request->input('prompt');
        $apiKey = env('AI_API_KEY', env('OPENAI_API_KEY'));

        try {
            if ($apiKey) {
                $definition = $this->generateWithLLM($prompt, $apiKey);
            } else {
                Log::info('AI_API_KEY / OPENAI_API_KEY not set. Using local semantic parser fallback.');
                $definition = $this->generateWithLocalFallback($prompt);
            }

            // Clean up Markdown formatting if any remains
            if (is_string($definition)) {
                $definition = $this->cleanJsonString($definition);
                $definition = json_decode($definition, true);
            }

            if (!is_array($definition)) {
                throw new Exception("LLM returned non-JSON output");
            }

            // Ensure schema compatibility and validate
            $errors = $this->validator->validate($definition);
            if (!empty($errors)) {
                return response()->json([
                    'error' => 'Generated workflow failed validation',
                    'errors' => $errors,
                    'definition' => $definition,
                ], 422);
            }

            return response()->json([
                'success' => true,
                'definition' => $definition,
            ]);

        } catch (Exception $e) {
            Log::error('AI Workflow generation failed', [
                'prompt' => $prompt,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to generate workflow from prompt',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Call LLM API (OpenAI-compatible) to generate DAG.
     */
    private function generateWithLLM(string $userPrompt, string $apiKey): array
    {
        $systemPrompt = <<<PROMPT
You are a Staff Workflow Systems Architect. Your job is to translate a user's natural language request into a valid Workflow DAG (Directed Acyclic Graph) JSON structure.
You MUST output raw JSON ONLY. No markdown block wrapper, no explanations, no HTML.

Supported Node Types & Data Schema:
1. HTTP Request Node:
   - type: "http"
   - data: { "url": "string (URL)", "method": "GET|POST|PUT|PATCH|DELETE", "timeout": 30 }
2. Delay Node:
   - type: "delay"
   - data: { "seconds": integer }
3. Condition Node (evaluates an expression):
   - type: "condition"
   - data: { "expression": "string (e.g. 'http-1.status == 200')" }
4. Notification Node:
   - type: "notification"
   - data: { "message": "string (message content)" }

Output format:
{
  "nodes": [
    { "id": "node-id-unique", "type": "http|delay|condition|notification", "data": { ... } }
  ],
  "edges": [
    { "source": "node-id-unique", "target": "node-id-unique" }
  ]
}

Make sure there are NO cycles (no loops) in the edges.
PROMPT;

        $baseUrl = env('AI_BASE_URL', 'https://api.openai.com/v1');
        $model = env('AI_MODEL', 'gpt-3.5-turbo');

        $response = Http::withToken($apiKey)
            ->timeout(30)
            ->post(rtrim($baseUrl, '/') . '/chat/completions', [
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt],
                ],
                'temperature' => 0.1,
                'max_tokens' => 1500,
            ]);

        if ($response->failed()) {
            throw new Exception("LLM API call failed: " . $response->body());
        }

        $content = $response->json('choices.0.message.content');
        $cleanJson = $this->cleanJsonString($content);

        return json_decode($cleanJson, true);
    }

    /**
     * Local semantic parser for matching simple workflows when API key is missing.
     */
    private function generateWithLocalFallback(string $prompt): array
    {
        $nodes = [];
        $edges = [];
        $lowerPrompt = strtolower($prompt);

        // Detect HTTP node
        if (str_contains($lowerPrompt, 'http') || str_contains($lowerPrompt, 'api') || str_contains($lowerPrompt, 'payment') || str_contains($lowerPrompt, 'call')) {
            $nodes[] = [
                'id' => 'http-1',
                'type' => 'http',
                'data' => [
                    'url' => 'https://api.example.com/payment',
                    'method' => 'POST',
                    'timeout' => 30,
                ],
            ];
        }

        // Detect Condition node
        if (str_contains($lowerPrompt, 'if') || str_contains($lowerPrompt, 'check') || str_contains($lowerPrompt, 'condition') || str_contains($lowerPrompt, 'succeed')) {
            $nodes[] = [
                'id' => 'condition-1',
                'type' => 'condition',
                'data' => [
                    'expression' => 'http-1.status == 200',
                ],
            ];
        }

        // Detect Delay node
        if (str_contains($lowerPrompt, 'delay') || str_contains($lowerPrompt, 'wait') || str_contains($lowerPrompt, 'minute') || str_contains($lowerPrompt, 'second')) {
            // Try to extract minutes/seconds
            $seconds = 300; // 5 mins default
            if (preg_match('/(\d+)\s*minute/', $lowerPrompt, $m)) {
                $seconds = (int)$m[1] * 60;
            } elseif (preg_match('/(\d+)\s*second/', $lowerPrompt, $m)) {
                $seconds = (int)$m[1];
            }

            $nodes[] = [
                'id' => 'delay-1',
                'type' => 'delay',
                'data' => [
                    'seconds' => $seconds,
                ],
            ];
        }

        // Detect Notification node
        if (str_contains($lowerPrompt, 'notify') || str_contains($lowerPrompt, 'email') || str_contains($lowerPrompt, 'send') || str_contains($lowerPrompt, 'message')) {
            $nodes[] = [
                'id' => 'notify-1',
                'type' => 'notification',
                'data' => [
                    'message' => 'Workflow complete! NLP Prompt: ' . substr($prompt, 0, 50),
                ],
            ];
        }

        // Ensure at least one node is created
        if (empty($nodes)) {
            $nodes[] = [
                'id' => 'notify-1',
                'type' => 'notification',
                'data' => [
                    'message' => 'NLP workflow generated: ' . $prompt,
                ],
            ];
        }

        // Build simple linear chain edges
        for ($i = 0; $i < count($nodes) - 1; $i++) {
            $edges[] = [
                'source' => $nodes[$i]['id'],
                'target' => $nodes[$i + 1]['id'],
            ];
        }

        return [
            'nodes' => $nodes,
            'edges' => $edges,
        ];
    }

    /**
     * Clean markdown blocks from LLM output.
     */
    private function cleanJsonString(string $string): string
    {
        $string = trim($string);
        // Strip markdown backticks
        if (str_starts_with($string, '```')) {
            $string = preg_replace('/^```(json)?/', '', $string);
            $string = preg_replace('/```$/', '', $string);
            $string = trim($string);
        }
        return $string;
    }
}
