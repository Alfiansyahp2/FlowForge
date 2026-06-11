<?php

namespace App\Http\Middleware;

use App\Services\TenantService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IdentifyTenant
{
    /**
     * Create a new middleware instance.
     */
    public function __construct(
        private TenantService $tenantService
    ) {}

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $tenant = $this->tenantService->identifyFromRequest($request);

        if (!$tenant) {
            return response()->json([
                'message' => 'Tenant not found or not specified',
                'error' => 'tenant_not_found'
            ], 400);
        }

        if (!$tenant->is_active) {
            return response()->json([
                'message' => 'Tenant is inactive',
                'error' => 'tenant_inactive'
            ], 403);
        }

        // Set the current tenant
        $this->tenantService->set($tenant);

        return $next($request);
    }
}
