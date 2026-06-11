import { useState, useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useModalStore } from '../components/ui/Modal';
import { scheduleApi, workflowApi } from '../services/api';
import type { Schedule, Workflow } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Plus, Trash2, RefreshCw, Play, CheckCircle, XCircle,
  Clock, X, Pencil,
} from 'lucide-react';

// ── Common cron presets ───────────────────────────────────────────────────────
const CRON_PRESETS = [
  { label: 'Every minute',    value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour',      value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 9am',      value: '0 9 * * *' },
  { label: 'Every Monday 9am',      value: '0 9 * * 1' },
  { label: 'Every month (1st)',     value: '0 0 1 * *' },
];

// ── Create / Edit Modal ───────────────────────────────────────────────────────
interface ScheduleFormProps {
  initial?: Schedule | null;
  workflows: Workflow[];
  onSave: () => void;
  onClose: () => void;
}

function ScheduleFormModal({ initial, workflows, onSave, onClose }: ScheduleFormProps) {
  const [name, setCronName]         = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [workflowId, setWorkflowId] = useState(initial?.workflow_id ?? '');
  const [cron, setCron]             = useState(initial?.cron_expression ?? '');
  const [timezone, setTimezone]     = useState(initial?.timezone ?? 'UTC');
  const [saving, setSaving]         = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const isEdit = !!initial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    if (!name.trim())    errs.name = 'Name is required';
    if (!workflowId)     errs.workflow_id = 'Workflow is required';
    if (!cron.trim())    errs.cron_expression = 'Cron expression is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await scheduleApi.update(initial!.id, { name, description, cron_expression: cron, timezone } as any);
      } else {
        // Get the selected workflow to obtain its current_version_id
        const selectedWorkflow = workflows.find(w => w.id === workflowId);
        const workflowVersionId = selectedWorkflow?.current_version_id;

        await scheduleApi.create({
          name,
          description,
          workflow_id: workflowId,
          workflow_version_id: workflowVersionId,
          cron_expression: cron,
          timezone
        } as any);
      }
      onSave();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      const api = e.response?.data?.errors ?? {};
      const mapped: Record<string, string> = {};
      for (const [f, msgs] of Object.entries(api)) mapped[f] = Array.isArray(msgs) ? msgs[0] : String(msgs);
      if (!Object.keys(mapped).length && e.response?.data?.message) mapped.general = e.response.data.message;
      setErrors(mapped);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Schedule' : 'Create Schedule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {errors.general && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{errors.general}</p>}

            <div className="space-y-1">
              <Label htmlFor="sc-name">Name</Label>
              <Input id="sc-name" value={name} onChange={e => setCronName(e.target.value)} placeholder="Daily Backup" disabled={saving} />
              {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
            </div>

            {!isEdit && (
              <div className="space-y-1">
                <Label htmlFor="sc-workflow">Workflow</Label>
                <select
                  id="sc-workflow"
                  value={workflowId}
                  onChange={e => setWorkflowId(e.target.value)}
                  disabled={saving}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select a workflow...</option>
                  {workflows
                    .filter(w => w.current_version_id) // Only show workflows with versions
                    .map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                {errors.workflow_id && <p className="text-xs text-red-600">{errors.workflow_id}</p>}
                {workflows.filter(w => w.current_version_id).length === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                    ⚠️ No saved workflows found. Please save a workflow first to create a schedule.
                  </p>
                )}
              </div>
            )}

            {/* Cron expression */}
            <div className="space-y-1">
              <Label htmlFor="sc-cron">Cron Expression</Label>
              <Input id="sc-cron" value={cron} onChange={e => setCron(e.target.value)}
                placeholder="0 9 * * 1" disabled={saving} className="font-mono" />
              {errors.cron_expression && <p className="text-xs text-red-600">{errors.cron_expression}</p>}

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {CRON_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setCron(p.value)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                      cron === p.value
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {cron && (
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  Pattern: <span className="text-indigo-600">{cron}</span>
                </p>
              )}
            </div>

            {/* Timezone */}
            <div className="space-y-1">
              <Label htmlFor="sc-tz">Timezone</Label>
              <select
                id="sc-tz"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                disabled={saving}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="UTC">UTC</option>
                <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sc-desc">Description <span className="text-gray-400">(optional)</span></Label>
              <Input id="sc-desc" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What does this schedule do?" disabled={saving} />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Saving...</> : isEdit ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const { can } = usePermissions();
  const { confirm, denied, success } = useModalStore();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [scRes, wfRes] = await Promise.all([
        scheduleApi.list(),
        workflowApi.list({ per_page: 100 }),
      ]);
      setSchedules(scRes.data ?? []);
      setWorkflows(wfRes.data ?? []);
    } catch (err) {
      console.error('Failed to load schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (schedule: Schedule) => {
    if (!can('edit schedules')) { denied('edit schedules'); return; }
    confirm({
      title: schedule.is_active ? 'Pause schedule' : 'Resume schedule',
      message: `"${schedule.name}" will be ${schedule.is_active ? 'paused and will no longer trigger automatically' : 'resumed and will trigger on its cron schedule'}.`,
      type: schedule.is_active ? 'warning' : 'info',
      icon: schedule.is_active ? 'warning' : 'run',
      confirmLabel: schedule.is_active ? 'Pause' : 'Resume',
      onConfirm: async () => {
        await scheduleApi.toggle(schedule.id);
        success(`Schedule "${schedule.name}" ${schedule.is_active ? 'paused' : 'resumed'}.`);
        loadAll();
      },
    });
  };

  const handleTrigger = (schedule: Schedule) => {
    if (!can('execute workflows')) { denied('execute workflows'); return; }
    confirm({
      title: 'Trigger now',
      message: `Manually run "${schedule.name}" now? This will execute the workflow immediately regardless of schedule.`,
      type: 'info',
      icon: 'run',
      confirmLabel: 'Run now',
      onConfirm: async () => {
        await scheduleApi.trigger(schedule.id);
        success(`Schedule "${schedule.name}" triggered successfully.`);
        loadAll();
      },
    });
  };

  const handleDelete = (schedule: Schedule) => {
    if (!can('delete schedules')) { denied('delete schedules'); return; }
    confirm({
      title: 'Delete schedule',
      message: `"${schedule.name}" will be permanently deleted and will no longer trigger automatically.`,
      type: 'danger',
      icon: 'delete',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await scheduleApi.delete(schedule.id);
        success(`Schedule "${schedule.name}" deleted.`);
        loadAll();
      },
    });
  };

  const openCreate = () => {
    if (!can('create schedules')) { denied('create schedules'); return; }
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (schedule: Schedule) => {
    if (!can('edit schedules')) { denied('edit schedules'); return; }
    setEditTarget(schedule);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total',   value: schedules.length,                           color: 'text-gray-800' },
          { label: 'Active',  value: schedules.filter(s => s.is_active).length,  color: 'text-green-700' },
          { label: 'Paused',  value: schedules.filter(s => !s.is_active).length, color: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label} className="shadow-none border border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-none border border-gray-200 overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-gray-100 bg-gray-50/60 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
            Schedules ({schedules.length})
          </CardTitle>
          {can('create schedules') && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />New Schedule
            </Button>
          )}
        </CardHeader>

        {isLoading ? (
          <CardContent className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading schedules...
          </CardContent>
        ) : schedules.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <Clock className="w-10 h-10 opacity-30" />
            <p className="text-sm">No schedules yet</p>
            {can('create schedules') && (
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1.5" />Create your first schedule
              </Button>
            )}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/40">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Cron</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Workflow</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Next Run</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule, i) => (
                  <tr key={schedule.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i === schedules.length - 1 ? 'border-0' : ''}`}>

                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{schedule.name}</p>
                      {schedule.description && <p className="text-xs text-gray-400">{schedule.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{schedule.timezone}</p>
                    </td>

                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 text-indigo-700 px-2 py-0.5 rounded font-mono">
                        {schedule.cron_expression}
                      </code>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-600">
                      {(schedule as any).workflow?.name ?? '—'}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-500">
                      {schedule.next_run_at
                        ? new Date(schedule.next_run_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>

                    <td className="px-4 py-3">
                      {schedule.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <XCircle className="w-3.5 h-3.5" /> Paused
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {can('execute workflows') && (
                          <Button size="icon" variant="ghost" onClick={() => handleTrigger(schedule)}
                            title="Trigger now" className="h-7 w-7 text-gray-400 hover:text-green-600 hover:bg-green-50">
                            <Play className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {can('edit schedules') && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(schedule)}
                              title="Edit" className="h-7 w-7 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleToggle(schedule)}
                              title={schedule.is_active ? 'Pause' : 'Resume'}
                              className={`h-7 w-7 transition-colors ${schedule.is_active
                                ? 'text-green-600 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-gray-300 hover:text-green-600 hover:bg-green-50'}`}>
                              {schedule.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            </Button>
                          </>
                        )}
                        {can('delete schedules') && (
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(schedule)}
                            title="Delete" className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <ScheduleFormModal
          initial={editTarget}
          workflows={workflows}
          onSave={() => { setShowForm(false); setEditTarget(null); loadAll(); }}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
