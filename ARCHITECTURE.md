# FlowForge Architecture Documentation

Technical architecture, design decisions, and trade-offs for the FlowForge multi-tenant workflow orchestration platform.

## 🏗️ System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  React App   │  │  React Flow  │  │  TailwindCSS │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Nginx      │  │  Rate Limit  │  │   Sanctum    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Laravel App  │  │   Workflow   │  │   Reverb     │    │
│  │              │  │   Engine     │  │  (Websocket) │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌─────────────────────────────────────────────────────────────┐
│                   Data & Infrastructure                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ PostgreSQL   │  │    Redis     │  │   Horizon    │    │
│  │  (Primary)   │  │  (Cache/Queue)│  │  (Worker)    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Technology Stack & Rationale

### Backend: Laravel 12 + PHP 8.3
**Why Laravel:**
- **Rapid Development**: Built-in authentication, queues, broadcasting
- **Ecosystem**: Rich package ecosystem (Sanctum, Horizon, Reverb)
- **Maturity**: Battle-tested for enterprise applications
- **Developer Experience**: Expressive syntax, strong conventions

**Trade-offs:**
- ❌ Performance overhead compared to raw PHP/frameworks
- ❌ Memory footprint larger than micro-frameworks
- ✅ Development speed outweighs micro-optimizations for MVP

### Frontend: React + TypeScript
**Why React:**
- **Component Architecture**: Reusable UI components
- **Ecosystem**: Rich library support (React Flow, form libraries)
- **Type Safety**: TypeScript catches errors at compile-time
- **DAG Visualization**: React Flow provides excellent workflow editing

**Trade-offs:**
- ❌ Steeper learning curve than vanilla JS
- ❌ Bundle size larger than simpler alternatives
- ✅ Developer productivity and maintainability justify choice

### Database: PostgreSQL 16
**Why PostgreSQL:**
- **JSONB Support**: Native storage for workflow definitions
- **ACID Compliance**: Data integrity for multi-tenant operations
- **Advanced Features**: Window functions, CTEs, indexing strategies
- **Reliability**: Battle-tested for production workloads

**Trade-offs:**
- ❌ More complex setup than MySQL
- ❌ Higher resource usage
- ✅ Advanced features justify complexity for workflow orchestration

### Cache/Queue: Redis 7
**Why Redis:**
- **Performance**: In-memory operations (sub-millisecond)
- **Versatility**: Caching, pub/sub, queues, sessions
- **Scalability**: Horizontal scaling with clustering
- **Durability**: AOF persistence for queue reliability

**Trade-offs:**
- ❌ Additional infrastructure complexity
- ❌ Memory requirements
- ✅ Performance benefits essential for workflow execution

## 🔐 Multi-Tenant Architecture

### Tenant Isolation Strategy

**Row-Level Security via Global Scopes:**
```php
// Automatic tenant filtering on all queries
class Workflow extends Model {
    protected static function booted() {
        static::addGlobalScope(new TenantScope);
    }
}
```

**Data Flow:**
```
Request → IdentifyTenant Middleware → Set Current Tenant → 
Global Scope Application → Tenant-Filtered Queries → Response
```

**Trade-offs:**
- ✅ **Pros**: Simple implementation, automatic security
- ❌ **Cons**: Relies on developer discipline, potential for bypass

**Future Improvements:**
- Database-level row security (PostgreSQL RLS)
- Request-level tenant validation middleware
- Tenant quota enforcement

## ⚙️ Workflow Engine Architecture

### Core Components

```
WorkflowEngine/
├── WorkflowValidator.php      # Schema validation
├── CycleDetector.php          # Cycle detection (DFS)
├── TopologicalSorter.php      # Dependency resolution
├── WorkflowExecutor.php       # Execution orchestration
└── SafeExpressionEvaluator.php # Secure expression parsing
```

### Execution Strategy

**Parallel Batch Processing:**
1. **Topological Sort**: Determine execution order
2. **Batch Grouping**: Group independent nodes
3. **Parallel Execution**: Execute batches concurrently
4. **Result Aggregation**: Collect and pass results

