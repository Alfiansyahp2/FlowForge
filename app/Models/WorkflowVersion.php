<?php

namespace App\Models;

use App\Casts\WorkflowDefinition;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowVersion extends Model
{
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'workflow_id',
        'version',
        'definition',
        'is_active',
        'changelog',
        'created_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'definition' => WorkflowDefinition::class,
        'is_active' => 'boolean',
    ];

    /**
     * Get the workflow that owns the version.
     */
    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    /**
     * Get the user who created the version.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all runs using this version.
     */
    public function runs(): HasMany
    {
        return $this->hasMany(WorkflowRun::class, 'workflow_version_id');
    }

    /**
     * Scope a query to only include active versions.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to order by version number.
     */
    public function scopeOrderByVersion($query, $direction = 'desc')
    {
        return $query->orderByRaw("STRING_TO_ARRAY(version, '.')::int[] " . $direction);
    }

    /**
     * Increment version based on release type.
     */
    public static function incrementVersion(string $currentVersion, string $type = 'patch'): string
    {
        $parts = explode('.', $currentVersion);
        $major = (int) $parts[0];
        $minor = isset($parts[1]) ? (int) $parts[1] : 0;
        $patch = isset($parts[2]) ? (int) $parts[2] : 0;

        return match ($type) {
            'major' => sprintf('%d.0.0', $major + 1),
            'minor' => sprintf('%d.%d.0', $major, $minor + 1),
            'patch' => sprintf('%d.%d.%d', $major, $minor, $patch + 1),
            default => $currentVersion,
        };
    }
}
