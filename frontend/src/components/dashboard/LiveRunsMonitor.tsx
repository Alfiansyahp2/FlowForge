import { useState, useEffect, useCallback } from 'react';
import { runsApi } from '../../services/api';
import { cache, CacheKeys } from '../../lib/cache';
import { useWebSocket } from '../../lib/websocket';
import type { WorkflowRun } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Play, AlertCircle, CheckCircle, Loader, XCircle, RefreshCw } from 'lucide-react';

interface LiveRunsMonitorProps {
  tenantId: string;
  onError?: (error: string) => void;
}

export function LiveRunsMonitor({ tenantId, onError }: LiveRunsMonitorProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Use WebSocket hook for real-time updates
  const { status: connectionStatus, subscribe } = useWebSocket(tenantId);

  // Load initial active runs from cache or API
  useEffect(() => {
    loadActiveRuns();
  }, []);

  // Subscribe to real-time events
  useEffect(() => {
    if (!tenantId || connectionStatus !== 'connected') return;

    const unsubscribers = [
      // Listen for workflow started events
      subscribe(
        `tenant.${tenantId}`,
        'workflow.started',
        (data: WorkflowRun) => {
          setRuns((prev) => {
            const exists = prev.some((r) => r.id === data.id);
            if (exists) return prev;
            return [data, ...prev].slice(0, 10);
          });
        }
      ),

      // Listen for workflow completed events
      subscribe(
        `tenant.${tenantId}`,
        'workflow.completed',
        (data: WorkflowRun) => {
          setRuns((prev) => prev.filter((r) => r.id !== data.id));
        }
      ),

      // Listen for workflow failed events
      subscribe(
        `tenant.${tenantId}`,
        'workflow.failed',
        (data: WorkflowRun) => {
          setRuns((prev) => prev.filter((r) => r.id !== data.id));
        }
      ),

      // Listen for step started events
      subscribe(
        `tenant.${tenantId}`,
        'step.started',
        (data: any) => {
          setRuns((prev) =>
            prev.map((run) => {
              if (run.id === data.workflow_run_id) {
                return {
                  ...run,
                  step_runs: run.step_runs?.map((step) =>
                    step.id === data.id ? { ...step, ...data } : step
                  ) || [],
                };
              }
              return run;
            })
          );
        }
      ),

      // Listen for step completed events
      subscribe(
        `tenant.${tenantId}`,
        'step.completed',
        (data: any) => {
          setRuns((prev) =>
            prev.map((run) => {
              if (run.id === data.workflow_run_id) {
                return {
                  ...run,
                  step_runs: run.step_runs?.map((step) =>
                    step.id === data.id ? { ...step, ...data } : step
                  ) || [],
                };
              }
              return run;
            })
          );
        }
      ),

      // Listen for step failed events
      subscribe(
        `tenant.${tenantId}`,
        'step.failed',
        (data: any) => {
          setRuns((prev) =>
            prev.map((run) => {
              if (run.id === data.workflow_run_id) {
                return {
                  ...run,
                  step_runs: run.step_runs?.map((step) =>
                    step.id === data.id ? { ...step, ...data } : step
                  ) || [],
                };
              }
              return run;
            })
          );
        }
      ),
    ];

    // Cleanup on unmount
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [tenantId, connectionStatus, subscribe]);

  const loadActiveRuns = async () => {
    try {
      setIsLoading(true);

      // Try to get from cache first
      const cached = cache.get<WorkflowRun[]>(CacheKeys.activeRuns());
      if (cached) {
        setRuns(cached);
        setIsLoading(false);
        return;
      }

      // Fetch from API if not cached
      const response = await runsApi.list({ status: 'running', per_page: 10 });
      const runsData = response.data || [];

      setRuns(runsData);

      // Cache for 30 seconds
      cache.set(CacheKeys.activeRuns(), runsData, 30000);
    } catch (error) {
      console.error('Failed to load active runs:', error);
      onError?.('Failed to load active runs');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      running: 'bg-blue-100 text-blue-700 border-blue-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };
    return styles[status] || styles.pending;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="w-5 h-5" />
            Active Workflow Runs
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                cache.delete(CacheKeys.activeRuns());
                loadActiveRuns();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500 animate-pulse'
                    : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-xs text-gray-500 capitalize">{connectionStatus}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Loader className="w-6 h-6 animate-spin mr-2" />
            Loading active runs...
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Play className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No active workflow runs</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <div
                key={run.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {run.workflow?.name || 'Unknown Workflow'}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusBadge(
                          run.status
                        )}`}
                      >
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      <span>Started: {new Date(run.started_at).toLocaleString()}</span>
                      {run.duration && run.duration > 0 && (
                        <span className="ml-3">Duration: {run.duration}ms</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">{getStatusIcon(run.status)}</div>
                </div>

                {/* Step Progress */}
                {run.step_runs && run.step_runs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-gray-600 mb-2">Step Progress</div>
                    {run.step_runs.slice(0, 5).map((step) => (
                      <div key={step.id} className="flex items-center gap-2 text-xs">
                        <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-700">
                            {step.node_type.charAt(0).toUpperCase() + step.node_type.slice(1)}
                          </span>
                          <span className="text-gray-500 ml-2">Node: {step.node_id}</span>
                        </div>
                        {step.duration && step.duration > 0 && (
                          <span className="text-gray-500">{step.duration}ms</span>
                        )}
                      </div>
                    ))}
                    {run.step_runs.length > 5 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{run.step_runs.length - 5} more steps
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
