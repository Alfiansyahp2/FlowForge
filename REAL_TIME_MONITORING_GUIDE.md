# Real-Time Monitoring Dashboard - Implementation Guide

## Overview

The Real-Time Monitoring Dashboard provides live workflow execution status, health metrics, and comprehensive run history visualization using WebSocket connections for real-time updates.

## Architecture

### Components Implemented

#### 1. **HealthPanel** (`components/dashboard/HealthPanel.tsx`)
- **Purpose**: Displays real-time health metrics for workflow executions
- **Features**:
  - Active workflow runs count
  - Success rate (last 24 hours)
  - Average execution duration
  - Total runs in last 24 hours
- **Update Frequency**: Every 30 seconds
- **Caching**: Client-side caching with 30-second TTL

#### 2. **LiveRunsMonitor** (`components/dashboard/LiveRunsMonitor.tsx`)
- **Purpose**: Shows active workflow runs with real-time step-by-step updates
- **Features**:
  - WebSocket connection for live updates
  - Automatic reconnection on connection loss
  - Real-time step progress tracking
  - Connection status indicator
- **WebSocket Events**:
  - `workflow.started` - New workflow run added to list
  - `workflow.completed` - Run removed from active list
  - `workflow.failed` - Run removed from active list
  - `step.started` - Step status updated to running
  - `step.completed` - Step marked as completed
  - `step.failed` - Step marked as failed

#### 3. **WorkflowRunVisualizer** (`components/dashboard/WorkflowRunVisualizer.tsx`)
- **Purpose**: Visual DAG rendering with real-time step execution highlighting
- **Features**:
  - React Flow-based DAG visualization
  - Real-time step status updates
  - Step execution logs
  - Auto-refresh for running workflows (every 2 seconds)
  - Interactive node details
- **Visual States**:
  - Pending: Gray border
  - Running: Blue border + pulse animation
  - Completed: Green border
  - Failed: Red border

#### 4. **WorkflowRunsPage** (`pages/WorkflowRunsPage.tsx`)
- **Purpose**: Comprehensive run history with filtering and pagination
- **Features**:
  - Filter by status (running, completed, failed)
  - Filter by workflow
  - Date range filtering
  - Pagination support
  - Sortable columns
  - Detailed run information

### Infrastructure Components

#### 1. **Client-Side Caching** (`lib/cache.ts`)
- **Purpose**: Optimistic UI updates and API response caching
- **Features**:
  - TTL-based cache expiration
  - LRU eviction policy (max 100 items)
  - Pattern-based cache invalidation
  - Optimistic update support
  - React hooks integration

**Cache Keys**:
```typescript
CacheKeys.runsList({ status: 'running' })
CacheKeys.runDetails('run-id')
CacheKeys.healthMetrics()
CacheKeys.activeRuns()
```

**Usage Example**:
```typescript
// Get cached data or fetch
const data = await cache.getOrSet(
  'runs:running',
  () => runsApi.list({ status: 'running' }),
  30000 // 30 seconds TTL
);

// Optimistic update
optimisticUpdate(
  'runs:active',
  (current) => [...current, newRun],
  () => api.createRun(newRun)
);
```

#### 2. **WebSocket Manager** (`lib/websocket.ts`)
- **Purpose**: Reliable WebSocket connection with auto-reconnection
- **Features**:
  - Automatic reconnection with exponential backoff
  - Channel-based subscription system
  - Global event listeners
  - Connection status tracking
  - Graceful cleanup

**Reconnection Strategy**:
- Base interval: 3 seconds
- Backoff multiplier: 1.5x
- Max attempts: 10
- Example: 3s → 4.5s → 6.75s → 10.125s...

**Usage Example**:
```typescript
const { status, subscribe } = useWebSocket(tenantId);

// Subscribe to events
const unsubscribe = subscribe(
  `tenant.${tenantId}`,
  'workflow.started',
  (data) => console.log('Workflow started:', data)
);

// Cleanup
unsubscribe();
```

## WebSocket Protocol

### Connection

```typescript
// Connect to tenant-specific channel
ws://localhost:8080/socket/tenant/{tenantId}
```

### Subscription Message

```json
{
  "event": "subscribe",
  "channels": ["tenant.{tenantId}"]
}
```

### Event Messages

#### Workflow Started
```json
{
  "channel": "tenant.{tenantId}",
  "event": "workflow.started",
  "data": {
    "id": "uuid",
    "workflow_id": "uuid",
    "status": "running",
    "started_at": "2026-06-11T10:00:00Z",
    "workflow": {
      "id": "uuid",
      "name": "My Workflow"
    }
  }
}
```

