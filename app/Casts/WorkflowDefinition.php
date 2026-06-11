<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class WorkflowDefinition implements CastsAttributes
{
    /**
     * Cast the given value.
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        if (is_null($value)) {
            return null;
        }

        // If already an array, return it
        if (is_array($value)) {
            return $value;
        }

        // If it's a string, decode it
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            
            // If decoded value is a string (double-encoded), decode again
            if (is_string($decoded)) {
                $decoded = json_decode($decoded, true);
            }
            
            return $decoded ?? [];
        }

        return [];
    }

    /**
     * Prepare the given value for storage.
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        if (is_array($value)) {
            return json_encode($value);
        }

        return $value;
    }
}
