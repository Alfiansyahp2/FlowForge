export interface User {
  id: string;
  name: string;
  email: string;
  tenant_id: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface Workflow {
  id: string;
  tenant_id: string;
  created_by: string;
  current_version_id: string | null;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: 'http' | 'delay' | 'condition' | 'script' | 'notification';
  data: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  definition: WorkflowDefinition;
  created_by: string;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  tenant_id: string;
  workflow_id: string;
  workflow_version_id: string;
  status: 'running' | 'completed' | 'failed';
  trigger_type: 'manual' | 'webhook' | 'cron';
  triggered_by: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration: number | null;
  step_runs?: StepRun[];
  workflow?: {
    id: string;
    name: string;
    definition?: WorkflowDefinition;
  };
  workflow_version?: {
    id: string;
    version: number;
    definition: WorkflowDefinition;
  };
}

export interface WorkflowStartResponse {
  workflow_run_id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  message?: string;
}

export interface StepRun {
  id: string;
  workflow_run_id: string;
  node_id: string;
  node_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  started_at: string;
  finished_at: string | null;
  duration: number | null;
}

export interface Webhook {
  id: string;
  tenant_id: string;
  workflow_id: string;
  name: string;
  description: string | null;
  token: string;
  is_active: boolean;
  last_triggered_at: string | null;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  tenant_id: string;
  workflow_id: string;
  workflow_version_id: string | null;
  name: string;
  description: string | null;
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  tenant_name: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// User Management
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
