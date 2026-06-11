<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Webhook
 */
class WebhookResource extends JsonResource
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
            'name' => $this->name,
            'description' => $this->description,
            'token' => $this->token,
            'is_active' => $this->is_active,
            'last_triggered_at' => $this->last_triggered_at,
            'workflow' => $this->when($this->relationLoaded('workflow'), function () {
                return [
                    'id' => $this->workflow->id,
                    'name' => $this->workflow->name,
                ];
            }),
            'url' => config('app.url') . '/api/webhooks/' . $this->token,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
