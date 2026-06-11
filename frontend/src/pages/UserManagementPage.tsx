import { useState, useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useModalStore } from '../components/ui/Modal';
import { userApi } from '../services/api';
import type { UserRecord } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Plus, Search, Pencil, Trash2, Shield, CheckCircle, XCircle, X, RefreshCw } from 'lucide-react';

// ── Role badge styles ─────────────────────────────────────────────────────────
const ROLE_STYLE: Record<string, string> = {
  admin:  'bg-purple-100 text-purple-700 border border-purple-200',
  editor: 'bg-blue-100 text-blue-700 border border-blue-200',
  viewer: 'bg-gray-100 text-gray-600 border border-gray-200',
};

// ── Modal: Manage Role Only ─────────────────────────────────────────────────
interface RoleManageProps {
  initial: UserRecord;
  onSave: () => void;
  onClose: () => void;
}

function RoleManageModal({ initial, onSave, onClose }: RoleManageProps) {
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>(initial.role);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userApi.assignRole(initial.id, role);
      onSave();
    } catch (err: unknown) {
      console.error('Failed to update role', err);
    } finally {
      setSaving(false);
    }
  };

  const roles = [
    { value: 'viewer', label: 'Viewer', desc: 'Can only view workflows and runs' },
    { value: 'editor', label: 'Editor', desc: 'Can view and edit workflows' },
    { value: 'admin',  label: 'Admin',  desc: 'Full access including user management' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Manage Role</h2>
              <p className="text-xs text-gray-500">Change user permissions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
                  {initial.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{initial.name}</p>
                  <p className="text-xs text-gray-500">{initial.email}</p>
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_STYLE[initial.role]}`}>
                  Current: {initial.role.charAt(0).toUpperCase() + initial.role.slice(1)}
                </span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3">Select New Role</Label>
              <div className="space-y-2">
                {roles.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      role === r.value
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_STYLE[r.value]}`}>
                          {r.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || role === initial.role}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : 'Update Role'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Create / Edit user ─────────────────────────────────────────────────
interface UserFormProps {
  initial?: UserRecord | null;
  onSave: (data: UserRecord) => void;
  onClose: () => void;
}

function UserFormModal({ initial, onSave, onClose }: UserFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>(initial?.role ?? 'viewer');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!initial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Basic client-side validation
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!isEdit && !password) newErrors.password = 'Password is required';
    if (password && password.length < 8) newErrors.password = 'Min 8 characters';
    if (password && password !== passwordConfirm) newErrors.password_confirmation = 'Passwords do not match';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      let result;
      if (isEdit) {
        const payload: Record<string, unknown> = { name, email, role, is_active: isActive };
        if (password) {
          payload.password = password;
          payload.password_confirmation = passwordConfirm;
        }
        result = await userApi.update(initial.id, payload as Parameters<typeof userApi.update>[1]);
      } else {
        result = await userApi.create({
          name,
          email,
          password,
          password_confirmation: passwordConfirm,
          role,
        });
      }
      onSave(result.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      const apiErrors = e.response?.data?.errors ?? {};
      const mapped: Record<string, string> = {};
      for (const [field, msgs] of Object.entries(apiErrors)) {
        mapped[field] = Array.isArray(msgs) ? msgs[0] : String(msgs);
      }
      if (Object.keys(mapped).length === 0 && e.response?.data?.message) {
        mapped.general = e.response.data.message;
      }
      setErrors(mapped);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit User' : 'Create New User'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {errors.general && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {errors.general}
              </div>
            )}

            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="um-name">Full Name</Label>
              <Input
                id="um-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                disabled={saving}
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="um-email">Email</Label>
              <Input
                id="um-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                disabled={saving}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>

            {/* Role */}
            <div className="space-y-1">
              <Label htmlFor="um-role">Role</Label>
              <select
                id="um-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                disabled={saving}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="viewer">Viewer — Read only</option>
                <option value="editor">Editor — Create &amp; execute</option>
                <option value="admin">Admin — Full access</option>
              </select>
              {errors.role && <p className="text-xs text-red-600">{errors.role}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label htmlFor="um-password">
                {isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
              </Label>
              <Input
                id="um-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Min 8 characters'}
                disabled={saving}
              />
              {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
            </div>

            {(password || !isEdit) && (
              <div className="space-y-1">
                <Label htmlFor="um-password-confirm">Confirm Password</Label>
                <Input
                  id="um-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  disabled={saving}
                />
                {errors.password_confirmation && (
                  <p className="text-xs text-red-600">{errors.password_confirmation}</p>
                )}
              </div>
            )}

            {/* Active toggle (edit only) */}
            {isEdit && (
              <div className="flex items-center justify-between">
                <Label>Account Active</Label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : isEdit ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { can } = usePermissions();
  const { confirm, denied, success } = useModalStore();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 15 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleTarget, setRoleTarget] = useState<UserRecord | null>(null);

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter]);

  const loadUsers = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await userApi.list({
        search: search || undefined,
        role: roleFilter || undefined,
        page,
        per_page: 15,
      });
      setUsers(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (user: UserRecord) => {
    if (!can('delete users')) {
      denied('delete users');
      return;
    }
    confirm({
      title: 'Delete user',
      message: `"${user.name}" (${user.email}) will be permanently removed from this tenant. This cannot be undone.`,
      type: 'danger',
      icon: 'delete',
      confirmLabel: 'Delete user',
      onConfirm: async () => {
        try {
          await userApi.delete(user.id);
          success(`User "${user.name}" has been deleted.`);
          loadUsers();
        } catch (err: unknown) {
          const e = err as { response?: { data?: { message?: string } } };
          // Show error via a warning confirm (no action needed — just info)
          useModalStore.getState().confirm({
            title: 'Could not delete user',
            message: e.response?.data?.message ?? 'An error occurred while deleting the user.',
            type: 'warning',
            icon: 'warning',
            confirmLabel: 'OK',
            cancelLabel: '',
            onConfirm: () => {},
          });
        }
      },
    });
  };

  const handleSaved = (_user: UserRecord) => {
    setShowForm(false);
    setEditTarget(null);
    success(_user ? `User "${_user.name}" has been saved.` : 'User saved successfully.');
    loadUsers();
  };

  const openCreate = () => {
    if (!can('create users')) { denied('create users'); return; }
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (user: UserRecord) => {
    if (!can('edit users')) { denied('edit users'); return; }
    setEditTarget(user);
    setShowForm(true);
  };

  const openManageRole = (user: UserRecord) => {
    if (!can('manage roles')) { denied('manage roles'); return; }
    setRoleTarget(user);
    setShowRoleModal(true);
  };

  const handleRoleSaved = () => {
    setShowRoleModal(false);
    setRoleTarget(null);
    success('User role has been updated successfully.');
    loadUsers();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-lg">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        {can('create users') && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New User
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users',   value: meta.total, color: 'text-gray-800' },
          { label: 'Admins',   value: users.filter((u) => u.role === 'admin').length,  color: 'text-purple-700' },
          { label: 'Editors',  value: users.filter((u) => u.role === 'editor').length, color: 'text-blue-700' },
          { label: 'Viewers',  value: users.filter((u) => u.role === 'viewer').length, color: 'text-gray-600' },
        ].map((s) => (
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
        <CardHeader className="py-3 px-5 border-b border-gray-100 bg-gray-50/60">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
            Users ({meta.total})
          </CardTitle>
        </CardHeader>

        {isLoading ? (
          <CardContent className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading users...
          </CardContent>
        ) : users.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <Shield className="w-10 h-10 opacity-30" />
            <p className="text-sm">No users found</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/40">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Joined</th>
                  {(can('edit users') || can('delete users') || can('manage roles')) && (
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr
                    key={user.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${
                      i === users.length - 1 ? 'border-0' : ''
                    }`}
                  >
                    {/* User info */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs flex-shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{user.name}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_STYLE[user.role]}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <XCircle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(user.created_at).toLocaleDateString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    {(can('edit users') || can('delete users') || can('manage roles')) && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {can('edit users') && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(user)}
                              title="Edit user"
                              className="h-7 w-7 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {can('manage roles') && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openManageRole(user)}
                              title="Manage role"
                              className="h-7 w-7 text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {can('delete users') && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(user)}
                              title="Delete user"
                              className="h-7 w-7 text-gray-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Page {meta.current_page} of {meta.last_page}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadUsers(meta.current_page - 1)}
                disabled={meta.current_page <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadUsers(meta.current_page + 1)}
                disabled={meta.current_page >= meta.last_page}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create / Edit modal */}
      {showForm && (
        <UserFormModal
          initial={editTarget}
          onSave={handleSaved}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {/* Manage Role modal */}
      {showRoleModal && roleTarget && (
        <RoleManageModal
          initial={roleTarget}
          onSave={handleRoleSaved}
          onClose={() => { setShowRoleModal(false); setRoleTarget(null); }}
        />
      )}
    </div>
  );
}
