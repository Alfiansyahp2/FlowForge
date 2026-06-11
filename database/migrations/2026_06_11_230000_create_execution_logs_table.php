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
        Schema::create('execution_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('workflow_run_id');
            $table->uuid('step_run_id')->nullable();
            
            $table->string('log_level')->default('info'); // info, debug, warning, error
            $table->text('message');
            $table->json('context')->nullable(); // Additional debug context
            
            $table->timestamp('created_at')->useCurrent();
            
            // Indexes optimized for query and purge operations
            $table->index('workflow_run_id');
            $table->index(['step_run_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('execution_logs');
    }
};
