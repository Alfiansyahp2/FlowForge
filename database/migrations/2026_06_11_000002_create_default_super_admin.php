<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Create default super admin
        User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@flowforge.com',
            'password' => Hash::make('SuperAdmin123!'),
            'is_super_admin' => true,
            'tenant_id' => null,
            'role' => 'admin',
            'is_active' => true,
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        User::where('email', 'superadmin@flowforge.com')->delete();
    }
};
