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
        Schema::create('workflow_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id');
            $table->uuid('workflow_version_id');
            $table->uuid('tenant_id'); // Denormalized for performance
            $table->uuid('triggered_by')->nullable();

            // Trigger type
            $table->enum('trigger_type', ['manual', 'webhook', 'schedule', 'api'])->default('manual');

            // Execution status
            $table->enum('status', ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'timeout'])->default('pending');

            // Queue tracking
            $table->string('queue')->default('default');
            $table->string('queue_job_id')->nullable();
            $table->timestamp('queued_at')->nullable();

            // Execution timing
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->bigInteger('duration')->nullable(); // milliseconds (changed to bigInteger)

            // Timeout tracking
            $table->integer('timeout_seconds')->default(1800); // 30 minutes default
            $table->timestamp('timeout_at')->nullable();

            // Input/Output data
            $table->json('input')->nullable();
            $table->json('output')->nullable();
            $table->text('error_message')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Foreign Keys
            $table->foreign('workflow_id')
                ->references('id')
                ->on('workflows')
                ->onDelete('cascade');

            $table->foreign('workflow_version_id')
                ->references('id')
                ->on('workflow_versions')
                ->onDelete('cascade');

            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->onDelete('cascade');

            $table->foreign('triggered_by')
                ->references('id')
                ->on('users')
                ->onDelete('set null');

            // Indexes
            $table->index('workflow_id');
            $table->index('workflow_version_id');
            $table->index('tenant_id');
            $table->index('status');
            $table->index('triggered_by');
            $table->index('queue_job_id');
            $table->index('started_at');
            $table->index('timeout_at');
            $table->index(['workflow_id', 'started_at']);
            $table->index(['tenant_id', 'status', 'started_at']); // Composite for dashboard queries
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('workflow_runs');
    }
};
