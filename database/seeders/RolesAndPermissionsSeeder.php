<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Clear existing roles and permissions (fresh start)
        DB::table('model_has_permissions')->truncate();
        DB::table('model_has_roles')->truncate();
        DB::table('role_has_permissions')->truncate();
        Permission::query()->delete();
        Role::query()->delete();

        // Disable foreign key checks during seeding
        DB::statement('SET CONSTRAINTS ALL DEFERRED');

        // Create Roles
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $editorRole = Role::firstOrCreate(['name' => 'editor']);
        $viewerRole = Role::firstOrCreate(['name' => 'viewer']);

        // Workflow Permissions
        $workflowPermissions = [
            'view workflows',
            'create workflows',
            'edit workflows',
            'delete workflows',
            'execute workflows',
        ];

        foreach ($workflowPermissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Workflow Version Permissions
        $versionPermissions = [
            'view workflow versions',
            'create workflow versions',
            'activate workflow versions',
            'rollback workflows',
        ];

        foreach ($versionPermissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Workflow Execution Permissions
        $executionPermissions = [
            'view workflow runs',
            'execute workflows',
            'cancel workflow runs',
            'view step runs',
        ];

        foreach ($executionPermissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Webhook Permissions
        $webhookPermissions = [
            'view webhooks',
            'create webhooks',
            'edit webhooks',
            'delete webhooks',
        ];

        foreach ($webhookPermissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // Schedule Permissions
        $schedulePermissions = [
            'view schedules',
            'create schedules',
            'edit schedules',
            'delete schedules',
        ];

        foreach ($schedulePermissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // User Management Permissions
        $userPermissions = [
            'view users',
            'create users',
            'edit users',
            'delete users',
            'manage roles',
        ];

        foreach ($userPermissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // Assign Permissions to Admin Role (All permissions)
        $adminRole->givePermissionTo(Permission::all());

        // Assign Permissions to Editor Role (Most permissions, except user management)
        $editorRole->givePermissionTo([
            // Workflow permissions
            'view workflows',
            'create workflows',
            'edit workflows',
            'execute workflows',
            // Workflow version permissions
            'view workflow versions',
            'create workflow versions',
            'activate workflow versions',
            'rollback workflows',
            // Execution permissions
            'view workflow runs',
            'execute workflows',
            'cancel workflow runs',
            'view step runs',
            // Webhook permissions
            'view webhooks',
            'create webhooks',
            'edit webhooks',
            'delete webhooks',
            // Schedule permissions
            'view schedules',
            'create schedules',
            'edit schedules',
            'delete schedules',
        ]);

        // Assign Permissions to Viewer Role (Read-only)
        $viewerRole->givePermissionTo([
            'view workflows',
            'view workflow versions',
            'view workflow runs',
            'view step runs',
            'view webhooks',
            'view schedules',
        ]);

        // Re-enable foreign key checks
        // Not needed - constraints will be automatically enabled at transaction end

        $this->command->info('Roles and permissions seeded successfully!');
        $this->command->info('- Admin: All permissions');
        $this->command->info('- Editor: Create, edit, execute workflows (no user management)');
        $this->command->info('- Viewer: Read-only access');
    }
}
