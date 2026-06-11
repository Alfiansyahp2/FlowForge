You are a Senior Staff Software Engineer and System Architect.

I am building a technical assessment project called FlowForge.

The goal is NOT to build a perfect enterprise product.

The goal is to deliver a high-quality MVP within 4 days while demonstrating strong software engineering principles, architecture, backend design, workflow orchestration concepts, testing, and operational thinking.

=================================================
PROJECT OVERVIEW
=================================================

FlowForge is a multi-tenant workflow orchestration platform inspired by:

- Zapier
- n8n
- GitHub Actions

Users can create workflows represented as Directed Acyclic Graphs (DAGs).

Each workflow contains nodes and edges.

The platform must:

- Create workflows
- Version workflows
- Execute workflows
- Monitor workflows
- Trigger workflows
- Manage workflow runs
- Support multiple tenants

=================================================
TECH STACK
=================================================

Backend:
- Laravel 12
- PHP 8.3+
- PostgreSQL
- Redis
- Laravel Queue
- Laravel Scheduler
- Laravel Sanctum
- Spatie Permission
- Laravel Reverb

Frontend:
- React
- TypeScript
- React Flow
- TailwindCSS
- Shadcn UI

Infrastructure:
- Docker
- Docker Compose

Testing:
- Pest
- PHPUnit

=================================================
IMPORTANT ARCHITECTURAL DECISIONS
=================================================

This is a backend-heavy project.

The Workflow Engine is the most important component.

Prioritize:

1. Workflow Engine
2. Multi-Tenant Architecture
3. Workflow Execution
4. Retry Logic
5. Monitoring
6. Frontend

Do NOT over-engineer.

Build a realistic MVP.

=================================================
MULTI-TENANT REQUIREMENTS
=================================================

Entities:

Tenant
User
Workflow
WorkflowVersion
WorkflowRun
StepRun

Every entity belongs to a tenant.

Users must never access data from another tenant.

Roles:

Admin
Editor
Viewer

Implement RBAC using Spatie Permission.

Authentication via Laravel Sanctum.

=================================================
DATABASE DESIGN
=================================================

Create migrations and Eloquent models for:

tenants
users
workflows
workflow_versions
workflow_runs
step_runs
webhooks
schedules

Relationships must be clearly defined.

Include indexes.

Explain optimization opportunities.

=================================================
WORKFLOW DEFINITION
=================================================

A workflow consists of:

Nodes
Edges

Store workflow definition as JSON.

Example:

{
  "nodes": [
    {
      "id": "1",
      "type": "http"
    }
  ],
  "edges": []
}

=================================================
SUPPORTED NODE TYPES
=================================================

MVP supports:

1. HTTP Request Node
2. Delay Node
3. Condition Node

Optional:

4. Script Node
5. Notification Node

Focus on HTTP, Delay, and Condition first.

=================================================
WORKFLOW ENGINE
=================================================

Create a dedicated Workflow Engine.

Suggested structure:

app/WorkflowEngine

Components:

- WorkflowValidator
- CycleDetector
- TopologicalSorter
- WorkflowExecutor
- RetryManager
- TimeoutManager

=================================================
DAG VALIDATION
=================================================

Validate:

- No circular dependencies
- Valid node references
- Valid edge references

Reject workflows that contain cycles.

Example invalid graph:

A -> B -> C -> A

=================================================
TOPOLOGICAL SORT
=================================================

Implement topological sorting.

Example:

A
↓
B
↓
C

Execution order:

A → B → C

=================================================
PARALLEL EXECUTION
=================================================

Example:

      A
     / \
    B   C
     \ /
      D

Execution:

1. Run A
2. Run B and C in parallel
3. Run D

Implement dependency resolution.

=================================================
RETRY LOGIC
=================================================

Support retries.

Configurable:

max_retries
retry_delay

Implement exponential backoff.

Example:

Retry 1 = 1 second
Retry 2 = 2 seconds
Retry 3 = 4 seconds

=================================================
WORKFLOW TIMEOUT
=================================================

Support workflow timeout.

Example:

Workflow timeout = 30 minutes

If exceeded:

Mark workflow as failed.

=================================================
WORKFLOW EXECUTION
=================================================

Store execution information.

WorkflowRun:

- workflow_id
- status
- started_at
- finished_at
- duration

StepRun:

- workflow_run_id
- node_id
- status
- started_at
- finished_at
- duration
- error_message

=================================================
TRIGGERS
=================================================

Support:

1. Manual Trigger
2. Cron Trigger
3. Webhook Trigger

Cron:

Use Laravel Scheduler.

Webhook:

Generate unique webhook URL per workflow.

=================================================
REAL-TIME MONITORING
=================================================

Use Laravel Reverb.

Broadcast events:

workflow.started
workflow.completed
workflow.failed

step.started
step.completed
step.failed

Frontend subscribes and updates workflow status live.

=================================================
API DESIGN
=================================================

Create REST API.

Authentication:

POST /api/login
POST /api/logout

Workflows:

GET /api/workflows
POST /api/workflows
GET /api/workflows/{id}
PUT /api/workflows/{id}
DELETE /api/workflows/{id}

Versions:

GET /api/workflows/{id}/versions
POST /api/workflows/{id}/rollback

Execution:

POST /api/workflows/{id}/run

Runs:

GET /api/runs

Webhook:

POST /api/webhooks/{token}

Schedules:

POST /api/schedules

Requirements:

- Validation
- Pagination
- Filtering
- Rate Limiting

=================================================
TESTING REQUIREMENTS
=================================================

Create tests for:

Unit Tests:

- Cycle Detection
- Topological Sort
- Retry Logic

Integration Tests:

- Workflow CRUD
- Workflow Execution

End-to-End Tests:

- Complete workflow execution

=================================================
DOCKER REQUIREMENTS
=================================================

Provide:

Dockerfile
docker-compose.yml

Services:

- Laravel
- PostgreSQL
- Redis

Application should start with:

docker-compose up

=================================================
AI FEATURE
=================================================

Implement:

Natural Language Workflow Builder

Input:

"When payment succeeds, send email and wait 5 minutes"

Output:

Valid workflow JSON DAG.

Use OpenAI API.

Validate generated JSON.

Handle malformed responses safely.

=================================================
README REQUIREMENTS
=================================================

Generate:

1. Setup Instructions
2. Architecture Overview
3. Database Design
4. Workflow Engine Design
5. API Documentation
6. Trade-Off Decisions
7. Future Improvements

=================================================
IMPLEMENTATION STRATEGY
=================================================

Work in this order:

1. Database
2. Authentication
3. Multi-Tenant Isolation
4. Workflow CRUD
5. Workflow Versioning
6. DAG Validation
7. Topological Sort
8. Workflow Execution
9. Retry Logic
10. Webhook Trigger
11. Cron Trigger
12. Real-Time Monitoring
13. Frontend Integration
14. AI Workflow Builder

Focus on clean architecture, maintainability, SOLID principles, testability, and interview-quality code.