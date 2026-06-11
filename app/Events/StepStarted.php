<?php

namespace App\Events;

use App\Models\StepRun;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StepStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public StepRun $stepRun
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new \Illuminate\Broadcasting\Channel('workflows.' . $this->stepRun->workflowRun->workflow_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'step.started';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->stepRun->id,
            'workflow_run_id' => $this->stepRun->workflow_run_id,
            'node_id' => $this->stepRun->node_id,
            'node_type' => $this->stepRun->node_type,
            'status' => $this->stepRun->status,
            'started_at' => $this->stepRun->started_at->toDateTimeString(),
        ];
    }
}