#### Step Completed
```json
{
  "channel": "tenant.{tenantId}",
  "event": "step.completed",
  "data": {
    "id": "uuid",
    "workflow_run_id": "uuid",
    "node_id": "1",
    "node_type": "http",
    "status": "completed",
    "duration": 1250,
    "output": {
      "status": 200,
      "body": "..."
    }
  }
}
```

#### Step Failed
```json
{
  "channel": "tenant.{tenantId}",
  "event": "step.failed",
  "data": {
    "id": "uuid",
    "workflow_run_id": "uuid",
    "node_id": "2",
    "node_type": "condition",
    "status": "failed",
    "error_message": "Condition evaluation failed",
    "retry_count": 1
  }
}
```

## Performance Optimizations

### 1. Client-Side Caching
- **Health Metrics**: Cached for 30 seconds
- **Active Runs**: Cached for 30 seconds
- **Run Details**: Cached for 5 minutes
- **Pagination Results**: Cached for 2 minutes

### 2. Optimistic UI Updates
- **Workflow Creation**: Optimistically add to list before API confirmation
- **Status Changes**: Update UI immediately, rollback on error
- **Step Progress**: Update step status as soon as event received

### 3. WebSocket Efficiency
- **Channel Subscription**: Only subscribe to tenant-specific events
- **Event Batching**: Multiple steps can update simultaneously
- **Connection Pooling**: Single WebSocket connection per tenant

### 4. React Optimization
- **Memoization**: Component memoization for expensive renders
- **Conditional Updates**: Only re-render affected components
- **Debouncing**: Search inputs debounced by 300ms
- **Virtual Scrolling**: For large run lists (future enhancement)

## API Endpoints

### Workflow Runs

#### List Runs
```
GET /api/runs
Parameters:
  - status: string (running|completed|failed)
  - workflow_id: string
  - date_from: string (ISO 8601)
  - date_to: string (ISO 8601)
  - page: integer
  - per_page: integer

Response:
{
  "data": [...],
  "current_page": 1,
  "per_page": 20,
  "total": 150
}
```

#### Get Run Details
```
GET /api/runs/{id}

Response:
{
  "data": {
    "id": "uuid",
    "workflow_id": "uuid",
    "status": "running",
    "step_runs": [...],
    "workflow": {
      "id": "uuid",
      "name": "My Workflow",
      "definition": {...}
    }
  }
}
```

#### Cancel Run
```
POST /api/runs/{id}/cancel

Response:
{
  "message": "Workflow run cancelled"
}
```

## Backend Implementation

### Broadcasting Events

#### Workflow Execution Events
```php
// app/WorkflowEngine/WorkflowExecutor.php

// Broadcast workflow started
broadcast(new WorkflowStarted($workflowRun));

// Broadcast step completed
broadcast(new StepCompleted($stepRun));

// Broadcast step failed
broadcast(new StepFailed($stepRun, $exception->getMessage()));
```

#### Event Classes
```php
// app/Events/WorkflowStarted.php
class WorkflowStarted implements ShouldBroadcast
{
    public function broadcastOn()
    {
        return new PrivateChannel('tenant.' . $this->workflowRun->tenant_id);
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->workflowRun->id,
            'workflow_id' => $this->workflowRun->workflow_id,
            'status' => 'running',
            'workflow' => $this->workflowRun->workflow,
        ];
    }
}
```

### Channel Authorization
```php
// app/Broadcasting/TenantChannel.php
class TenantChannel implements Channel
{
    public function join($user, $tenantId)
    {
        // Verify user belongs to tenant
        return $user->tenant_id === $tenantId;
    }
}
```

## Testing

### Manual Testing

#### 1. Test Health Panel
```bash
# Create multiple workflow runs
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/workflows/{id}/run \
    -H "Authorization: Bearer {token}" \
    -H "X-Tenant-ID: {tenant_id}"
done

# Check health metrics update
# Metrics should refresh every 30 seconds
```

