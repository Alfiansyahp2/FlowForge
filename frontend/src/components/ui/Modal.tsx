/**
 * Modal.tsx
 *
 * Unified modal system for FlowForge.
 *
 * Exports:
 *  - useModalStore         — Zustand store (open/close any modal type)
 *  - ConfirmModal          — Confirmation dialog (danger / warning / info / success)
 *  - PermissionDeniedModal — Shown when user lacks permission for an action
 *  - SuccessModal          — Feedback after a successful operation
 *  - GlobalModals          — Mount once in App.tsx to render all modals
 *
 * Usage:
 *   const { confirm, denied, success } = useModalStore();
 *
 *   // Confirmation
 *   confirm({
 *     title: 'Delete Workflow',
 *     message: 'This action cannot be undone.',
 *     type: 'danger',
 *     confirmLabel: 'Delete',
 *     onConfirm: () => handleDelete(id),
 *   });
 *
 *   // Permission denied
 *   denied('delete workflows');
 *
 *   // Success feedback
 *   success('Workflow deleted successfully');
 */

import { create } from 'zustand';
import { X, AlertTriangle, Trash2, LogOut, Play, Archive, CheckCircle2, ShieldAlert, Info, RefreshCw } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ModalType = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmConfig {
  title: string;
  message: string;
  type: ModalType;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Icon override key */
  icon?: 'delete' | 'logout' | 'run' | 'archive' | 'warning' | 'info';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface SuccessConfig {
  title?: string;
  message: string;
  /** Auto-close after ms (default 2500, 0 = no auto-close) */
  duration?: number;
}

interface ModalStore {
  // Confirm modal
  confirmOpen: boolean;
  confirmConfig: ConfirmConfig | null;
  confirmLoading: boolean;

  // Permission denied modal
  deniedOpen: boolean;
  deniedPermission: string | null;
  deniedDescription: string | null;

  // Success modal
  successOpen: boolean;
  successConfig: SuccessConfig | null;

  // Actions
  confirm: (config: ConfirmConfig) => void;
  closeConfirm: () => void;

  denied: (permission: string, description?: string) => void;
  closeDenied: () => void;

  success: (message: string, title?: string, duration?: number) => void;
  closeSuccess: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useModalStore = create<ModalStore>((set) => ({
  confirmOpen: false,
  confirmConfig: null,
  confirmLoading: false,

  deniedOpen: false,
  deniedPermission: null,
  deniedDescription: null,

  successOpen: false,
  successConfig: null,

  confirm: (config) => set({ confirmOpen: true, confirmConfig: config, confirmLoading: false }),
  closeConfirm: () => set({ confirmOpen: false, confirmConfig: null, confirmLoading: false }),

  denied: (permission, description) =>
    set({ deniedOpen: true, deniedPermission: permission, deniedDescription: description ?? null }),
  closeDenied: () => set({ deniedOpen: false, deniedPermission: null, deniedDescription: null }),

  success: (message, title, duration) =>
    set({ successOpen: true, successConfig: { message, title, duration } }),
  closeSuccess: () => set({ successOpen: false, successConfig: null }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Friendly label and description for each permission string */
const PERMISSION_META: Record<string, { label: string; description: string }> = {
  'view workflows':            { label: 'View Workflows',           description: 'You need at least Viewer role to see workflows.' },
  'create workflows':          { label: 'Create Workflows',         description: 'Only Editors and Admins can create new workflows.' },
  'edit workflows':            { label: 'Edit Workflows',           description: 'Only Editors and Admins can modify workflow definitions.' },
  'delete workflows':          { label: 'Delete Workflows',         description: 'Only Admins can permanently delete workflows.' },
  'execute workflows':         { label: 'Execute Workflows',        description: 'Only Editors and Admins can trigger workflow runs.' },
  'view workflow versions':    { label: 'View Versions',            description: 'You need at least Viewer role to see workflow versions.' },
  'create workflow versions':  { label: 'Create Versions',         description: 'Only Editors and Admins can create new workflow versions.' },
  'activate workflow versions':{ label: 'Activate Versions',       description: 'Only Editors and Admins can activate a workflow version.' },
  'rollback workflows':        { label: 'Rollback Workflows',       description: 'Only Editors and Admins can rollback to a previous version.' },
  'view workflow runs':        { label: 'View Workflow Runs',       description: 'You need at least Viewer role to see execution history.' },
  'cancel workflow runs':      { label: 'Cancel Workflow Runs',     description: 'Only Editors and Admins can cancel running executions.' },
  'view step runs':            { label: 'View Step Runs',           description: 'You need at least Viewer role to see step-level run details.' },
  'view webhooks':             { label: 'View Webhooks',            description: 'You need at least Viewer role to see webhooks.' },
  'create webhooks':           { label: 'Create Webhooks',         description: 'Only Editors and Admins can create webhook triggers.' },
  'edit webhooks':             { label: 'Edit Webhooks',            description: 'Only Editors and Admins can modify webhooks.' },
  'delete webhooks':           { label: 'Delete Webhooks',          description: 'Only Editors and Admins can delete webhooks.' },
  'view schedules':            { label: 'View Schedules',           description: 'You need at least Viewer role to see schedules.' },
  'create schedules':          { label: 'Create Schedules',         description: 'Only Editors and Admins can create cron schedules.' },
  'edit schedules':            { label: 'Edit Schedules',           description: 'Only Editors and Admins can modify schedules.' },
  'delete schedules':          { label: 'Delete Schedules',         description: 'Only Editors and Admins can delete schedules.' },
  'view users':                { label: 'View Users',               description: 'Only Admins can access User Management.' },
  'create users':              { label: 'Create Users',             description: 'Only Admins can add new users to this tenant.' },
  'edit users':                { label: 'Edit Users',               description: 'Only Admins can edit user profiles.' },
  'delete users':              { label: 'Delete Users',             description: 'Only Admins can remove users from this tenant.' },
  'manage roles':              { label: 'Manage Roles',             description: 'Only Admins can assign or change user roles.' },
};

const TYPE_CONFIG: Record<ModalType, { border: string; bg: string; iconBg: string; iconColor: string; btnBg: string; btnHover: string }> = {
  danger:  { border: 'border-red-200',    bg: 'bg-red-50',     iconBg: 'bg-red-100',    iconColor: 'text-red-600',    btnBg: 'bg-red-600',    btnHover: 'hover:bg-red-700' },
  warning: { border: 'border-amber-200',  bg: 'bg-amber-50',   iconBg: 'bg-amber-100',  iconColor: 'text-amber-600',  btnBg: 'bg-amber-600',  btnHover: 'hover:bg-amber-700' },
  info:    { border: 'border-blue-200',   bg: 'bg-blue-50',    iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   btnBg: 'bg-indigo-600', btnHover: 'hover:bg-indigo-700' },
  success: { border: 'border-green-200',  bg: 'bg-green-50',   iconBg: 'bg-green-100',  iconColor: 'text-green-600',  btnBg: 'bg-green-600',  btnHover: 'hover:bg-green-700' },
};

function ModalIcon({ iconKey, className }: { iconKey?: string; className?: string }) {
  const cls = className ?? 'w-6 h-6';
  switch (iconKey) {
    case 'delete':  return <Trash2 className={cls} />;
    case 'logout':  return <LogOut className={cls} />;
    case 'run':     return <Play className={cls} />;
    case 'archive': return <Archive className={cls} />;
    case 'warning': return <AlertTriangle className={cls} />;
    default:        return <Info className={cls} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmModal
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmModalComponent() {
  const { confirmOpen, confirmConfig, confirmLoading, closeConfirm } = useModalStore();

  if (!confirmOpen || !confirmConfig) return null;

  const cfg = confirmConfig;
  const tc = TYPE_CONFIG[cfg.type];

  const handleConfirm = async () => {
    useModalStore.setState({ confirmLoading: true });
    try {
      await cfg.onConfirm();
    } finally {
      closeConfirm();
    }
  };

  const handleCancel = () => {
    cfg.onCancel?.();
    closeConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top colored stripe */}
        <div className={`h-1.5 ${tc.btnBg}`} />

        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex-shrink-0 w-11 h-11 rounded-full ${tc.iconBg} flex items-center justify-center`}>
              <ModalIcon iconKey={cfg.icon} className={`w-5 h-5 ${tc.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-semibold text-gray-900">{cfg.title}</h3>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{cfg.message}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={handleCancel}
              disabled={confirmLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {cfg.cancelLabel ?? 'Cancel'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirmLoading}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2 ${tc.btnBg} ${tc.btnHover}`}
            >
              {confirmLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {cfg.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PermissionDeniedModal
// ─────────────────────────────────────────────────────────────────────────────

function PermissionDeniedModalComponent() {
  const { deniedOpen, deniedPermission, deniedDescription, closeDenied } = useModalStore();

  if (!deniedOpen) return null;

  const meta = deniedPermission ? PERMISSION_META[deniedPermission] : null;
  const label = meta?.label ?? deniedPermission ?? 'This action';
  const description = deniedDescription ?? meta?.description ?? 'You do not have permission to perform this action. Contact your administrator to request access.';

  // Role matrix for the denied permission
  const roleMatrix: Record<string, { roles: string[]; color: string }> = {
    admin:  { roles: ['admin'],                          color: 'bg-purple-100 text-purple-700 border-purple-200' },
    editor: { roles: ['admin', 'editor'],                color: 'bg-blue-100 text-blue-700 border-blue-200' },
    viewer: { roles: ['admin', 'editor', 'viewer'],      color: 'bg-gray-100 text-gray-600 border-gray-200' },
  };

  // Determine which roles have this permission based on usePermissions ROLE_PERMISSIONS
  const adminOnly = ['delete workflows', 'view users', 'create users', 'edit users', 'delete users', 'manage roles'];
  const editorUp  = ['create workflows', 'edit workflows', 'execute workflows', 'create workflow versions',
                     'activate workflow versions', 'rollback workflows', 'cancel workflow runs',
                     'create webhooks', 'edit webhooks', 'delete webhooks', 'create schedules', 'edit schedules', 'delete schedules'];

  let requiredRoles: string[] = ['admin', 'editor', 'viewer'];
  if (deniedPermission && adminOnly.includes(deniedPermission)) requiredRoles = ['admin'];
  else if (deniedPermission && editorUp.includes(deniedPermission)) requiredRoles = ['admin', 'editor'];

  const ALL_ROLES = ['admin', 'editor', 'viewer'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={closeDenied}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Red stripe */}
        <div className="h-1.5 bg-red-500" />

        <div className="p-6">
          {/* Close button */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-red-600" />
              </div>
              <div className="pt-0.5">
                <h3 className="text-base font-semibold text-gray-900">Access Denied</h3>
                <p className="text-sm text-red-600 font-medium mt-0.5">{label}</p>
              </div>
            </div>
            <button onClick={closeDenied} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed mb-5 ml-15">
            {description}
          </p>

          {/* Role access matrix */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Who can perform this action?
            </p>
            <div className="flex gap-2 flex-wrap">
              {ALL_ROLES.map((r) => {
                const hasAccess = requiredRoles.includes(r);
                const style = roleMatrix[r]?.color ?? '';
                return (
                  <span
                    key={r}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      hasAccess ? style : 'bg-gray-100 text-gray-300 border-gray-100 line-through'
                    }`}
                  >
                    {hasAccess ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </span>
                );
              })}
            </div>
          </div>

          <button
            onClick={closeDenied}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SuccessModal
// ─────────────────────────────────────────────────────────────────────────────

function SuccessModalComponent() {
  const { successOpen, successConfig, closeSuccess } = useModalStore();

  // Auto-close
  if (successOpen && successConfig) {
    const duration = successConfig.duration ?? 2500;
    if (duration > 0) {
      setTimeout(closeSuccess, duration);
    }
  }

  if (!successOpen || !successConfig) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-xl shadow-lg border border-green-100 p-4 flex items-start gap-3 max-w-sm">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          {successConfig.title && (
            <p className="text-sm font-semibold text-gray-900">{successConfig.title}</p>
          )}
          <p className="text-sm text-gray-600">{successConfig.message}</p>
        </div>
        <button onClick={closeSuccess} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GlobalModals — mount once in App.tsx
// ─────────────────────────────────────────────────────────────────────────────

export function GlobalModals() {
  return (
    <>
      <ConfirmModalComponent />
      <PermissionDeniedModalComponent />
      <SuccessModalComponent />
    </>
  );
}
