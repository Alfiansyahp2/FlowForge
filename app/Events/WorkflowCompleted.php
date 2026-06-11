<?php

namespace App\Events;

use App\Models\WorkflowRun;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WorkflowCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public WorkflowRun $workflowRun
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new \Illuminate\Broadcasting\Channel('workflows.' . $this->workflowRun->workflow_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'workflow.completed';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->workflowRun->id,
            'workflow_id' => $this->workflowRun->workflow_id,
            'status' => $this->workflowRun->status,
            'duration' => $this->workflowRun->duration,
            'started_at' => $this->workflowRun->started_at->toDateTimeString(),
            'finished_at' => $this->workflowRun->finished_at->toDateTimeString(),
        ];
    }
}
