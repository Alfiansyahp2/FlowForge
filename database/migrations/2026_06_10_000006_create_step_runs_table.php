<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::create('step_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_run_id');

            // Node identification
            $table->string('node_id'); // Node ID from workflow definition
            $table->enum('node_type', ['http', 'delay', 'condition']); // MVP: only these 3 types

            // Execution status
            $table->enum('status', ['pending', 'running', 'completed', 'failed', 'skipped', 'timeout'])->default('pending');

            // Execution timing
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->bigInteger('duration')->nullable(); // milliseconds (changed to bigInteger)

            // Input/Output data
            $table->json('input')->nullable();
            $table->json('output')->nullable();
            $table->text('error_message')->nullable();

            // Retry configuration
            $table->json('retry_config')->nullable(); // {max_retries: 3, delay: 1000, backoff: 'exponential'}
            $table->integer('retry_count')->default(0);
            $table->timestamp('next_retry_at')->nullable();

            // Execution order
            $table->integer('sort_order')->default(0); // Topological sort order

            $table->timestamps();
            $table->softDeletes();

            // Foreign Keys
            $table->foreign('workflow_run_id')
                ->references('id')
                ->on('workflow_runs')
                ->onDelete('cascade');

            // Indexes
            $table->index('workflow_run_id');
            $table->index('status');
            $table->index('node_id');
            $table->index('node_type');
            $table->index('sort_order');
            $table->index('next_retry_at');
            $table->index(['workflow_run_id', 'sort_order']); // For sequential execution
            $table->index(['workflow_run_id', 'status']); // For status filtering
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('step_runs');
    }
};