**Example:**
```
A → [B, C] → D

Batch 1: A (sequential)
Batch 2: B, C (parallel)
Batch 3: D (sequential, depends on B & C)
```

**Trade-offs:**
- ✅ **Pros**: Maximizes parallelism, respects dependencies
- ❌ **Cons**: No true multi-process parallelism (single PHP process)

**Future Improvements:**
- Multi-process execution via queue workers
- Workflow state persistence for long-running workflows
- Workflow cancellation and rollback

## 🔒 Security Architecture

### Authentication & Authorization

**Laravel Sanctum (Token-based Auth):**
```php
// Token issuance
$token = $user->createToken('auth-token')->plainTextToken;

// Token validation
Auth::guard('sanctum')->check();
```

**RBAC with Spatie Permission:**
```php
// Permission checks
$user->can('create workflows');
$user->hasRole('admin');
```

**Security Measures:**
- ✅ Token expiration and revocation
- ✅ Permission-based access control
- ✅ Tenant-level data isolation
- ⚠️ Rate limiting (needs improvement)

**Critical Vulnerabilities Fixed:**
- ❌ ~~Direct `eval()` execution~~ → ✅ Safe expression evaluator
- ❌ ~~Unrestricted code execution~~ → ✅ Sandboxed math operations

## 📊 Database Design

### Schema Overview

**Core Entities:**
```
tenants → users → workflows → workflow_versions → workflow_runs → step_runs
         ↓                                                   
    webhooks, schedules
```

**Key Design Decisions:**
- **UUID Primary Keys**: Distributed system compatibility
- **JSONB Storage**: Flexible workflow definitions
- **Denormalized tenant_id**: Performance optimization
- **Soft Deletes**: Data recovery capability

**Trade-offs:**
- ✅ **Pros**: Flexible schema, excellent query performance
- ❌ **Cons**: UUID storage overhead, JSONB indexing complexity

**Indexing Strategy:**
```sql
-- Performance indexes
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_tenant_status ON workflow_runs(tenant_id, status);

-- Composite indexes for common queries
CREATE INDEX idx_workflow_runs_dashboard ON workflow_runs(tenant_id, status, started_at);
```

### Query Optimization & EXPLAIN Plan Analysis

To demonstrate non-trivial query optimization, we analyzed the performance of querying active/running workflows filtered by tenant context (the most common high-frequency query on the real-time monitoring dashboard):

```sql
EXPLAIN ANALYZE 
SELECT * FROM workflow_runs 
WHERE tenant_id = '019eb382-6b38-7018-9acc-50484630fa07' 
  AND status = 'running';
```

**PostgreSQL EXPLAIN Output:**
```text
Index Scan using workflow_runs_tenant_id_status_started_at_index on workflow_runs  (cost=0.14..8.16 rows=1 width=2308) (actual time=0.015..0.015 rows=0 loops=1)
  Index Cond: ((tenant_id = '019eb382-6b38-7018-9acc-50484630fa07'::uuid) AND ((status)::text = 'running'::text))
Planning Time: 7.160 ms
Execution Time: 0.443 ms
```

**Optimization Reasoning:**
1. **Index Scan Utilization**: Instead of executing a costly table scan (`Seq Scan`) which scans every row sequentially, the planner uses the composite index `workflow_runs_tenant_id_status_started_at_index`.
2. **Compound Filter Efficiency**: The database performs an `Index Cond` filter on both `tenant_id` and `status` simultaneously, immediately narrowing the search space to a single tenant's running records.
3. **Execution Speed**: The query planning takes `7.160 ms`, and the actual search execution takes only `0.443 ms`. As the database scales to millions of workflow runs across thousands of tenants, this keeps database query performance at O(log N) complexity instead of O(N).


## 🔄 Event Broadcasting Architecture

### Real-Time Updates via Laravel Reverb

**WebSocket Channels:**
```
workflows.{workflowId}    → Workflow-specific events
tenant.{tenantId}         → Tenant-wide events
```

**Events:**
```php
WorkflowStarted, WorkflowCompleted, WorkflowFailed
StepStarted, StepCompleted, StepFailed
```

**Trade-offs:**
- ✅ **Pros**: Real-time updates, reduced polling
- ❌ **Cons**: Connection limits, scaling complexity

