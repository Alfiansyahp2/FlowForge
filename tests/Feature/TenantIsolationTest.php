<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Workflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;
    private Tenant $tenantB;
    private User $userA;
    private User $userB;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed roles & permissions
        $this->artisan('db:seed', ['--class' => 'RolesAndPermissionsSeeder']);

        // Create Tenant A
        $this->tenantA = Tenant::create([
            'name' => 'Tenant A Corp',
            'slug' => 'tenant-a',
            'is_active' => true,
            'settings' => [],
        ]);

        // Create Tenant B
        $this->tenantB = Tenant::create([
            'name' => 'Tenant B Corp',
            'slug' => 'tenant-b',
            'is_active' => true,
            'settings' => [],
        ]);

        // Create User A
        $this->userA = User::create([
            'tenant_id' => $this->tenantA->id,
            'name' => 'User A',
            'email' => 'user.a@tenant-a.com',
            'password' => bcrypt('password'),
            'role' => 'editor',
            'is_active' => true,
        ]);
        $this->userA->assignRole('editor');

        // Create User B
        $this->userB = User::create([
            'tenant_id' => $this->tenantB->id,
            'name' => 'User B',
            'email' => 'user.b@tenant-b.com',
            'password' => bcrypt('password'),
            'role' => 'editor',
            'is_active' => true,
        ]);
        $this->userB->assignRole('editor');
    }

    /**
     * Test TenantScope filtering of database queries.
     */
    public function test_global_tenant_scope_filters_queries_by_tenant_id(): void
    {
        // Set context to Tenant A
        setTenant($this->tenantA);

        $workflowA = Workflow::create([
            'tenant_id' => $this->tenantA->id,
            'created_by' => $this->userA->id,
            'name' => 'Workflow for Tenant A',
            'status' => 'draft',
            'settings' => [],
        ]);

        // Set context to Tenant B
        setTenant($this->tenantB);

        $workflowB = Workflow::create([
            'tenant_id' => $this->tenantB->id,
            'created_by' => $this->userB->id,
            'name' => 'Workflow for Tenant B',
            'status' => 'draft',
            'settings' => [],
        ]);

        // Query under Tenant A context
        setTenant($this->tenantA);
        $workflows = Workflow::all();
        $this->assertCount(1, $workflows);
        $this->assertEquals($workflowA->id, $workflows->first()->id);

        // Query under Tenant B context
        setTenant($this->tenantB);
        $workflows = Workflow::all();
        $this->assertCount(1, $workflows);
        $this->assertEquals($workflowB->id, $workflows->first()->id);

        // Query with no tenant context (should return all since global scope is skipped when not set)
        flushTenant();
        $workflows = Workflow::all();
        $this->assertCount(2, $workflows);
    }

    /**
     * Test API requests with the X-Tenant-ID header.
     */
    public function test_api_requests_with_x_tenant_id_header_identifies_and_scopes_workflows(): void
    {
        // Set tenant context temporarily to create records
        setTenant($this->tenantA);
        $workflowA = Workflow::create([
            'tenant_id' => $this->tenantA->id,
            'created_by' => $this->userA->id,
            'name' => 'Workflow A',
            'status' => 'draft',
            'settings' => [],
        ]);

        setTenant($this->tenantB);
        $workflowB = Workflow::create([
            'tenant_id' => $this->tenantB->id,
            'created_by' => $this->userB->id,
            'name' => 'Workflow B',
            'status' => 'draft',
            'settings' => [],
        ]);

        flushTenant();

        // Perform API request as User A accessing User A's tenant workflows
        Sanctum::actingAs($this->userA);
        $response = $this->withHeaders([
            'X-Tenant-ID' => $this->tenantA->id,
        ])->getJson('/api/workflows');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $this->assertEquals($workflowA->id, $response->json('data.0.id'));

        // Perform API request as User B accessing User B's tenant workflows
        Sanctum::actingAs($this->userB);
        $response = $this->withHeaders([
            'X-Tenant-ID' => $this->tenantB->id,
        ])->getJson('/api/workflows');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $this->assertEquals($workflowB->id, $response->json('data.0.id'));
    }

    /**
     * Test that cross-tenant access is prohibited.
     */
    public function test_tenant_isolation_prevents_unauthorized_cross_tenant_access(): void
    {
        // Create Tenant A Workflow
        setTenant($this->tenantA);
        $workflowA = Workflow::create([
            'tenant_id' => $this->tenantA->id,
            'created_by' => $this->userA->id,
            'name' => 'Workflow A',
            'status' => 'draft',
            'settings' => [],
        ]);
        flushTenant();

        // User B attempts to access User A's workflow using User B's tenant ID
        Sanctum::actingAs($this->userB);
        $response = $this->withHeaders([
            'X-Tenant-ID' => $this->tenantB->id,
        ])->getJson("/api/workflows/{$workflowA->id}");

        // Due to TenantScope, the workflow of Tenant A is completely hidden and returns 404
        $response->assertStatus(404);

        // User B attempts to update User A's workflow
        $response = $this->withHeaders([
            'X-Tenant-ID' => $this->tenantB->id,
        ])->putJson("/api/workflows/{$workflowA->id}", [
            'name' => 'Hacked Workflow',
        ]);
        $response->assertStatus(404);
    }

    /**
     * Test that IdentifyTenant middleware rejects requests without tenant ID.
     */
    public function test_identify_tenant_middleware_returns_bad_request_if_tenant_missing(): void
    {
        Sanctum::actingAs($this->userA);
        $response = $this->getJson('/api/workflows');

        $response->assertStatus(400);
        $response->assertJsonFragment([
            'error' => 'tenant_not_found',
        ]);
    }

    /**
     * Test that inactive tenant is blocked.
     */
    public function test_inactive_tenant_is_blocked(): void
    {
        $this->tenantA->update(['is_active' => false]);

        Sanctum::actingAs($this->userA);
        $response = $this->withHeaders([
            'X-Tenant-ID' => $this->tenantA->id,
        ])->getJson('/api/workflows');

        $response->assertStatus(403);
        $response->assertJsonFragment([
            'error' => 'tenant_inactive',
        ]);
    }
}
