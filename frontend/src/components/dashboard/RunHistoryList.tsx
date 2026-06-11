import { useState, useEffect } from 'react';
import { runsApi } from '../../services/api';
import type { WorkflowRun } from '../../types';
import {
  CheckCircle, XCircle, Loader, Clock, AlertCircle,
  ChevronRight, Filter, RefreshCw, ArrowRight,
} from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  timeout: 'bg-orange-100 text-orange-700 border-orange-200',
};

const STATUS_ICON: Record<string, any> = {
  running: Loader,
  completed: CheckCircle,
  failed: XCircle,
  pending: Clock,
  timeout: AlertCircle,
};

const STATUS_FILTERS = [
  { value: '', label: 'All Runs' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

interface Props {
  tenantId?: string;
  onError?: (error: string) => void;
}

export function RunHistoryList({ tenantId, onError }: Props) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 10;

  useEffect(() => {
    loadRuns();
  }, [statusFilter, page]);

  const loadRuns = async () => {
    try {
      setIsLoading(true);
      const response = await runsApi.list({
        status: statusFilter || undefined,
        page,
        per_page: perPage,
      });

      setRuns(response.data || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      console.error('Failed to load workflow runs:', error);
      onError?.(error.message || 'Failed to load workflow runs');
    } finally {
      setIsLoading(false);
    }
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
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex gap-1">
            {STATUS_FILTERS.map(filter => (
              <button
                key={filter.value}
                onClick={() => {
                  setStatusFilter(filter.value);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={loadRuns}
          disabled={isLoading}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Runs List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">No workflow runs yet</p>
          <p className="text-gray-400 text-xs mt-1">Execute a workflow to see its history here</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {runs.map((run) => {
              const StatusIcon = STATUS_ICON[run.status] || Clock;
              return (
                <div
                  key={run.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    <div className={`p-2 rounded-lg ${STATUS_BADGE[run.status] || 'bg-gray-100'}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {run.workflow?.name || 'Unknown Workflow'}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          STATUS_BADGE[run.status] || 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(run.started_at || run.created_at)}
                        </span>
                        <span>•</span>
                        <span>Duration: {formatDuration(run.duration)}</span>
                        {run.error_message && (
                          <>
                            <span>•</span>
                            <span className="text-red-600 truncate max-w-xs">{run.error_message}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > perPage && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Showing {((page - 1) * perPage) + 1} to {Math.min(page * perPage, total)} of {total} runs
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * perPage >= total}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
