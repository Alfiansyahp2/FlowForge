<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class TenantSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Disable foreign key checks during seeding
        DB::statement('SET CONSTRAINTS ALL DEFERRED');

        // Create a default tenant (or get existing)
        $tenant = Tenant::firstOrCreate(
            ['slug' => 'demo'],
            [
                'name' => 'Demo Organization',
                'is_active' => true,
                'settings' => [
                    'max_workflows' => 100,
                    'max_users' => 50,
                ],
            ]
        );

        // Create admin user for the tenant
        $admin = User::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'email' => 'admin@demo.com',
            ],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        // Create additional test users
        $editor = User::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'email' => 'editor@demo.com',
            ],
            [
                'name' => 'Editor User',
                'password' => Hash::make('password'),
                'role' => 'editor',
                'is_active' => true,
            ]
        );

        $viewer = User::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'email' => 'viewer@demo.com',
            ],
            [
                'name' => 'Viewer User',
                'password' => Hash::make('password'),
                'role' => 'viewer',
                'is_active' => true,
            ]
        );

        // Assign Spatie roles after users are created
        $admin->assignRole('admin');
        $editor->assignRole('editor');
        $viewer->assignRole('viewer');

        // Re-enable foreign key checks
        // Not needed - constraints will be automatically enabled at transaction end

        $this->command->info('Tenant seeded successfully!');
        $this->command->info('Tenant: Demo Organization (slug: demo)');
        $this->command->info('Default users:');
        $this->command->info('  Admin: admin@demo.com / password');
        $this->command->info('  Editor: editor@demo.com / password');
        $this->command->info('  Viewer: viewer@demo.com / password');
    }
}
