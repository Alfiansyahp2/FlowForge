<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StepRun extends Model
{
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'workflow_run_id',
        'node_id',
        'node_type',
        'status',
        'started_at',
        'finished_at',
        'duration',
        'input',
        'output',
        'error_message',
        'retry_config',
        'retry_count',
        'sort_order',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'duration' => 'integer',
        'input' => 'array',
        'output' => 'array',
        'retry_config' => 'array',
        'retry_count' => 'integer',
        'sort_order' => 'integer',
    ];

    /**
     * Get the workflow run that owns the step run.
     */
    public function workflowRun(): BelongsTo
    {
        return $this->belongsTo(WorkflowRun::class);
    }

    /**
     * Scope a query to only include pending step runs.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope a query to only include running step runs.
     */
    public function scopeRunning($query)
    {
        return $query->where('status', 'running');
    }

    /**
     * Scope a query to only include completed step runs.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope a query to only include failed step runs.
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    /**
     * Scope a query to only include skipped step runs.
     */
    public function scopeSkipped($query)
    {
        return $query->where('status', 'skipped');
    }

    /**
     * Scope a query to filter by node type.
     */
    public function scopeByNodeType($query, string $type)
    {
        return $query->where('node_type', $type);
    }

    /**
     * Check if the step run is completed.
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Check if the step run is failed.
     */
    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    /**
     * Check if the step run can be retried.
     */
    public function canRetry(): bool
    {
        return $this->isFailed() && $this->retry_count < 3;
    }

    /**
     * Get duration in seconds.
     */
    public function getDurationInSeconds(): ?float
    {
        return $this->duration ? $this->duration / 1000 : null;
    }
}
