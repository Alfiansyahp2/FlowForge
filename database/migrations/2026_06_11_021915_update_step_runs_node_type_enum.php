<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Extend node_type to support all 5 node types.
     *
     * PostgreSQL approach: drop the check constraint (if any) and change
     * the column to a plain varchar — Laravel's enum on PostgreSQL is
     * stored as varchar with a check constraint named
     * "step_runs_node_type_check".
     */
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            // Drop existing check constraint, then re-add with all 5 values
            DB::statement('ALTER TABLE step_runs DROP CONSTRAINT IF EXISTS step_runs_node_type_check');
            DB::statement("ALTER TABLE step_runs ADD CONSTRAINT step_runs_node_type_check CHECK (node_type IN ('http','delay','condition','script','notification'))");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE step_runs MODIFY COLUMN node_type ENUM('http','delay','condition','script','notification') NOT NULL");
        }
        // SQLite: no enum enforcement — already works as string
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE step_runs DROP CONSTRAINT IF EXISTS step_runs_node_type_check');
            DB::statement("ALTER TABLE step_runs ADD CONSTRAINT step_runs_node_type_check CHECK (node_type IN ('http','delay','condition'))");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE step_runs MODIFY COLUMN node_type ENUM('http','delay','condition') NOT NULL");
        }
    }
};
