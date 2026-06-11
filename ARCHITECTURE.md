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
- ✅ Authentication via Sanctum
- ✅ Authorization via Spatie
- ✅ Tenant isolation
- ⚠️ Rate limiting (partial)
- ❌ API security headers (needs implementation)

### Threats Addressed
- [x] Unauthorized access
- [x] Cross-tenant data leakage
- [x] Code injection vulnerabilities
- [ ] DDoS attacks (rate limiting incomplete)
- [ ] XSS attacks (headers needed)

---

**Last Updated:** 2025-01-11  
**Architecture Version:** 1.0  
**Maintained By:** Development Team