#### 2. Test WebSocket Connection
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8080/socket/tenant/{tenant_id}');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    event: 'subscribe',
    channels: [`tenant.${tenantId}`]
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Event:', message.event, message.data);
};
```

#### 3. Test Optimistic Updates
```typescript
// Update workflow optimistically
const optimisticUpdate = optimisticUpdate(
  'workflows:list',
  (current) => [...current, newWorkflow],
  () => workflowApi.create(newWorkflow)
);
```

### Automated Testing (Future)

```typescript
// tests/e2e/real-time-monitoring.spec.ts
describe('Real-Time Monitoring', () => {
  test('health panel displays metrics', async () => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="active-runs"]')).toBeVisible();
  });

  test('WebSocket connection established', async () => {
    const wsConnected = await page.evaluate(() => {
      return window.__ws_status__ === 'connected';
    });
    expect(wsConnected).toBe(true);
  });

  test('live runs update in real-time', async () => {
    await page.goto('/dashboard');
    
    // Trigger workflow run
    await page.click('[data-testid="run-workflow"]');
    
    // Check for new run in list
    await expect(page.locator('[data-testid="active-run-item"]').first()).toBeVisible();
  });
});
```

## Troubleshooting

### WebSocket Connection Issues

**Problem**: WebSocket shows "disconnected" status

**Solutions**:
1. Check Reverb server is running: `php artisan reverb:start`
2. Verify WebSocket URL in `.env`: `REVERB_HOST=localhost`
3. Check tenant ID is valid
4. Verify channel authorization in `TenantChannel.php`

**Debug Commands**:
```bash
# Check Reverb logs
docker-compose logs -f reverb

# Check WebSocket connection in browser console
window.__ws_manager__.getStatus()

# Manually test WebSocket
wscat -c ws://localhost:8080/socket/tenant/{tenant_id}
```

### Caching Issues

**Problem**: Stale data displayed

**Solutions**:
1. Clear cache: `cache.clear()`
2. Invalidate specific pattern: `cache.invalidate('runs:*')`
3. Check TTL is appropriate
4. Verify cache key generation

**Debug Commands**:
```typescript
// Check cache stats
console.log(cache.getStats());

// Check specific key
console.log(cache.get('runs:active'));

// Invalidate pattern
cache.invalidate('runs:*');
```

### Performance Issues

**Problem**: Slow dashboard loading

**Solutions**:
1. Check database queries have proper indexes
2. Verify pagination is working
3. Reduce WebSocket event frequency
4. Implement virtual scrolling for large lists

**Optimization Commands**:
```sql
-- Add missing indexes
CREATE INDEX idx_workflow_runs_status_started ON workflow_runs(status, started_at DESC);

-- Check query performance
EXPLAIN ANALYZE SELECT * FROM workflow_runs WHERE status = 'running';
```

## Future Enhancements

### Short Term (1-2 weeks)
- [ ] Add retry count to step progress
- [ ] Implement virtual scrolling for large run lists
- [ ] Add workflow execution replay
- [ ] Export run history as CSV
- [ ] Add more filtering options (by user, by trigger type)

### Long Term (1-2 months)
- [ ] Real-time execution graph visualization
- [ ] Performance analytics and trends
- [ ] Alert configuration for failed workflows
- [ ] Custom dashboard widgets
- [ ] Multi-language support

## Metrics to Monitor

### Dashboard Usage
- Active concurrent users
- WebSocket connection count
- Average page load time
- Cache hit rate

### System Performance
- WebSocket message throughput
- Database query performance
- API response times
- Memory usage per connection

### Business Metrics
- Total workflow executions per day
- Success rate trends
- Average workflow duration
- Most used node types

## Security Considerations

### WebSocket Authentication
- Only authenticated users can connect
- Channel authorization verified per tenant
- TLS/WSS required in production
- Rate limiting on WebSocket connections

### Data Exposure
- Sensitive data not logged
- Error messages sanitized
- Tenant isolation enforced
- No cross-tenant data leakage

## Deployment

### Environment Variables
```env
# Laravel Reverb
REVERB_APP_ID=your-app-id
REVERB_APP_KEY=your-app-key
REVERB_APP_SECRET=your-app-secret
REVERB_HOST=0.0.0.0
REVERB_PORT=8080
REVERB_SCHEME=http

# Frontend
VITE_API_URL=http://localhost:8000
VITE_REVERB_HOST=localhost:8080
```

### Docker Configuration
```yaml
# docker-compose.yml
reverb:
  build: .
  command: php artisan reverb:start
  ports:
    - "8080:8080"
  environment:
    REVERB_HOST: "0.0.0.0"
    REVERB_SCHEME: http
  depends_on:
    - redis
```

### Production Checklist
- [ ] Enable HTTPS/WSS
- [ ] Configure Redis pub/sub for multi-instance scaling
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation
- [ ] Enable database connection pooling
- [ ] Set up automated backups
- [ ] Configure rate limiting
- [ ] Enable CDN for static assets

---

**Implementation Date**: 2026-06-11  
**Version**: 1.0  
**Maintained By**: FlowForge Development Team
