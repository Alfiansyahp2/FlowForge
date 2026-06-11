<?php

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasUuids, SoftDeletes, HasRoles;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'is_super_admin',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_active' => 'boolean',
        'password' => 'hashed',
    ];

    /**
     * Get the tenant that owns the user.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class)->withDefault();
    }

    /**
     * Get all workflows created by the user.
     */
    public function workflows(): HasMany
    {
        return $this->hasMany(Workflow::class, 'created_by');
    }

    /**
     * Get all workflow runs triggered by the user.
     */
    public function workflowRuns(): HasMany
    {
        return $this->hasMany(WorkflowRun::class, 'triggered_by');
    }

    /**
     * Check if user has specific tenant role (fallback for role field).
     * Note: Primary role checking is now handled by Spatie hasRole() method.
     */
    public function hasTenantRole(string $role): bool
    {
        return $this->role === $role;
    }

    /**
     * Check if user is admin.
     */
    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    /**
     * Check if user can edit workflows.
     */
    public function canEdit(): bool
    {
        return $this->hasAnyRole(['admin', 'editor']);
    }

    /**
     * Check if user can view workflows.
     */
    public function canView(): bool
    {
        return $this->hasAnyRole(['admin', 'editor', 'viewer']);
    }

    /**
     * Check if user can delete workflows.
     */
    public function canDelete(): bool
    {
        return $this->hasRole('admin');
    }

    /**
     * Scope a query to only include active users.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
