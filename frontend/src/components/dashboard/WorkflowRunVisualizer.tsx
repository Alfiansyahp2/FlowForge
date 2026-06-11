import { useState, useEffect } from 'react';
import { runsApi } from '../../services/api';
import type { WorkflowRun, StepRun, WorkflowDefinition } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronLeft, Loader, CheckCircle, XCircle, Clock, Globe, GitBranch, Bell, Code } from 'lucide-react';

interface WorkflowRunVisualizerProps {
  runId: string;
  onBack?: () => void;
}

const NODE_TYPE_ICONS: Record<string, any> = {
  http: Globe,
  delay: Clock,
  condition: GitBranch,
  notification: Bell,
  script: Code,
  math: Code,
};

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: 'border-gray-300 bg-gray-50',
  running: 'border-blue-500 bg-blue-50 animate-pulse',
  completed: 'border-green-500 bg-green-50',
  failed: 'border-red-500 bg-red-50',
};

export function WorkflowRunVisualizer({ runId, onBack }: WorkflowRunVisualizerProps) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadRunDetails();
    if (autoRefresh) {
      const interval = setInterval(() => {
        if (run?.status === 'running') {
          loadRunDetails();
        }
      }, 2000); // Poll every 2 seconds for running workflows
      return () => clearInterval(interval);
    }
  }, [runId, autoRefresh, run?.status]);

  const loadRunDetails = async () => {
    try {
      setIsLoading(true);
      const response = await runsApi.get(runId);
      setRun(response.data);

      // Build visualization from workflow definition and step runs
      buildVisualization(response.data);
    } catch (error) {
      console.error('Failed to load run details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildVisualization = (runData: WorkflowRun) => {
    const definition = runData.workflow?.definition || runData.workflow_version?.definition;
    if (!definition) return;

    // Build nodes from workflow definition
    const workflowNodes: Node[] = (definition.nodes || []).map((node: any) => {
      // Find corresponding step run
      const stepRun = runData.step_runs?.find((s: StepRun) => s.node_id === node.id);

      return {
        id: node.id,
        type: 'default',
        position: node.position || { x: 0, y: 0 },
        data: {
          label: (
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {NODE_TYPE_ICONS[node.type] && (
                  <div className="p-1 bg-gray-100 rounded">
                    {React.createElement(NODE_TYPE_ICONS[node.type], { className: 'w-4 h-4' })}
                  </div>
                )}
                <span className="font-medium text-sm">{node.type.toUpperCase()}</span>
              </div>
              {stepRun && (
                <div className="mt-2">
                  <StepStatusBadge status={stepRun.status} />
                  {stepRun.duration > 0 && (
                    <div className="text-xs text-gray-500 mt-1">{stepRun.duration}ms</div>
                  )}
                  {stepRun.error_message && (
                    <div className="text-xs text-red-600 mt-1">{stepRun.error_message}</div>
                  )}
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: stepRun ? getStepBgColor(stepRun.status) : '#f9fafb',
          border: `2px solid ${getStepBorderColor(stepRun?.status || 'pending')}`,
          borderRadius: '8px',
          minWidth: '150px',
        },
        className: `step-node ${STEP_STATUS_COLORS[stepRun?.status || 'pending']}`,
      };
    });

    // Build edges from workflow definition
    const workflowEdges: Edge[] = (definition.edges || []).map((edge: any, index: number) => ({
      id: `e-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      animated: true,
      style: { stroke: '#cbd5e1', strokeWidth: 2 },
      labelStyle: { fontSize: 10, fontWeight: 600 },
    }));

    setNodes(workflowNodes);
    setEdges(workflowEdges);
  };

  const getStepBgColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: '#f9fafb',
      running: '#dbeafe',
      completed: '#dcfce7',
      failed: '#fee2e2',
    };
    return colors[status] || colors.pending;
  };

  const getStepBorderColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: '#d1d5db',
      running: '#3b82f6',
      completed: '#22c55e',
      failed: '#ef4444',
    };
    return colors[status] || colors.pending;
  };

  function StepStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
      running: 'bg-blue-100 text-blue-700 border-blue-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
      pending: 'bg-gray-100 text-gray-600 border-gray-200',
    };

    const icons: Record<string, any> = {
      running: Loader,
      completed: CheckCircle,
      failed: XCircle,
      pending: Clock,
    };

    const Icon = icons[status] || Clock;

    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${styles[status] || styles.pending}`}>
        {status === 'running' ? <Icon className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  if (isLoading || !run) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="flex items-center gap-3 text-gray-400">
            <Loader className="w-6 h-6 animate-spin" />
            <span>Loading workflow run visualization...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <Button size="sm" variant="outline" onClick={onBack}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <div>
                <CardTitle className="text-lg">{run.workflow?.name || 'Unknown Workflow'}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Run #{run.id.slice(0, 8)} • Triggered{' '}
                  {new Date(run.started_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StepStatusBadge status={run.status} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* DAG Visualization */}
      <Card>
        <CardContent className="p-0">
          <div style={{ height: '500px', width: '100%' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll={false}
              panOnScroll={false}
            >
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      {/* Step Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step Execution Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {run.step_runs && run.step_runs.length > 0 ? (
            <div className="space-y-3">
              {run.step_runs.map((step) => (
                <div
                  key={step.id}
                  className={`border rounded-lg p-4 ${STEP_STATUS_COLORS[step.status] || STEP_STATUS_COLORS.pending}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          Step {step.node_id} - {step.node_type.toUpperCase()}
                        </span>
                        <StepStatusBadge status={step.status} />
                      </div>
                      <div className="text-xs text-gray-600">
                        <span>Started: {new Date(step.started_at).toLocaleString()}</span>
                        {step.finished_at && (
                          <span className="ml-3">
                            Finished: {new Date(step.finished_at).toLocaleString()}
                          </span>
                        )}
                        {step.duration > 0 && <span className="ml-3">Duration: {step.duration}ms</span>}
                      </div>
                    </div>
                  </div>

                  {step.error_message && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700 font-medium mb-1">Error:</p>
                      <p className="text-sm text-red-600">{step.error_message}</p>
                    </div>
                  )}

                  {step.output && typeof step.output === 'object' && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
                      <p className="text-sm font-medium text-gray-700 mb-2">Output:</p>
                      <pre className="text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {step.retry_count > 0 && (
                    <div className="mt-2 text-xs text-amber-600">
                      Retried {step.retry_count} time(s)
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No step execution data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
