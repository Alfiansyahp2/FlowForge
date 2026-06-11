import { useState, useEffect, useCallback, useRef } from 'react';
import { runsApi } from '../../services/api';
import type { WorkflowRun } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Play, AlertCircle, CheckCircle, Loader, XCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface LiveRunsMonitorProps {
  tenantId?: string;
  onError?: (error: string) => void;
}

export function LiveRunsMonitor({ tenantId, onError }: LiveRunsMonitorProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load active runs
  const loadActiveRuns = useCallback(async (showRefreshingState = false) => {
    try {
      if (showRefreshingState) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await runsApi.list({ status: 'running', per_page: 10 });
      const runsData = response.data || [];

      setRuns(runsData);
    } catch (err: any) {
      console.error('Failed to load active runs:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load active runs';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [onError]);

  // Initial load
  useEffect(() => {
    loadActiveRuns();
  }, [loadActiveRuns]);

  // Auto-refresh every 5 seconds when there are active runs
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only auto-refresh if there are active runs
    if (runs.length > 0) {
      intervalRef.current = setInterval(() => {
        loadActiveRuns(true);
      }, 5000); // Refresh every 5 seconds
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [runs.length, loadActiveRuns]);

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

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="w-5 h-5" />
            Active Workflow Runs
            {runs.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                {runs.length} Active
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadActiveRuns(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <div className="flex items-center gap-2 px-2 py-1 bg-green-50 rounded-md border border-green-200">
              <Wifi className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-700">Polling Active</span>
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
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadActiveRuns()}
            >
              Try Again
            </Button>
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Play className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No active workflow runs</p>
            <p className="text-xs mt-1 text-gray-300">Active workflows will appear here</p>
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
                      <span>Started: {formatDate(run.started_at || run.created_at)}</span>
                      {run.duration && run.duration > 0 && (
                        <span className="ml-3">Duration: {formatDuration(run.duration)}</span>
                      )}
                    </div>
                    {run.trigger_type && (
                      <div className="text-xs text-gray-400 mt-1">
                        Trigger: {run.trigger_type.charAt(0).toUpperCase() + run.trigger_type.slice(1)}
                      </div>
                    )}
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
                          <span className="text-gray-500">{formatDuration(step.duration)}</span>
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
            <div className="text-xs text-gray-400 text-center pt-2">
              Auto-refreshing every 5 seconds...
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
