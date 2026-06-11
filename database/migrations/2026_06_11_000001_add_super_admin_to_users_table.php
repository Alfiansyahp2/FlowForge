<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Drop existing foreign key constraint
            $table->dropForeign(['tenant_id']);

            // Make tenant_id nullable to support super admins
            $table->uuid('tenant_id')->nullable()->change();

            // Add super admin flag
            $table->boolean('is_super_admin')->default(false)->after('email');

            // Re-add foreign key with nullable support
            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->onDelete('set null');

            // Drop and recreate unique constraint to allow super admins
            $table->dropUnique(['tenant_id', 'email']);
            $table->unique(['tenant_id', 'email'], 'unique_tenant_email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Drop foreign key
            $table->dropForeign(['tenant_id']);

            // Make tenant_id not nullable again
            $table->uuid('tenant_id')->nullable(false)->change();

            // Re-add foreign key with cascade delete
            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->onDelete('cascade');

            // Drop super admin column
            $table->dropColumn('is_super_admin');

            // Drop and recreate original unique constraint
            $table->dropUnique('unique_tenant_email');
            $table->unique(['tenant_id', 'email']);
        });
    }
};
