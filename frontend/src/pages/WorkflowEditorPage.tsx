import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ReactFlow, type Node, type Edge, addEdge, type Connection,
  useNodesState, useEdgesState, Controls, Background, MiniMap,
  BackgroundVariant, Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { workflowApi, runsApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { useModalStore } from '../components/ui/Modal';
import { PageLayout } from '../components/layout/PageLayout';
import type { Workflow, WorkflowRun, StepRun } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import {
  Save, ArrowLeft, Plus, Play, Lock, History,
  ChevronRight, X, RefreshCw, Zap,
  Globe, Clock, GitBranch, Code, Bell, Sparkles,
} from 'lucide-react';

// ── Node type config ──────────────────────────────────────────────────────────
const NODE_TYPES_CONFIG = [
  { type: 'http',         label: 'HTTP Request', icon: Globe,     color: 'bg-amber-100 text-amber-800 border-amber-200',   desc: 'Make HTTP requests' },
  { type: 'delay',        label: 'Delay',        icon: Clock,     color: 'bg-blue-100 text-blue-800 border-blue-200',      desc: 'Wait for N seconds' },
  { type: 'condition',    label: 'Condition',    icon: GitBranch, color: 'bg-purple-100 text-purple-800 border-purple-200',desc: 'If/else branching' },
  { type: 'script',       label: 'Script',       icon: Code,      color: 'bg-orange-100 text-orange-800 border-orange-200',desc: 'Run custom code' },
  { type: 'notification', label: 'Notification', icon: Bell,      color: 'bg-green-100 text-green-800 border-green-200',   desc: 'Send notifications' },
];

// ── Node default data per type ────────────────────────────────────────────────
const NODE_DEFAULTS: Record<string, Record<string, unknown>> = {
  http:         { url: 'https://example.com', method: 'GET', headers: {}, timeout: 30 },
  delay:        { seconds: 5 },
  condition:    { expression: 'true' },
  script:       { code: 'return true;' },
  notification: { message: 'Workflow step completed' },
};

// ── Node label builder ────────────────────────────────────────────────────────
function buildNodeLabel(type: string, index: number): string {
  const cfg = NODE_TYPES_CONFIG.find(n => n.type === type);
  return `${cfg?.label ?? type} ${index + 1}`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function RunStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running:   'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    failed:    'bg-red-100 text-red-700 border-red-200',
    pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    timeout:   'bg-orange-100 text-orange-700 border-orange-200',
    skipped:   'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkflowEditorPage() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { can, role } = usePermissions();
  const { confirm, denied, success } = useModalStore();

  const isNew      = id === 'new';
  const canEdit    = can('edit workflows');
  const canCreate  = can('create workflows');
  const canExecute = can('execute workflows');
  const canSave    = isNew ? canCreate : canEdit;

  // ── State ─────────────────────────────────────────────────────────────────
  const [workflow, setWorkflow]   = useState<Workflow | null>(null);
  const [name, setName]           = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving]   = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [sidePanel, setSidePanel] = useState<'nodes' | 'runs' | 'settings' | 'ai'>('nodes');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [runs, setRuns]           = useState<WorkflowRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runDetails, setRunDetails] = useState<WorkflowRun | null>(null);
  const [runDetailsLoading, setRunDetailsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ── Load workflow ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (id && !isNew) {
      loadWorkflow(id);
    } else if (isNew) {
      // Reset for new workflow
      setName('');
      setDescription('');
      setWorkflow(null);
      setNodes([]);
      setEdges([]);
    }
  }, [id, isNew]);

  const loadWorkflow = async (workflowId: string) => {
    try {
      const data = await workflowApi.get(workflowId);
      // API may return a wrapped object { data: { ... } }
      const payload = (data && (data as any).data) ? (data as any).data : data;
      setWorkflow(payload);
      setName(payload.name || 'Untitled Workflow');
      setDescription(payload.description || '');

      // Handle definition - might be JSON string or object
      let definition = payload.definition ?? null;
      if (definition && typeof definition === 'string') {
        try {
          definition = JSON.parse(definition);
        } catch (e) {
          console.error('Failed to parse definition:', e);
          definition = null;
        }
      }

      if (definition && definition.nodes) {
        const flowNodes: Node[] = (definition.nodes ?? []).map((node: any, i: number) => ({
          id: node.id,
          type: 'default',
          position: node.position || { x: 150 + (i % 3) * 250, y: 100 + Math.floor(i / 3) * 150 },
          data: {
            label: buildNodeLabel(node.type, i),
            nodeType: node.type,
            config: node.data ?? {},
          },
        }));

        const flowEdges: Edge[] = (definition.edges ?? []).map((edge: any) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          animated: true,
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
      } else {
        // No valid definition found
        console.warn('No valid definition found for workflow:', workflowId);
        setNodes([]);
        setEdges([]);
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
      setNodes([]);
      setEdges([]);
    }
  };

  // ── Load runs ─────────────────────────────────────────────────────────────
  const loadRuns = async () => {
    if (isNew || !id) return;
    setRunsLoading(true);
    try {
      const res = await runsApi.list({ workflow_id: id });
      setRuns(res.data ?? []);
    } catch (err) {
      console.error('Failed to load runs', err);
    } finally {
      setRunsLoading(false);
    }
  };

  const loadRunDetails = async (runId: string) => {
    setRunDetailsLoading(true);
    try {
      const run = await runsApi.get(runId);
      setRunDetails(run);
      setSelectedRunId(runId);
    } catch (err) {
      console.error('Failed to load run details', err);
    } finally {
      setRunDetailsLoading(false);
    }
  };

  // ── WebSockets Real-Time Monitoring ──────────────────────────────────────────
  useEffect(() => {
    if (isNew || !id) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: number;

    const connectWebSocket = async () => {
      try {
        const authRaw = localStorage.getItem('auth-storage');
        let token = '';
        let tenantId = '';
        if (authRaw) {
          const auth = JSON.parse(authRaw);
          token = auth?.state?.token || '';
          tenantId = auth?.state?.user?.tenant_id || '';
        }

        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/config/reverb`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
          }
        });
        const { key, host, port } = res.data;

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${protocol}://${host}:${port}/app/${key}?protocol=7&client=js&version=4.4.0`);

        ws.onopen = () => {
          console.log('WebSocket Connected to Reverb');
          ws?.send(JSON.stringify({
            event: 'pusher:subscribe',
            data: { channel: `workflows.${id}` }
          }));
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.event && parsed.data) {
              const eventData = JSON.parse(parsed.data);
              
              if (parsed.event === 'step.started' || parsed.event === 'step.completed' || parsed.event === 'step.failed') {
                setRunDetails(prev => {
                  if (!prev || prev.id !== eventData.workflow_run_id) return prev;
                  const stepRuns = [...(prev.step_runs ?? [])];
                  const idx = stepRuns.findIndex(s => s.id === eventData.id);
                  if (idx !== -1) {
                    stepRuns[idx] = { ...stepRuns[idx], ...eventData };
                  } else {
                    stepRuns.push(eventData);
                  }
                  return { ...prev, step_runs: stepRuns };
                });
                loadRuns();
              } else if (parsed.event === 'workflow.started' || parsed.event === 'workflow.completed' || parsed.event === 'workflow.failed') {
                setRunDetails(prev => {
                  if (!prev || prev.id !== eventData.id) return prev;
                  return { ...prev, ...eventData };
                });
                loadRuns();
              }
            }
          } catch (e) {
            console.error('Error handling WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket Connection Closed. Reconnecting...');
          reconnectTimeout = window.setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (err) => {
          console.error('WebSocket Error:', err);
        };
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        reconnectTimeout = window.setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [id, isNew]);

  // ── Canvas Node Styling based on step run status ──────────────────────────────
  useEffect(() => {
    if (runDetails && runDetails.step_runs) {
      setNodes(nds => nds.map(n => {
        const step = runDetails.step_runs?.find((s: any) => s.node_id === n.id);
        if (step) {
          let styleAttrs: Record<string, string> = {
            border: '2px solid transparent',
          };
          if (step.status === 'completed') {
            styleAttrs = { border: '2px solid #22c55e', backgroundColor: '#f0fdf4', color: '#14532d', boxShadow: '0 0 10px rgba(34,197,94,0.3)' };
          } else if (step.status === 'failed') {
            styleAttrs = { border: '2px solid #ef4444', backgroundColor: '#fef2f2', color: '#7f1d1d', boxShadow: '0 0 10px rgba(239,68,68,0.3)' };
          } else if (step.status === 'running') {
            styleAttrs = { border: '2px solid #3b82f6', backgroundColor: '#eff6ff', color: '#1e3a8a', boxShadow: '0 0 10px rgba(59,130,246,0.5)' };
          } else if (step.status === 'timeout') {
            styleAttrs = { border: '2px solid #f59e0b', backgroundColor: '#fffbeb', color: '#78350f', boxShadow: '0 0 10px rgba(245,158,11,0.3)' };
          } else if (step.status === 'skipped') {
            styleAttrs = { border: '2px solid #d1d5db', backgroundColor: '#f3f4f6', color: '#9ca3af', opacity: '0.6' };
          }

          return {
            ...n,
            style: { ...n.style, ...styleAttrs }
          };
        }
        return n;
      }));
    } else {
      // Reset styles if no run is active/selected
      setNodes(nds => nds.map(n => ({
        ...n,
        style: undefined
      })));
    }
  }, [runDetails, setNodes]);

  useEffect(() => {
    if (sidePanel === 'runs') loadRuns();
  }, [sidePanel]);

  // ── Canvas callbacks ──────────────────────────────────────────────────────
  const onConnect = useCallback(
    (params: Connection) => {
      if (!canEdit) return;
      setEdges(eds => addEdge({ ...params, type: 'smoothstep', animated: true }, eds));
    },
    [setEdges, canEdit]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // ── Add node ──────────────────────────────────────────────────────────────
  const addNodeOfType = useCallback((type: string) => {
    const existingCount = nodes.filter(n => n.data?.nodeType === type).length;
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: 'default',
      position: {
        x: 100 + (nodes.length % 4) * 220,
        y: 100 + Math.floor(nodes.length / 4) * 150,
      },
      data: {
        label: buildNodeLabel(type, existingCount),
        nodeType: type,
        config: { ...NODE_DEFAULTS[type] },
      },
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNode(newNode);
  }, [nodes, setNodes]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!canSave) { denied(isNew ? 'create workflows' : 'edit workflows'); return; }
    if (!name.trim()) {
      confirm({
        title: 'Name required',
        message: 'Please give your workflow a name before saving.',
        type: 'warning', icon: 'warning', confirmLabel: 'OK', cancelLabel: '',
        onConfirm: () => {},
      });
      return;
    }

    confirm({
      title: isNew ? 'Create workflow' : 'Save changes',
      message: isNew
        ? `Create "${name}" with ${nodes.length} node(s) and ${edges.length} connection(s)?`
        : `Save changes to "${name}"? A new version will be created.`,
      type: 'info', icon: 'info', confirmLabel: 'Save',
      onConfirm: async () => {
        setIsSaving(true);
        try {
          // Build proper WorkflowDefinition
          const validNodeTypes = ['http', 'delay', 'condition', 'script', 'notification'] as const;
          const definition = {
            nodes: nodes.map((node: Node) => {
              const nodeType = node.data?.nodeType as string;
              const validType = validNodeTypes.includes(nodeType as any) ? nodeType as 'http' | 'delay' | 'condition' | 'script' | 'notification' : 'http';

              return {
                id:       node.id,
                type:     validType,
                data:     (node.data?.config as Record<string, unknown>) || {},
                position: node.position,
              };
            }),
            edges: edges.map((edge: Edge) => ({
              id:     edge.id || `edge-${edge.source}-${edge.target}`,
              source: edge.source,
              target: edge.target,
            })),
          };

          // Backend expects definition as JSON string, not object
          const definitionString = JSON.stringify(definition);

          if (isNew) {
            const created = await workflowApi.create({
              name, description,
              definition: definitionString,  // Send as STRING
              status: 'draft',
            });
            if (!created?.id) {
              throw new Error('Server response missing workflow ID');
            }
            success(`Workflow "${name}" created.`);
            navigate(`/workflows/${created.id}`);
          } else {
            await workflowApi.update(id!, {
              name,
              description,
              definition: definitionString  // Send as STRING
            });
            success(`Workflow "${name}" saved.`);
            loadWorkflow(id!);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          const apiError = (err as any)?.response?.data?.message || errorMsg;
          console.error('Save failed', err);
          confirm({
            title: 'Save failed',
            message: `Error: ${apiError}`,
            type: 'danger',
            icon: 'warning',
            confirmLabel: 'OK',
            cancelLabel: '',
            onConfirm: () => {},
          });
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  // ── Run ───────────────────────────────────────────────────────────────────
  const handleRun = () => {
    if (!canExecute) { denied('execute workflows'); return; }
    if (isNew) {
      confirm({
        title: 'Save first',
        message: 'Save the workflow before running it.',
        type: 'warning', icon: 'warning', confirmLabel: 'OK', cancelLabel: '',
        onConfirm: () => {},
      });
      return;
    }

    confirm({
      title: 'Run workflow',
      message: `Start a manual execution of "${name}" now?`,
      type: 'info', icon: 'run', confirmLabel: 'Run now',
      onConfirm: async () => {
        setIsRunning(true);
        try {
          const result = await workflowApi.run(id!);
          success(`Workflow "${name}" started.`);
          setSidePanel('runs');
          setTimeout(loadRuns, 800);
          if (result?.workflow_run_id) {
            loadRunDetails(result.workflow_run_id);
          }
        } catch (err: unknown) {
          const e = err as { response?: { data?: { message?: string } } };
          confirm({
            title: 'Run failed',
            message: e.response?.data?.message ?? 'Workflow execution failed.',
            type: 'danger', icon: 'warning', confirmLabel: 'OK', cancelLabel: '',
            onConfirm: () => {},
          });
        } finally {
          setIsRunning(false);
        }
      },
    });
  };

  // ── AI Workflow Generation ──────────────────────────────────────────────────
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;

    confirm({
      title: 'Generate workflow with AI',
      message: 'Generating with AI will overwrite the current nodes and edges on the canvas. Do you want to proceed?',
      type: 'warning',
      icon: 'warning',
      confirmLabel: 'Proceed',
      onConfirm: async () => {
        setIsGenerating(true);
        try {
          const authRaw = localStorage.getItem('auth-storage');
          let token = '';
          let tenantId = '';
          if (authRaw) {
            const auth = JSON.parse(authRaw);
            token = auth?.state?.token || '';
            tenantId = auth?.state?.user?.tenant_id || '';
          }

          const response = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/workflows/ai/generate`,
            { prompt: aiPrompt },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': tenantId,
              }
            }
          );

          if (response.data?.success && response.data?.definition) {
            const definition = response.data.definition;
            
            // Map definition to React Flow nodes and edges
            const validNodeTypes = ['http', 'delay', 'condition', 'script', 'notification'] as const;
            
            const generatedNodes = (definition.nodes ?? []).map((node: any, i: number) => {
              const nodeType = node.type;
              const validType = validNodeTypes.includes(nodeType) ? nodeType : 'http';
              return {
                id: node.id,
                type: 'default',
                position: node.position || { x: 150 + (i % 3) * 250, y: 100 + Math.floor(i / 3) * 150 },
                data: {
                  label: buildNodeLabel(validType, i),
                  nodeType: validType,
                  config: node.data ?? {},
                },
              };
            });

            const generatedEdges = (definition.edges ?? []).map((edge: any) => ({
              id: edge.id || `edge-${edge.source}-${edge.target}`,
              source: edge.source,
              target: edge.target,
              type: 'smoothstep',
              animated: true,
            }));

            setNodes(generatedNodes);
            setEdges(generatedEdges);
            success('AI Workflow generated successfully!');
            setSidePanel('nodes');
          }
        } catch (err: any) {
          console.error('AI Generation failed', err);
          const apiError = err.response?.data?.message || err.response?.data?.error || err.message;
          confirm({
            title: 'Generation failed',
            message: `Error: ${apiError}`,
            type: 'danger',
            icon: 'warning',
            confirmLabel: 'OK',
            cancelLabel: '',
            onConfirm: () => {},
          });
        } finally {
          setIsGenerating(false);
        }
      }
    });
  };

  // ── Role badge ────────────────────────────────────────────────────────────
  const ROLE_BADGE: Record<string, string> = {
    admin:  'bg-purple-100 text-purple-700 border-purple-200',
    editor: 'bg-blue-100 text-blue-700 border-blue-200',
    viewer: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const headerContent = (
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0 relative z-10">
      <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="h-8 w-8">
        <ArrowLeft className="w-4 h-4" />
      </Button>

      {canSave ? (
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Workflow name..."
          className="text-base font-semibold border-none bg-transparent focus-visible:ring-0 px-0 max-w-xs"
        />
      ) : (
        <h1 className="text-base font-semibold text-gray-800 truncate max-w-xs">
          {name || 'Untitled Workflow'}
        </h1>
      )}

      {workflow && (
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
          workflow.status === 'active'   ? 'bg-green-100 text-green-700 border-green-200' :
          workflow.status === 'archived' ? 'bg-gray-100 text-gray-500 border-gray-200' :
          'bg-yellow-100 text-yellow-700 border-yellow-200'
        }`}>
          {workflow.status}
        </span>
      )}

      <div className="flex-1" />

      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_BADGE[role] ?? ROLE_BADGE['viewer']}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>

      {!canEdit && (
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
          <Lock className="w-3 h-3" />View only
        </span>
      )}

      <Button
        variant="outline" size="sm"
        onClick={handleRun}
        disabled={isNew || isRunning}
        className={!canExecute ? 'opacity-50' : ''}
      >
        {isRunning
          ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Running...</>
          : <><Play className="w-3.5 h-3.5 mr-1.5" />Run</>}
      </Button>

      <Button
        size="sm" onClick={handleSave} disabled={isSaving}
        className={!canSave ? 'opacity-50' : ''}
      >
        {isSaving
          ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</>
          : <><Save className="w-3.5 h-3.5 mr-1.5" />{canSave ? 'Save' : 'View only'}</>}
      </Button>
    </div>
  );

  const sidebarContent = (
    <div className="flex flex-col overflow-hidden">
      <div className="flex border-b border-gray-100">
        {[
          { key: 'nodes',    label: 'Nodes',    icon: Zap },
          { key: 'ai',       label: 'AI Builder', icon: Sparkles },
          { key: 'runs',     label: 'Runs',     icon: History },
          { key: 'settings', label: 'Settings', icon: ChevronRight },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setSidePanel(tab.key as typeof sidePanel)}
              className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                sidePanel === tab.key
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mb-0.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {sidePanel === 'nodes' && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {canEdit ? 'Click to add' : 'Available types'}
            </p>
            {NODE_TYPES_CONFIG.map(n => {
              const Icon = n.icon;
              return (
                <button
                  key={n.type}
                  disabled={!canEdit}
                  onClick={() => canEdit && addNodeOfType(n.type)}
                  className={`w-full text-left flex items-start gap-2 p-2 rounded-lg border text-xs transition-all ${n.color} ${
                    canEdit
                      ? 'hover:scale-[1.02] hover:shadow-sm cursor-pointer active:scale-[0.98]'
                      : 'cursor-default opacity-70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{n.label}</p>
                    <p className="opacity-60">{n.desc}</p>
                  </div>
                  {canEdit && <Plus className="w-3.5 h-3.5 ml-auto opacity-40 flex-shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}
        {sidePanel === 'ai' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Workflow Builder</p>
            </div>
            
            <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 text-xs text-indigo-800 space-y-1.5">
              <p className="font-semibold">Describe the workflow in natural language</p>
              <p className="opacity-90">Specify steps like HTTP calls, delay nodes, checking conditions, or sending notifications. AI will automatically generate and connect the DAG.</p>
              <span className="inline-block bg-white text-indigo-600 font-medium px-2 py-0.5 rounded border border-indigo-200 text-[10px]">
                Supports English & Indonesian
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500 font-medium mb-1 block">Prompt</Label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Example: Send POST request to pay api, wait 5 seconds, check if status is 200, if true send notification."
                  disabled={isGenerating || !canEdit}
                  rows={6}
                  className="w-full text-xs rounded-md border border-input bg-background px-2.5 py-2 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none text-gray-800 placeholder-gray-400 disabled:bg-gray-50"
                />
              </div>

              <Button
                onClick={handleAIGenerate}
                disabled={isGenerating || !aiPrompt.trim() || !canEdit}
                className="w-full text-xs py-2 flex items-center justify-center gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Workflow
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        {sidePanel === 'runs' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Runs</p>
              <button onClick={loadRuns} className="text-gray-400 hover:text-indigo-600 transition-colors">
                <RefreshCw className={`w-3 h-3 ${runsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {isNew ? (
              <p className="text-xs text-gray-400 italic text-center py-4">Save workflow first to see runs</p>
            ) : runsLoading ? (
              <div className="flex justify-center py-6">
                <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : runs.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">No runs yet. Click Run to start.</p>
            ) : (
              <div className="space-y-2">
                {runDetails && selectedRunId === runDetails.id && (
                  <div className="bg-white border border-indigo-100 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-semibold">Run details</p>
                        <p className="text-xs text-gray-500">{runDetails.trigger_type} • {runDetails.status}</p>
                      </div>
                      {runDetailsLoading && (
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      )}
                    </div>
                    <div className="space-y-2 text-xs">
                      {runDetails.step_runs?.map((step: StepRun, index) => (
                        <div key={step.id} className="rounded-lg border border-gray-100 p-2 bg-gray-50">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">Node {index + 1} ({step.node_type})</span>
                            <RunStatusBadge status={step.status} />
                          </div>
                          <p className="text-gray-500 text-[11px]">
                            Started: {step.started_at ? new Date(step.started_at).toLocaleTimeString('id-ID') : '—'}
                            {' • '}
                            Finished: {step.finished_at ? new Date(step.finished_at).toLocaleTimeString('id-ID') : '—'}
                          </p>
                          {step.duration != null && (
                            <p className="text-gray-400 text-[11px]">Duration: {step.duration}ms</p>
                          )}
                          {step.error_message && (
                            <p className="text-red-600 text-[11px]">Error: {step.error_message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {runs.map(run => (
                  <button
                    key={run.id}
                    onClick={() => loadRunDetails(run.id)}
                    className={`w-full text-left bg-gray-50 border rounded-lg p-2 space-y-1 transition ${selectedRunId === run.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <RunStatusBadge status={run.status} />
                      <span className="text-xs text-gray-400">{run.trigger_type}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {run.started_at
                        ? new Date(run.started_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </p>
                    {run.duration != null && (
                      <p className="text-xs text-gray-400">{run.duration}s</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {sidePanel === 'settings' && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</Label>
              {canSave ? (
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What does this workflow do?"
                  className="mt-1 text-sm"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-600 italic">
                  {description || 'No description'}
                </p>
              )}
            </div>
            {workflow && (
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-gray-500 uppercase tracking-wider">Info</p>
                <div className="flex justify-between"><span className="text-gray-400">Status</span><span className="capitalize font-medium">{workflow.status}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">ID</span><span className="font-mono text-gray-500 text-xs truncate max-w-24">{workflow.id.slice(0, 8)}…</span></div>
              </div>
            )}
          </div>
        )}

        {/* Stats Section - Bottom */}
        <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Nodes</span><span className="font-medium text-gray-800">{nodes.length}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Connections</span><span className="font-medium text-gray-800">{edges.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const mainContent = (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="flex-1 h-full relative" style={{ zIndex: 1 }}>
        {!canEdit && (
          <div
            className="absolute inset-0 cursor-not-allowed"
            style={{ zIndex: 10 }}
            title="View only — you don't have permission to edit"
          />
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={canEdit ? onNodesChange : undefined}
          onEdgesChange={canEdit ? onEdgesChange : undefined}
          onConnect={canEdit ? onConnect : undefined}
          onNodeClick={onNodeClick}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={canEdit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={canEdit ? 'Backspace' : null}
          className="h-full"
        >
          <Controls showInteractive={canEdit} className="!z-10" />
          <MiniMap nodeColor={() => '#6366f1'} maskColor="rgba(0,0,0,0.05)" className="!z-10" />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
          {nodes.length === 0 && (
            <Panel position="top-center" className="mt-16 !z-20">
              <div className="bg-white rounded-xl border border-dashed border-gray-300 px-8 py-6 text-center shadow-sm">
                <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-400">
                  {canEdit ? 'Click a node type on the left to start building' : 'No nodes in this workflow'}
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
      {selectedNode && canEdit && (
        <aside className="w-56 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700 truncate">{String(selectedNode.data?.label ?? 'Node')}</p>
            <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {(() => {
              const cfg = NODE_TYPES_CONFIG.find(n => n.type === selectedNode.data?.nodeType);
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-medium ${cfg.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </div>
              );
            })()}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Label</Label>
              <Input
                value={String(selectedNode.data?.label ?? '')}
                onChange={e => {
                  setNodes(nds => nds.map(n =>
                    n.id === selectedNode.id
                      ? { ...n, data: { ...n.data, label: e.target.value } }
                      : n
                  ));
                  setSelectedNode(s => s ? { ...s, data: { ...s.data, label: e.target.value } } : s);
                }}
                className="text-xs h-7"
              />
            </div>
            {renderNodeConfig(selectedNode, setNodes, setSelectedNode)}
            <button
              onClick={() => {
                setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                setSelectedNode(null);
              }}
              className="w-full text-xs text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg py-1.5 transition-colors"
            >
              Remove node
            </button>
          </div>
        </aside>
      )}
    </div>
  );

  return (
    <PageLayout sidebar={sidebarContent} header={headerContent} main={mainContent} noScrollWrapper={true} />
  );
}

// ── Node config form ──────────────────────────────────────────────────────────
function renderNodeConfig(
  node: Node,
  setNodes: (updater: (nds: Node[]) => Node[]) => void,
  setSelectedNode: (updater: (s: Node | null) => Node | null) => void,
) {
  const nodeType = node.data?.nodeType as string;
  const config   = (node.data?.config ?? {}) as Record<string, unknown>;

  const update = (key: string, value: unknown) => {
    setNodes(nds => nds.map(n =>
      n.id === node.id
        ? { ...n, data: { ...n.data, config: { ...(n.data?.config as object), [key]: value } } }
        : n
    ));
    setSelectedNode(s => s ? { ...s, data: { ...s.data, config: { ...(s.data?.config as object), [key]: value } } } : s);
  };

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div key={key} className="space-y-1">
      <Label className="text-xs text-gray-500">{label}</Label>
      <Input
        type={type}
        value={String(config[key] ?? '')}
        onChange={e => update(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="text-xs h-7"
      />
    </div>
  );

  const selectField = (label: string, key: string, options: string[]) => (
    <div key={key} className="space-y-1">
      <Label className="text-xs text-gray-500">{label}</Label>
      <select
        value={String(config[key] ?? options[0])}
        onChange={e => update(key, e.target.value)}
        className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  switch (nodeType) {
    case 'http':
      return (
        <div className="space-y-2">
          {selectField('Method', 'method', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])}
          {field('URL', 'url', 'text', 'https://api.example.com/endpoint')}
          {field('Timeout (s)', 'timeout', 'number', '30')}
        </div>
      );
    case 'delay':
      return <div className="space-y-2">{field('Seconds', 'seconds', 'number', '5')}</div>;
    case 'condition':
      return <div className="space-y-2">{field('Expression', 'expression', 'text', 'true')}</div>;
    case 'script':
      return (
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Code</Label>
          <textarea
            value={String(config['code'] ?? '')}
            onChange={e => update('code', e.target.value)}
            placeholder="return true;"
            rows={5}
            className="w-full text-xs rounded-md border border-input bg-background px-2 py-1.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none"
          />
        </div>
      );
    case 'notification':
      return <div className="space-y-2">{field('Message', 'message', 'text', 'Step completed')}</div>;
    default:
      return null;
  }
}
