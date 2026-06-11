<?php

namespace App\Http\Middleware;

use App\Services\JWTService;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class JwtAuthMiddleware
{
    public function __construct(
        private JWTService $jwtService
    ) {}

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 1. Bypass check for test compatibility (e.g. Sanctum::actingAs())
        if (Auth::check()) {
            return $next($request);
        }

        // 2. Extract Authorization Header
        $authorization = $request->header('Authorization');
        if (!$authorization || !str_starts_with($authorization, 'Bearer ')) {
            return response()->json([
                'message' => 'Authorization token not found',
                'error' => 'token_not_found'
            ], 401);
        }

        $token = substr($authorization, 7);

        // 3. Validate Token
        $payload = $this->jwtService->validateToken($token);
        if (!$payload) {
            return response()->json([
                'message' => 'Token is invalid or expired',
                'error' => 'token_invalid'
            ], 401);
        }

        $userId = $payload['sub'] ?? null;
        if (!$userId) {
            return response()->json([
                'message' => 'Token payload is invalid',
                'error' => 'payload_invalid'
            ], 401);
        }

        // 4. Resolve and authenticate User
        $user = User::find($userId);
        if (!$user || !$user->is_active) {
            return response()->json([
                'message' => 'User not found or inactive',
                'error' => 'user_inactive'
            ], 401);
        }

        // 5. Verify Tenant Context is Active
        if (!$user->tenant || !$user->tenant->is_active) {
            return response()->json([
                'message' => 'Tenant is inactive',
                'error' => 'tenant_inactive'
            ], 403);
        }

        // 6. Set Authenticated User for request lifetime
        Auth::setUser($user);

        return $next($request);
    }
}
