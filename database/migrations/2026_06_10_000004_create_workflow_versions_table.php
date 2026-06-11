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
        Schema::create('workflow_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id');
            $table->string('version'); // e.g., '1.0.0', '1.1.0', '2.0.0'
            $table->json('definition'); // {nodes: [], edges: []}
            $table->boolean('is_active')->default(false);
            $table->text('changelog')->nullable();
            $table->uuid('created_by');
            $table->timestamps();

            // Foreign Keys
            $table->foreign('workflow_id')
                ->references('id')
                ->on('workflows')
                ->onDelete('cascade');

            $table->foreign('created_by')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');

            // Unique Constraints
            $table->unique(['workflow_id', 'version']);

            // Indexes
            $table->index('workflow_id');
            $table->index('is_active');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('workflow_versions');
    }
};
