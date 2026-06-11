import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { runsApi } from '../services/api';
import type { WorkflowRun } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { PageLayout } from '../components/layout/PageLayout';
import {
  ChevronLeft,
  Filter,
  CheckCircle,
  XCircle,
  Loader,
  Clock,
  ArrowRight,
  Calendar,
} from 'lucide-react';

const STATUS_FILTERS = [
  { value: '', label: 'All Runs' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const STATUS_BADGE: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const STATUS_ICON: Record<string, any> = {
  running: Loader,
  completed: CheckCircle,
  failed: XCircle,
  pending: Clock,
};

export default function WorkflowRunsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, per_page: 20, total: 0 });

  useEffect(() => {
    loadRuns();
  }, [statusFilter, workflowFilter, dateFrom, dateTo, pagination.current_page]);

  const loadRuns = async () => {
    try {
      setIsLoading(true);
      const response = await runsApi.list({
        status: statusFilter,
        workflow_id: workflowFilter,
        date_from: dateFrom,
        date_to: dateTo,
        page: pagination.current_page,
        per_page: pagination.per_page,
      });

      setRuns(response.data || []);
      setPagination({
        current_page: response.current_page || 1,
        per_page: response.per_page || 20,
        total: response.total || 0,
      });
    } catch (error) {
      console.error('Failed to load workflow runs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunClick = (runId: string) => {
    navigate(`/runs/${runId}`);
  };

  const getStatusIcon = (status: string) => {
    const Icon = STATUS_ICON[status] || Clock;
    const props = status === 'running' ? { className: 'w-4 h-4 animate-spin' } : { className: 'w-4 h-4' };
    return <Icon {...props} />;
  };

  const calculateDuration = (run: WorkflowRun) => {
    if (run.duration) return `${run.duration}ms`;
    if (run.started_at) {
      const start = new Date(run.started_at);
      const end = run.finished_at ? new Date(run.finished_at) : new Date();
      return `${Math.round(end.getTime() - start.getTime())}ms`;
    }
    return '-';
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-gray-100">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="font-medium">Back to Dashboard</span>
        </button>
      </div>
    </div>
  );

  const headerContent = (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Workflow Runs</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          View and analyze workflow execution history
        </p>
      </div>
    </div>
  );

  const mainContent = (
    <div className="space-y-6 p-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, current_page: 1 }));
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              >
                {STATUS_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="workflow">Workflow</Label>
              <Input
                id="workflow"
                type="text"
                value={workflowFilter}
                onChange={(e) => setWorkflowFilter(e.target.value)}
                placeholder="Workflow ID or name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Total: {pagination.total} runs
            </p>
            <Button onClick={() => {
              setStatusFilter('');
              setWorkflowFilter('');
              setDateFrom('');
              setDateTo('');
              setPagination((prev) => ({ ...prev, current_page: 1 }));
            }} variant="outline" size="sm">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Runs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execution History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <Loader className="w-6 h-6 animate-spin mr-2" />
              Loading workflow runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No workflow runs found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => handleRunClick(run.id)}
                    className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900 truncate">
                            {run.workflow?.name || 'Unknown Workflow'}
                          </h3>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[run.status] || STATUS_BADGE.pending
                            }`}
                          >
                            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
                          <div>
                            <span className="font-medium">Run ID:</span>
                            <span className="ml-1 font-mono">{run.id.slice(0, 8)}</span>
                          </div>
                          <div>
                            <span className="font-medium">Trigger:</span>
                            <span className="ml-1 capitalize">{run.trigger_type}</span>
                          </div>
                          <div>
                            <span className="font-medium">Started:</span>
                            <span className="ml-1">{new Date(run.started_at).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="font-medium">Duration:</span>
                            <span className="ml-1">{calculateDuration(run)}</span>
                          </div>
                        </div>

                        {run.error_message && (
                          <div className="mt-2 text-xs text-red-600 truncate">
                            Error: {run.error_message}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <div className="p-2 bg-gray-50 rounded">
                          {getStatusIcon(run.status)}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    {/* Step summary */}
                    {run.step_runs && run.step_runs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-gray-600">
                            {run.step_runs.filter((s) => s.status === 'completed').length} / {run.step_runs.length}{' '}
                            steps completed
                          </span>
                          {run.step_runs.some((s) => s.status === 'failed') && (
                            <span className="text-red-600">
                              {run.step_runs.filter((s) => s.status === 'failed').length} failed
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.total > pagination.per_page && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {(pagination.current_page - 1) * pagination.per_page + 1} to{' '}
                    {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{' '}
                    {pagination.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPagination((prev) => ({ ...prev, current_page: prev.current_page - 1 }))}
                      disabled={pagination.current_page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPagination((prev) => ({ ...prev, current_page: prev.current_page + 1 }))}
                      disabled={pagination.current_page * pagination.per_page >= pagination.total}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return <PageLayout sidebar={sidebarContent} header={headerContent} main={mainContent} />;
}
