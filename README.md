# FlowForge - Multi-Tenant Workflow Orchestration Platform

A technical assessment project demonstrating strong software engineering principles, backend architecture, and workflow orchestration concepts.

**Built as an MVP** for technical assessment purposes.

---

## 🎯 Project Overview

FlowForge is a multi-tenant workflow orchestration platform inspired by Zapier, n8n, and GitHub Actions. Users can create workflows represented as Directed Acyclic Graphs (DAGs), execute them, and monitor results in real-time.

### Key Features

✅ **Multi-Tenant Architecture** - Complete data isolation with RBAC
✅ **Workflow Engine** - DAG validation, topological sorting, parallel execution
✅ **Multiple Triggers** - Manual, Webhook, and Cron triggers
✅ **Retry Logic** - Exponential backoff for failed steps
✅ **Real-Time Monitoring** - Laravel Reverb broadcasting
✅ **Workflow Versioning** - Track and rollback changes
✅ **RESTful API** - Complete CRUD with validation and pagination

---

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Laravel 12
- PHP 8.3+
- PostgreSQL
- Redis
- Laravel Sanctum (Authentication)
- Spatie Permission (RBAC)
- Laravel Reverb (Broadcasting)

**Workflow Engine:**
- Custom DAG Validator with Cycle Detection
- Topological Sorter for execution order
- Retry Manager with exponential backoff
- Parallel batch executor

**Testing:**
- Pest
- PHPUnit

---

## 📊 Database Design

### Core Entities

```sql
tenants
├── id (UUID, PK)
├── name
├── slug
└── settings (JSONB)

users
├── id (UUID, PK)
├── tenant_id (UUID, FK)
├── name
├── email
└── role (admin|editor|viewer)

workflows
├── id (UUID, PK)
├── tenant_id (UUID, FK)
├── created_by (UUID, FK)
├── current_version_id (UUID, FK)
├── name
├── description
├── definition (JSONB)
└── status (draft|active|archived)

workflow_versions
├── id (UUID, PK)
├── workflow_id (UUID, FK)
├── version (integer)
├── definition (JSONB)
└── created_by (UUID, FK)

workflow_runs
├── id (UUID, PK)
├── workflow_id (UUID, FK)
├── workflow_version_id (UUID, FK)
├── status (running|completed|failed)
├── trigger_type (manual|webhook|cron)
├── input (JSONB)
├── output (JSONB)
├── started_at
├── finished_at
└── duration (integer)

step_runs
├── id (UUID, PK)
├── workflow_run_id (UUID, FK)
├── node_id (string)
├── node_type (http|delay|condition|script|notification)
├── status (pending|running|completed|failed)
├── input (JSONB)
├── output (JSONB)
├── error_message (text)
├── retry_count (integer)
├── started_at
├── finished_at
└── duration (integer)

webhooks
├── id (UUID, PK)
├── tenant_id (UUID, FK)
├── workflow_id (UUID, FK)
├── token (string, unique)
├── name
├── is_active (boolean)
└── last_triggered_at

schedules
├── id (UUID, PK)
├── tenant_id (UUID, FK)
├── workflow_id (UUID, FK)
├── workflow_version_id (UUID, FK)
├── cron_expression (string)
├── timezone (string)
├── is_active (boolean)
├── next_run_at
└── last_run_at
```

### Indexes & Optimization

```sql
-- Performance indexes
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_step_runs_workflow_run ON step_runs(workflow_run_id);
CREATE INDEX idx_webhooks_token ON webhooks(token);
CREATE INDEX idx_schedules_next_run ON schedules(next_run_at) WHERE is_active = true;

-- Multi-tenant data isolation
CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX idx_workflow_runs_tenant ON workflow_runs(tenant_id);
```

---

## 🔧 Workflow Engine

### Core Components

```
app/WorkflowEngine/
├── WorkflowValidator.php      # Validates DAG structure
├── CycleDetector.php          # Detects circular dependencies
├── TopologicalSorter.php      # Determines execution order
├── WorkflowExecutor.php       # Executes workflows
└── RetryManager.php           # Handles retry logic
```

### DAG Validation

**Validates:**
- No circular dependencies (A → B → C → A)
- Valid node references
- Valid edge references
- Supported node types only

### Topological Sort

Determines execution order based on dependencies.

**Example:**
```
    A
   ↓
   B
   ↓
   C

Execution Order: A → B → C
```

### Parallel Execution

Nodes without dependencies run in parallel.

**Example:**
```
    A
   ↙ ↘
  B   C
   ↘ ↙
    D

Execution:
1. Run A
2. Run B and C in parallel ⚡
3. Run D
```

### Retry Logic

Exponential backoff retry mechanism:

```
max_retries = 3
retry_delay = 5 seconds

Retry 1: 5s delay (5 × 2^0)
Retry 2: 10s delay (5 × 2^1)
Retry 3: 20s delay (5 × 2^2)
```

### Supported Node Types

1. **HTTP Request Node**
   - GET, POST, PUT, DELETE, PATCH
   - Custom headers
   - Request body
   - Timeout configuration

2. **Delay Node**
   - Configurable delay in seconds

3. **Condition Node**
   - If/else logic
   - Variable comparison

---

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate app key
php artisan key:generate

# Run migrations
php artisan migrate

