<?php

namespace App\Broadcasting;

use App\Models\User;
use App\Models\Workflow;
use Illuminate\Support\Facades\Request;

class WorkflowChannel
{
    /**
     * Authenticate the user's access to the channel.
     */
    public function join(User $user, string $workflowId): array|bool
    {
        // Check if user has access to this workflow
        $workflow = Workflow::where('id', $workflowId)
            ->where('tenant_id', $user->tenant_id)
            ->first();

        if (!$workflow) {
            return false;
        }

        // Allow admin, editor, and viewer roles
        return $user->can('view', $workflow) || $user->hasAnyRole(['admin', 'editor', 'viewer']);
    }
}
