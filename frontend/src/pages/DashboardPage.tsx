import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { workflowApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { useModalStore } from '../components/ui/Modal';
import type { Workflow } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { HealthPanel, LiveRunsMonitor } from '../components/dashboard';
import {
  Play, Plus, Trash2, Power, PowerOff, Eye,
  LayoutDashboard, Webhook, Clock, Users, LogOut, ChevronRight, BarChart3,
} from 'lucide-react';
import UserManagementPage from './UserManagementPage';
import WebhooksPage from './WebhooksPage';
import SchedulesPage from './SchedulesPage';

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin:  { label: 'Admin',  className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  editor: { label: 'Editor', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  viewer: { label: 'Viewer', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

const STATUS_BADGE: Record<string, string> = {
  active:   'bg-green-100 text-green-700 border border-green-200',
  draft:    'bg-yellow-100 text-yellow-700 border border-yellow-200',
  archived: 'bg-gray-100 text-gray-500 border border-gray-200',
};

export default function DashboardPage() {
  const navigate   = useNavigate();
  const { user, logout } = useAuthStore();
  const { can, isAdmin, role } = usePermissions();
  const { confirm, denied, success } = useModalStore();

  const [workflows, setWorkflows]     = useState<Workflow[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [activeSection, setActiveSection] =
    useState<'overview' | 'workflows' | 'runs' | 'webhooks' | 'schedules' | 'users'>('overview');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => { loadWorkflows(); }, []);

  const loadWorkflows = async () => {
    try {
      const response = await workflowApi.list();
      setWorkflows(response.data || []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    confirm({
      title: 'Sign out',
      message: 'Are you sure you want to log out? You will need to sign in again to access your workflows.',
      type: 'warning',
      icon: 'logout',
      confirmLabel: 'Sign out',
      onConfirm: async () => {
        await logout();
        navigate('/login');
      },
    });
  };

  // ── Delete workflow ───────────────────────────────────────────────────────
  const handleDelete = (workflow: Workflow) => {
    if (!can('delete workflows')) {
      denied('delete workflows');
      return;
    }
    confirm({
      title: 'Delete workflow',
      message: `"${workflow.name}" will be permanently deleted. This cannot be undone.`,
      type: 'danger',
      icon: 'delete',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await workflowApi.delete(workflow.id);
        success(`"${workflow.name}" has been deleted.`);
        loadWorkflows();
      },
    });
  };

  // ── Archive / Activate ────────────────────────────────────────────────────
  const handleToggleStatus = (workflow: Workflow) => {
    if (!can('edit workflows')) {
      denied('edit workflows');
      return;
    }
    const isActive = workflow.status === 'active';
    confirm({
      title: isActive ? 'Archive workflow' : 'Activate workflow',
      message: isActive
        ? `"${workflow.name}" will be archived and cannot be triggered until reactivated.`
        : `"${workflow.name}" will be set to active and can be triggered.`,
      type: isActive ? 'warning' : 'info',
      icon: isActive ? 'archive' : 'info',
      confirmLabel: isActive ? 'Archive' : 'Activate',
      onConfirm: async () => {
        if (isActive) {
          await workflowApi.archive(workflow.id);
          success(`"${workflow.name}" has been archived.`);
        } else {
          await workflowApi.activate(workflow.id);
          success(`"${workflow.name}" is now active.`);
        }
        loadWorkflows();
      },
    });
  };

  // ── Run workflow ──────────────────────────────────────────────────────────
  const handleRun = (workflow: Workflow) => {
    if (!can('execute workflows')) {
      denied('execute workflows');
      return;
    }
    confirm({
      title: 'Run workflow',
      message: `Start an execution of "${workflow.name}" now? A new workflow run will be created.`,
      type: 'info',
      icon: 'run',
      confirmLabel: 'Run now',
      onConfirm: async () => {
        await workflowApi.run(workflow.id);
        success(`Workflow "${workflow.name}" started successfully.`);
        loadWorkflows();
      },
    });
  };

  // ── New workflow ──────────────────────────────────────────────────────────
  const handleNewWorkflow = () => {
    if (!can('create workflows')) {
      denied('create workflows');
      return;
    }
    navigate('/workflows/new');
  };

  const roleBadge = ROLE_BADGE[role] ?? ROLE_BADGE['viewer'];

  const navItems = [
    { key: 'overview',   label: 'Overview',         icon: BarChart3,        show: true },
    { key: 'workflows',  label: 'Workflows',        icon: LayoutDashboard, show: can('view workflows') },
    { key: 'runs',       label: 'Run History',      icon: Clock,           show: can('view workflows') },
    { key: 'webhooks',   label: 'Webhooks',         icon: Webhook,         show: can('view webhooks')  },
    { key: 'schedules',  label: 'Schedules',        icon: Clock,           show: can('view schedules') },
    { key: 'users',      label: 'User Management',  icon: Users,           show: isAdmin },
  ].filter((item) => item.show);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo/Brand - Atas */}
      <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">FlowForge</span>
        </div>
      </div>

      {/* Navigation Menu - Tengah (scrollable) */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key as typeof activeSection)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
          );
        })}
      </nav>

      {/* User Profile Section - Paling Bawah */}
      <div className="border-t border-gray-100 flex-shrink-0 relative">
        {/* User Profile Button */}
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <div className="flex-shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${roleBadge.className}`}>
              {roleBadge.label}
            </span>
          </div>
        </button>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
            {/* User Info Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
                  {user?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                  setShowUserMenu(false);
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close */}
        {showUserMenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowUserMenu(false)}
          />
        )}
      </div>
    </div>
  );

  const headerContent = (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {activeSection === 'overview' && 'Dashboard Overview'}
          {activeSection === 'workflows' && 'Workflows'}
          {activeSection === 'runs' && 'Run History'}
          {activeSection === 'users' && 'User Management'}
          {!['overview', 'workflows', 'runs', 'users'].includes(activeSection) && activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {activeSection === 'overview' && 'Real-time monitoring and health metrics'}
          {activeSection === 'workflows' && 'Manage and monitor your workflows'}
          {activeSection === 'runs' && 'View workflow execution history'}
          {activeSection === 'webhooks'  && 'Manage webhook triggers'}
          {activeSection === 'schedules' && 'Manage cron schedules'}
          {activeSection === 'users'     && 'Manage users and roles'}
        </p>
      </div>
      {activeSection === 'workflows' && (
        <Button onClick={handleNewWorkflow}>
          <Plus className="w-4 h-4 mr-2" />
          New Workflow
        </Button>
      )}
    </div>
  );

  const mainContent = (
    <div className="flex-1 p-6">
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Health Metrics Panel */}
          <HealthPanel />

          {/* Live Runs Monitor */}
          {user?.tenant_id && (
            <LiveRunsMonitor
              tenantId={user.tenant_id}
              onError={(error) => console.error('WebSocket error:', error)}
            />
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {can('create workflows') && (
                  <Button
                    className="w-full"
                    onClick={handleNewWorkflow}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Workflow
                  </Button>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setActiveSection('runs')}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  View Run History
                </Button>
                {can('view webhooks') && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setActiveSection('webhooks')}
                  >
                    <Webhook className="w-4 h-4 mr-2" />
                    Manage Webhooks
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'runs' && (
        <div className="space-y-6">
          {/* Runs page will be rendered as a separate route */}
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600 mb-2">View detailed run history</p>
                <Button onClick={() => navigate('/runs')}>
                  Go to Runs Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'workflows' && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading workflows...
            </div>
          ) : workflows.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200 shadow-none">
              <CardHeader className="text-center py-16">
                <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <LayoutDashboard className="w-6 h-6 text-gray-400" />
                </div>
                <CardTitle className="text-gray-500">No workflows yet</CardTitle>
                <CardDescription>
                  {can('create workflows')
                    ? 'Create your first workflow to get started'
                    : 'No workflows available to view yet'}
                </CardDescription>
                {can('create workflows') && (
                  <div className="mt-4">
                    <Button onClick={handleNewWorkflow}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Workflow
                    </Button>
                  </div>
                )}
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workflows.map((workflow) => (
                <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{workflow.name}</CardTitle>
                        <CardDescription className="mt-1 text-xs line-clamp-2">
                          {workflow.description || 'No description'}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => handleRun(workflow)}
                          title="Run workflow"
                          className={`h-8 w-8 transition-colors ${
                            can('execute workflows')
                              ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => handleToggleStatus(workflow)}
                          title={workflow.status === 'active' ? 'Archive' : 'Activate'}
                          className={`h-8 w-8 transition-colors ${
                            can('edit workflows')
                              ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {workflow.status === 'active'
                            ? <PowerOff className="w-4 h-4" />
                            : <Power className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => handleDelete(workflow)}
                          title="Delete"
                          className={`h-8 w-8 transition-colors ${
                            can('delete workflows')
                              ? 'text-red-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className={`px-2 py-0.5 rounded-full font-medium border ${STATUS_BADGE[workflow.status] ?? STATUS_BADGE['draft']}`}>
                        {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                      </span>
                      <span className="text-gray-400">
                        {workflow.definition?.nodes?.length ?? 0} nodes
                      </span>
                    </div>

                    {can('edit workflows') ? (
                      <Button className="w-full" variant="outline" size="sm"
                        onClick={() => navigate(`/workflows/${workflow.id}`)}>
                        Edit Workflow
                      </Button>
                    ) : (
                      <Button className="w-full" variant="ghost" size="sm"
                        onClick={() => navigate(`/workflows/${workflow.id}`)}>
                        <Eye className="w-3 h-3 mr-1.5" />
                        View Workflow
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Webhooks ── */}
      {activeSection === 'webhooks' && <WebhooksPage />}

      {/* ── Schedules ── */}
      {activeSection === 'schedules' && <SchedulesPage />}

      {/* ── User Management (Admin only) ── */}
      {activeSection === 'users' && isAdmin && <UserManagementPage />}
    </div>
  );

  return (
    <PageLayout sidebar={sidebarContent} header={headerContent} main={mainContent} />
  );
}
