<?php

use App\Models\Tenant;
use App\Services\TenantService;

if (!function_exists('tenant')) {
    /**
     * Get the current tenant service or tenant instance
     *
     * @return TenantService|Tenant|null
     */
    function tenant(?string $property = null)
    {
        $service = app(TenantService::class);

        if ($property === null) {
            return $service->current();
        }

        return $service->current()?->{$property};
    }
}

if (!function_exists('setTenant')) {
    /**
     * Set the current tenant
     */
    function setTenant(Tenant $tenant): void
    {
        app(TenantService::class)->set($tenant);
    }
}

if (!function_exists('flushTenant')) {
    /**
     * Clear the current tenant
     */
    function flushTenant(): void
    {
        app(TenantService::class)->clear();
    }
}

if (!function_exists('tenantId')) {
    /**
     * Get current tenant ID
     */
    function tenantId(): ?string
    {
        return app(TenantService::class)->id();
    }
}

if (!function_exists('hasTenant')) {
    /**
     * Check if tenant is set
     */
    function hasTenant(): bool
    {
        return app(TenantService::class)->hasTenant();
    }
}
