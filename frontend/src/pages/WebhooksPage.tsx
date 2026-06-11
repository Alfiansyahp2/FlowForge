import { useState, useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useModalStore } from '../components/ui/Modal';
import { webhookApi, workflowApi } from '../services/api';
import type { Webhook, Workflow } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Plus, Trash2, RefreshCw, Copy, CheckCircle, XCircle,
  ExternalLink, RotateCcw, X, Webhook as WebhookIcon,
} from 'lucide-react';

// ── Create / Edit Modal ───────────────────────────────────────────────────────
interface WebhookFormProps {
  initial?: Webhook | null;
  workflows: Workflow[];
  onSave: () => void;
  onClose: () => void;
}

function WebhookFormModal({ initial, workflows, onSave, onClose }: WebhookFormProps) {
  const [name, setName]             = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [workflowId, setWorkflowId] = useState(initial?.workflow_id ?? '');
  const [saving, setSaving]         = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const isEdit = !!initial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    if (!name.trim())       errs.name = 'Name is required';
    if (!workflowId)        errs.workflow_id = 'Workflow is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await webhookApi.update(initial!.id, { name, description });
      } else {
        await webhookApi.create({ name, description, workflow_id: workflowId } as any);
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Webhook' : 'Create Webhook'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {errors.general && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{errors.general}</p>}

            <div className="space-y-1">
              <Label htmlFor="wh-name">Name</Label>
              <Input id="wh-name" value={name} onChange={e => setName(e.target.value)} placeholder="My Webhook" disabled={saving} />
              {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
            </div>

            {!isEdit && (
              <div className="space-y-1">
                <Label htmlFor="wh-workflow">Workflow</Label>
                <select
                  id="wh-workflow"
                  value={workflowId}
                  onChange={e => setWorkflowId(e.target.value)}
                  disabled={saving}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select a workflow...</option>
                  {workflows
                    .filter(w => w.status === 'active') // Only show active workflows
                    .map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                {errors.workflow_id && <p className="text-xs text-red-600">{errors.workflow_id}</p>}
                {workflows.filter(w => w.status === 'active').length === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                    ⚠️ No active workflows found. Please activate a workflow first.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="wh-desc">Description <span className="text-gray-400">(optional)</span></Label>
              <Input id="wh-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="What triggers this webhook?" disabled={saving} />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Saving...</> : isEdit ? 'Save Changes' : 'Create Webhook'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WebhooksPage() {
  const { can } = usePermissions();
  const { confirm, denied, success } = useModalStore();

  const [webhooks, setWebhooks]   = useState<Webhook[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Webhook | null>(null);
  const [copied, setCopied]       = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [whRes, wfRes] = await Promise.all([
        webhookApi.list(),
        workflowApi.list({ per_page: 100 }),
      ]);
      setWebhooks(whRes.data ?? []);
      setWorkflows(wfRes.data ?? []);
    } catch (err) {
      console.error('Failed to load webhooks', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleToggle = (webhook: Webhook) => {
    if (!can('edit webhooks')) { denied('edit webhooks'); return; }
    confirm({
      title: webhook.is_active ? 'Deactivate webhook' : 'Activate webhook',
      message: `"${webhook.name}" will be ${webhook.is_active ? 'deactivated and stop receiving triggers' : 'activated and ready to receive triggers'}.`,
      type: webhook.is_active ? 'warning' : 'info',
      icon: webhook.is_active ? 'warning' : 'info',
      confirmLabel: webhook.is_active ? 'Deactivate' : 'Activate',
      onConfirm: async () => {
        await webhookApi.update(webhook.id, { is_active: !webhook.is_active });
        success(`Webhook "${webhook.name}" ${webhook.is_active ? 'deactivated' : 'activated'}.`);
        loadAll();
      },
    });
  };

  const handleRegenerate = (webhook: Webhook) => {
    if (!can('edit webhooks')) { denied('edit webhooks'); return; }
    confirm({
      title: 'Regenerate token',
      message: `The current URL for "${webhook.name}" will stop working immediately. Any integrations using the old URL must be updated.`,
      type: 'danger',
      icon: 'warning',
      confirmLabel: 'Regenerate',
      onConfirm: async () => {
        await webhookApi.regenerateToken(webhook.id);
        success(`Token for "${webhook.name}" regenerated. Update your integrations.`);
        loadAll();
      },
    });
  };

  const handleDelete = (webhook: Webhook) => {
    if (!can('delete webhooks')) { denied('delete webhooks'); return; }
    confirm({
      title: 'Delete webhook',
      message: `"${webhook.name}" will be permanently deleted. Any systems using this URL will stop receiving responses.`,
      type: 'danger',
      icon: 'delete',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await webhookApi.delete(webhook.id);
        success(`Webhook "${webhook.name}" deleted.`);
        loadAll();
      },
    });
  };

  const openCreate = () => {
    if (!can('create webhooks')) { denied('create webhooks'); return; }
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (webhook: Webhook) => {
    if (!can('edit webhooks')) { denied('edit webhooks'); return; }
    setEditTarget(webhook);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total',    value: webhooks.length,                                   color: 'text-gray-800' },
          { label: 'Active',   value: webhooks.filter(w => w.is_active).length,          color: 'text-green-700' },
          { label: 'Inactive', value: webhooks.filter(w => !w.is_active).length,         color: 'text-gray-400' },
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
            Webhooks ({webhooks.length})
          </CardTitle>
          {can('create webhooks') && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />New Webhook
            </Button>
          )}
        </CardHeader>

        {isLoading ? (
          <CardContent className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading webhooks...
          </CardContent>
        ) : webhooks.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <WebhookIcon className="w-10 h-10 opacity-30" />
            <p className="text-sm">No webhooks yet</p>
            {can('create webhooks') && (
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1.5" />Create your first webhook
              </Button>
            )}
          </CardContent>
        ) : (
          <div className="divide-y divide-gray-50">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="px-5 py-4 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-800 text-sm">{webhook.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        webhook.is_active
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {webhook.description && (
                      <p className="text-xs text-gray-400 mb-2">{webhook.description}</p>
                    )}

                    {/* Webhook URL */}
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 max-w-xl">
                      <code className="text-xs text-gray-600 flex-1 truncate font-mono">
                        {webhook.url ?? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/webhooks/${webhook.token}`}
                      </code>
                      <button
                        onClick={() => handleCopyUrl(
                          webhook.url ?? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/webhooks/${webhook.token}`,
                          webhook.id
                        )}
                        className="text-gray-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                        title="Copy URL"
                      >
                        {copied === webhook.id
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {(webhook as any).workflow?.name && (
                        <span>Workflow: <span className="text-gray-600 font-medium">{(webhook as any).workflow.name}</span></span>
                      )}
                      {webhook.last_triggered_at && (
                        <span>Last triggered: {new Date(webhook.last_triggered_at).toLocaleDateString('id-ID')}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {can('edit webhooks') && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(webhook)}
                          title="Edit" className="h-8 w-8 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleToggle(webhook)}
                          title={webhook.is_active ? 'Deactivate' : 'Activate'}
                          className={`h-8 w-8 transition-colors ${webhook.is_active
                            ? 'text-green-600 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-gray-300 hover:text-green-600 hover:bg-green-50'}`}>
                          {webhook.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleRegenerate(webhook)}
                          title="Regenerate token" className="h-8 w-8 text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {can('delete webhooks') && (
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(webhook)}
                        title="Delete" className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <WebhookFormModal
          initial={editTarget}
          workflows={workflows}
          onSave={() => { setShowForm(false); setEditTarget(null); loadAll(); }}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
