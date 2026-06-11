<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorkflowRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', 'in:draft,active,archived'],
            'definition' => ['nullable', 'json'],
            'settings' => ['nullable', 'array'],
            'settings.timeout' => ['nullable', 'integer', 'min:1', 'max:3600'],
            'settings.max_retries' => ['nullable', 'integer', 'min:0', 'max:10'],
            'settings.retry_delay' => ['nullable', 'integer', 'min:1', 'max:300'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Workflow name is required',
            'name.max' => 'Workflow name cannot exceed 255 characters',
            'description.max' => 'Description cannot exceed 5000 characters',
            'status.in' => 'Status must be one of: draft, active, archived',
            'definition.json' => 'Definition must be valid JSON',
            'settings.timeout.integer' => 'Timeout must be an integer',
            'settings.timeout.min' => 'Timeout must be at least 1 second',
            'settings.timeout.max' => 'Timeout cannot exceed 3600 seconds (1 hour)',
        ];
    }

    /**
     * Prepare the data for validation.
     * Keep definition as JSON string for validation.
     */
    protected function prepareForValidation(): void
    {
        // Definition should remain as JSON string for validation.
        // Backend will handle JSON decoding after validation passes.
    }
}
