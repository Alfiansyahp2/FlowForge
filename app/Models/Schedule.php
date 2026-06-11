<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Schedule extends Model
{
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'workflow_id',
        'workflow_version_id',
        'cron_expression',
        'name',
        'description',
        'is_active',
        'next_run_at',
        'last_run_at',
        'timezone',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_active' => 'boolean',
        'next_run_at' => 'datetime',
        'last_run_at' => 'datetime',
    ];

    /**
     * Get the tenant that owns the schedule.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Get the workflow that owns the schedule.
     */
    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    /**
     * Get the workflow version for the schedule.
     */
    public function workflowVersion(): BelongsTo
    {
        return $this->belongsTo(WorkflowVersion::class, 'workflow_version_id');
    }

    /**
     * Scope a query to only include active schedules.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to only include schedules that should run now.
     */
    public function scopeShouldRun($query)
    {
        return $query->active()
            ->where('next_run_at', '<=', now());
    }

    /**
     * Calculate next run time based on cron expression.
     */
    public function calculateNextRun(): \DateTime
    {
        // Using cron-expression library or Laravel's scheduler
        // For now, return current timestamp + 1 minute as placeholder
        return now()->addMinute();
    }

    /**
     * Update next run time.
     */
    public function updateNextRun(): void
    {
        $this->update(['next_run_at' => $this->calculateNextRun()]);
    }

    /**
     * Record that the schedule has run.
     */
    public function recordRun(): void
    {
        $this->update([
            'last_run_at' => now(),
            'next_run_at' => $this->calculateNextRun(),
        ]);
    }
}
