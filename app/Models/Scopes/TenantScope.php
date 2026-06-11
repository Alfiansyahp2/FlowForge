<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TenantScope implements Scope
{
    /**
     * Apply the scope to a given Eloquent query builder.
     */
    public function apply(Builder $query, Model $model): void
    {
        // Only apply if we have a current tenant and model has tenant_id column
        if (function_exists('tenant') && hasTenant() && $model->getKeyName() !== 'id') {
            $table = $model->getTable();

            // Check if table has tenant_id column
            if ($this->tableHasColumn($table, 'tenant_id')) {
                $query->where($table . '.tenant_id', tenantId());
            }
        }
    }

    /**
     * Check if table has specific column
     */
    protected function tableHasColumn(string $table, string $column): bool
    {
        try {
            $columns = \Illuminate\Support\Facades\Schema::getColumnListing($table);
            return in_array($column, $columns);
        } catch (\Exception $e) {
            return false;
        }
    }
}
