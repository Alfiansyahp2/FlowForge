<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Http\Request;

class TenantService
{
    /**
     * Current tenant instance
     */
    protected ?Tenant $currentTenant = null;

    /**
     * Get the current tenant
     */
    public function current(): ?Tenant
    {
        return $this->currentTenant;
    }

    /**
     * Set the current tenant
     */
    public function set(Tenant $tenant): void
    {
        $this->currentTenant = $tenant;
    }

    /**
     * Clear the current tenant
     */
    public function clear(): void
    {
        $this->currentTenant = null;
    }

    /**
     * Identify tenant from request
     */
    public function identifyFromRequest(Request $request): ?Tenant
    {
        // Method 1: Check for X-Tenant-ID header (API usage)
        $tenantId = $request->header('X-Tenant-ID');
        if ($tenantId) {
            return Tenant::find($tenantId);
        }

        // Method 2: Check for tenant slug in subdomain (web usage)
        $host = $request->getHost();
        $subdomain = explode('.', $host)[0] ?? null;

        if ($subdomain && $subdomain !== 'www' && $subdomain !== 'flowforge') {
            return Tenant::where('slug', $subdomain)->first();
        }

        // Method 3: Check authenticated user's tenant
        if ($request->user()?->tenant_id) {
            return Tenant::find($request->user()->tenant_id);
        }

        return null;
    }

    /**
     * Check if tenant is set
     */
    public function hasTenant(): bool
    {
        return $this->currentTenant !== null;
    }

    /**
     * Get current tenant ID
     */
    public function id(): ?string
    {
        return $this->currentTenant?->id;
    }
}
