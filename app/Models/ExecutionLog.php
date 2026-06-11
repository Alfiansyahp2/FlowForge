<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExecutionLog extends Model
{
    /**
     * Disable standard Eloquent timestamps since we only use created_at.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'workflow_run_id',
        'step_run_id',
        'log_level',
        'message',
        'context',
        'created_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'context' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Get the workflow run associated with the log.
     */
    public function workflowRun(): BelongsTo
    {
        return $this->belongsTo(WorkflowRun::class);
    }

    /**
     * Get the step run associated with the log.
     */
    public function stepRun(): BelongsTo
    {
        return $this->belongsTo(StepRun::class);
    }
}