# Start development server
php artisan serve
```

### Docker Setup

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec app php artisan migrate

# View logs
docker-compose logs -f
```

---

## 📡 API Documentation

### Authentication

#### Register
```http
POST /api/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "tenant_name": "Acme Corp"
}
```

#### Login
```http
POST /api/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Workflows

#### Create Workflow
```http
POST /api/workflows
Authorization: Bearer {token}
X-Tenant-ID: {tenant_id}

{
  "name": "My Workflow",
  "definition": {
    "nodes": [
      {
        "id": "1",
        "type": "delay",
        "data": { "seconds": 5 }
      }
    ],
    "edges": []
  }
}
```

### Webhooks

#### Create Webhook
```http
POST /api/webhooks
Authorization: Bearer {token}
X-Tenant-ID: {tenant_id}

{
  "workflow_id": "uuid",
  "name": "My Webhook"
}
```

#### Trigger Webhook
```http
POST /api/webhooks/{token}
Content-Type: application/json

{
  "data": "Any JSON data"
}
```

### Schedules

#### Create Schedule
```http
POST /api/schedules
Authorization: Bearer {token}
X-Tenant-ID: {tenant_id}

{
  "workflow_id": "uuid",
  "name": "Daily Backup",
  "cron_expression": "0 2 * * *",
  "timezone": "UTC"
}
```

---

## 🔐 Multi-Tenant Security

### Data Isolation

- **Tenant Scope**: All queries automatically filtered by tenant_id
- **Row-Level Security**: Database constraints prevent cross-tenant access
- **API Guards**: X-Tenant-ID header required for all requests

### RBAC Roles

**Admin:** Full access to all resources
**Editor:** Create and edit workflows
**Viewer:** Read-only access

---

## 🔔 Real-Time Monitoring

### Broadcasting Channels

**Workflow-Level Channel:**
```javascript
const channel = Echo.private(`workflows.${workflowId}`);

channel.listen('.workflow.started', (e) => {
  console.log('Workflow started!', e);
});

channel.listen('.step.completed', (e) => {
  console.log('Step completed:', e.node_type);
});
```

**Tenant-Wide Channel:**
```javascript
const channel = Echo.private(`tenant.${tenantId}`);
channel.listen('.workflow.completed', (e) => {
  console.log('Workflow completed:', e.workflow_id);
});
```

### Events

- `workflow.started` - Workflow execution began
- `workflow.completed` - Workflow finished successfully
- `workflow.failed` - Workflow execution failed
- `step.started` - Step execution began
- `step.completed` - Step finished successfully
- `step.failed` - Step execution failed

---

## 🧪 Testing

```bash
# Run all tests
./vendor/bin/pest

# Run with coverage
./vendor/bin/pest --coverage
```

---

## 📈 Architecture Decisions

### Why PostgreSQL?

**Chosen because:**
- Native JSONB support for workflow definitions
- Advanced indexing capabilities
- ACID compliance for data integrity
- Excellent for multi-tenant architecture

### Why Custom Workflow Engine?

**Chosen because:**
- Complete control over execution logic
- No external dependencies
- Easier to debug and test
- Demonstrates engineering skills

---

## 🚧 Future Improvements

1. **Queue System** - Implement Laravel Queue for async execution
2. **Advanced Workflow Features** - Loop nodes, sub-workflows
3. **Monitoring & Observability** - Prometheus metrics, Grafana dashboards
4. **Scalability** - Horizontal scaling, read replicas
5. **Security Enhancements** - API key rotation, webhook signatures

---

## 📝 Project Structure

```
flowforge/
├── app/
│   ├── Broadcasting/          # Reverb channels
│   ├── Console/Commands/      # Scheduled commands
│   ├── Events/                # Broadcasting events
│   ├── Http/
│   │   ├── Controllers/Api/  # API controllers
│   │   ├── Middleware/        # Tenant, Auth middleware
│   │   ├── Requests/         # Form requests
│   │   └── Resources/        # API resources
│   ├── Models/               # Eloquent models
│   └── WorkflowEngine/       # Core engine
├── database/
│   ├── migrations/          # DB migrations
│   └── seeders/            # Database seeders
├── routes/
│   ├── api.php              # API routes
│   ├── channels.php         # Broadcast channels
│   └── console.php          # Console routes
└── tests/                   # Pest tests
```

---

## 🎓 Learning Outcomes

This project demonstrates:

1. **Backend Architecture** - Multi-tenant system design, workflow orchestration
2. **Database Design** - Relational modeling, indexing, data isolation
3. **API Design** - RESTful practices, authentication, rate limiting
4. **Testing** - Unit testing, integration testing, coverage
5. **DevOps** - Docker containerization, migrations, configuration

---

## ✅ Implementation Status

**Completed (8/8 Core Features):**

1. ✅ Database Design & Migrations
2. ✅ Authentication & RBAC
3. ✅ Multi-Tenant Isolation
4. ✅ Workflow CRUD Operations
5. ✅ Workflow Versioning
6. ✅ Workflow Engine (DAG, Validation, Execution)
7. ✅ Webhook & Cron Triggers
8. ✅ Real-Time Broadcasting

**Optional (Not Implemented):**
- Frontend (React Flow integration)
- AI Workflow Builder

---

**Built with ❤️ for technical assessment**

*Purpose: MVP demonstration of software engineering skills*
