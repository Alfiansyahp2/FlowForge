# FlowForge Code Quality & Architectural Review

This document contains a structured review of the codebase flaws identified during the audit, their security/operational impacts, and the corresponding refactoring fixes applied.

---

## 1. Tenant Isolation Bypass Vulnerability

### 🚨 Original Code Snippet
Inside `app/Models/Scopes/TenantScope.php`:
```php
public function apply(Builder $query, Model $model): void
{
    if ($model->getKeyName() !== 'id') { // ← CRITICAL BUG
        // ... apply tenant filtering query ...
    }
}
```

### 🔍 Impact Analysis
- **The Issue**: Every major database entity (`User`, `Workflow`, `WorkflowRun`, `StepRun`) uses the standard column `id` as its primary key. Thus, `$model->getKeyName() !== 'id'` evaluated to `false` in every query.
- **The Result**: The tenant query isolation scope was **never** applied. Users from Tenant A could query and modify workflows, logs, and users of Tenant B simply by sending requests containing Tenant B's primary key UUIDs. This constituted a critical cross-tenant data leak.

### 🛡️ Solution Applied
Removed the invalid check and directly filtered based on the active tenant ID context while properly skipping the `tenants` lookup table:
```php
public function apply(Builder $query, Model $model): void
{
    if (function_exists('tenant') && hasTenant()) {
        $table = $model->getTable();

        if ($table === 'tenants') {
            return;
        }

        if ($this->tableHasColumn($table, 'tenant_id')) {
            $query->where($table . '.tenant_id', tenantId());
        }
    }
}
```

---

## 2. Inefficient and Synchronous Workflow Executor

### 🚨 Original Architecture
Inside `app/WorkflowEngine/WorkflowExecutor.php`:
```php
// The executor ran all steps sequentially in a single PHP thread/request life cycle
public function execute(WorkflowVersion $version, array $input = [])
{
    foreach ($batches as $batch) {
        foreach ($batch['nodes'] as $node) {
            $this->executeNode($node, $context); // Blocked the request thread
        }
    }
}
```

### 🔍 Impact Analysis
- **Sequential Bottleneck**: If a step contained a delay node (e.g. 10 seconds), the thread stayed blocked, delaying subsequent independent steps.
- **Memory/Runtime Limits**: Runs with many steps would easily hit PHP execution limits, crash, and leave runs in a perpetual "running" state.
- **No Parallelism**: Multiple workers could not execute independent parallel branches simultaneously.

### 🛡️ Solution Applied
Refactored the executor to dispatch background queue workers for each independent batch step:
1. **Parallel Dispatch**: The executor groups nodes by batch level and dispatches them via `ExecuteStepJob`.
2. **Pessimistic Locking**: Uses `DB::transaction()` with `lockForUpdate()` when checking batch completion, preventing race conditions from triggering duplicated downstream jobs.
3. **Queue Scalability**: Execution steps scale dynamically across Laravel Horizon queue workers.

---

## 3. Broken Exception Propagation & Retry Handling

### 🚨 Original Code Snippet
Inside the step execution loop:
```php
try {
    $this->executeNode($node, $context);
} catch (Exception $e) {
    // Threw error directly, crashing the entire runner thread
    throw $e; 
}
```

### 🔍 Impact Analysis
- **Uncontrolled Failures**: Any network timeout or temporary failure of a single node immediately crashed the executor.
- **No Graceful Recovery**: Steps could not leverage their defined `max_retries` settings, leading to poor system resiliency.

### 🛡️ Solution Applied
Implemented clean retry state tracking:
1. **Retry Interception**: When a step fails, the executor calculates the exponential retry delay backoff and dispatches a delayed `RetryStepJob` instead of propagating the exception.
2. **Exhaustion Handling**: The workflow run is only failed if the step retry count exceeds its configured `max_retries` threshold.

---

## 4. Unsecured Webhook and Schedule Registration

### 🚨 Original Audited Code
Users could register webhooks and schedules against any arbitrary `workflow_id` provided in the HTTP request payload without verifying if the workflow belonged to their active tenant.

### 🔍 Impact Analysis
- **Cross-Tenant Injection**: An attacker from Tenant A could link their webhook trigger to a workflow owned by Tenant B, inspecting execution triggers or executing workflows outside their boundary.

### 🛡️ Solution Applied
Added strict query-level checks in `WebhookController` and `ScheduleController` to validate ownership:
```php
$workflow = Workflow::where('id', $request->input('workflow_id'))->first();
if (!$workflow) {
    return response()->json(['error' => 'Workflow not found.'], 404);
}
```
Because of our fixed global `TenantScope`, the `Workflow::where()` query automatically filters against the authenticated user's `tenant_id`, guaranteeing cross-tenant isolation by design.