**Future Improvements:**
- Redis pub/sub for multi-instance scaling
- Event aggregation for high-frequency workflows
- Connection pooling and load balancing

## 🐳 Containerization Strategy

### Docker Multi-Stage Build

**Stages:**
1. **Backend Builder**: Install PHP dependencies
2. **Frontend Builder**: Build React assets
3. **Production Runtime**: Minimal PHP-FPM image

**Optimizations:**
- **Layer Caching**: Separate dependency installation
- **Alpine Images**: Minimal attack surface
- **Multi-Stage**: Separate build and runtime dependencies

**Trade-offs:**
- ✅ **Pros**: Consistent environments, deployment simplicity
- ❌ **Cons**: Build complexity, image size overhead

## 🚀 Deployment Architecture

### Production Stack

```
Internet → Nginx (SSL/Termination) → PHP-FPM → Laravel App
                                       ↓
                                  PostgreSQL + Redis
```

**Process Management:**
- **Horizon**: Queue worker management
- **Scheduler**: Cron job execution
- **Reverb**: WebSocket server

**Trade-offs:**
- ✅ **Pros**: Separation of concerns, horizontal scaling
- ❌ **Cons**: Infrastructure complexity, operational overhead

## 🔮 Future Architecture Improvements

### Short-Term (3-6 months)
- [ ] Workflow state persistence
- [ ] Multi-process execution
- [ ] Enhanced monitoring & observability
- [ ] Comprehensive rate limiting

### Long-Term (6-12 months)
- [ ] Microservices decomposition
- [ ] Event sourcing for workflow execution
- [ ] GraphQL API
- [ ] Advanced analytics pipeline

## 📈 Performance Considerations

### Bottlenecks & Mitigations

**Database:**
- **Issue**: Large workflow_runs table
- **Solution**: Partitioning, archiving strategy

**Workflow Execution:**
- **Issue**: Single-process execution
- **Solution**: Queue-based parallel execution

**WebSocket:**
- **Issue**: Connection limits
- **Solution**: Redis pub/sub, horizontal scaling

## 🛡️ Security Considerations

### Current Posture
- ✅ Authentication via JWT (Stateless Custom Service)
- ✅ Authorization via Spatie
- ✅ Tenant isolation
- ✅ Rate limiting (Full - 5 req/min on auth, 60 req/min on API)
- ❌ API security headers (needs implementation)

### Threats Addressed
- [x] Unauthorized access
- [x] Cross-tenant data leakage
- [x] Code injection vulnerabilities
- [x] DDoS attacks / Brute force (Rate limiting completed)
- [ ] XSS attacks (headers needed)

## 🤖 AI-Powered Enhancement (Natural Language Builder)

The platform supports a Natural Language Workflow Builder where users describe a workflow in plain English, and the system dynamically generates a valid Workflow DAG JSON structure.

### Implementation Architecture
* **Controller**: [AIWorkflowController.php](file:///c:/Software%20Enginer/course/FlowForge/app/Http/Controllers/Api/AIWorkflowController.php) orchestrates LLM communication.
* **Provider Agnostic**: Configurable via `.env` (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`) supporting OpenAI, GLM (Zhipu AI), Ollama, or other compatible endpoints.

### Prompt Engineering & Token Guardrails
1. **Role-Based System Prompting**: Instructs the LLM to act as a *Staff Workflow Systems Architect*, returning raw JSON matching the exact schema definition for nodes (`http`, `delay`, `condition`, `notification`) and edges.
2. **Output Sanitization (Guardrails)**: Clean JSON strings using regular expressions (`cleanJsonString()`) to strip out Markdown backticks (` ```json ` wrappers) or explainers sometimes generated by LLMs before parsing.
3. **Validation Guardrails**: Before storing the output, the generated DAG is run through the [WorkflowValidator](file:///c:/Software%20Enginer/course/FlowForge/app/WorkflowEngine/WorkflowValidator.php) class. If it fails schema rules, the backend rejects the run with a 422 validation error instead of saving a broken definition.

---

**Last Updated:** 2026-06-12  
**Architecture Version:** 1.1  
**Maintained By:** Development Team