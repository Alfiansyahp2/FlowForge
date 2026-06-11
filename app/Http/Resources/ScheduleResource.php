<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Schedule
 */
class ScheduleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'workflow_id' => $this->workflow_id,
            'workflow_version_id' => $this->workflow_version_id,
            'name' => $this->name,
            'description' => $this->description,
            'cron_expression' => $this->cron_expression,
            'timezone' => $this->timezone,
            'is_active' => $this->is_active,
            'next_run_at' => $this->next_run_at?->toDateTimeString(),
            'last_run_at' => $this->last_run_at?->toDateTimeString(),
            'workflow' => $this->when($this->relationLoaded('workflow'), function () {
                return [
                    'id' => $this->workflow->id,
                    'name' => $this->workflow->name,
                ];
            }),
            'workflow_version' => $this->when($this->relationLoaded('workflowVersion'), function () {
                return [
                    'id' => $this->workflowVersion->id,
                    'version' => $this->workflowVersion->version,
                ];
            }),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
