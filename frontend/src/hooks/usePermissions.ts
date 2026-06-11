import { useAuthStore } from '../lib/store';

type Permission =
  // Workflow
  | 'view workflows'
  | 'create workflows'
  | 'edit workflows'
  | 'delete workflows'
  | 'execute workflows'
  // Versions
  | 'view workflow versions'
  | 'create workflow versions'
  | 'activate workflow versions'
  | 'rollback workflows'
  // Runs
  | 'view workflow runs'
  | 'cancel workflow runs'
  | 'view step runs'
  // Webhooks
  | 'view webhooks'
  | 'create webhooks'
  | 'edit webhooks'
  | 'delete webhooks'
  // Schedules
  | 'view schedules'
  | 'create schedules'
  | 'edit schedules'
  | 'delete schedules'
  // Users
  | 'view users'
  | 'create users'
  | 'edit users'
  | 'delete users'
  | 'manage roles';

/**
 * Role-to-permissions map — mirrors RolesAndPermissionsSeeder.php exactly.
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'view workflows', 'create workflows', 'edit workflows', 'delete workflows', 'execute workflows',
    'view workflow versions', 'create workflow versions', 'activate workflow versions', 'rollback workflows',
    'view workflow runs', 'execute workflows', 'cancel workflow runs', 'view step runs',
    'view webhooks', 'create webhooks', 'edit webhooks', 'delete webhooks',
    'view schedules', 'create schedules', 'edit schedules', 'delete schedules',
    'view users', 'create users', 'edit users', 'delete users', 'manage roles',
  ],
  editor: [
    'view workflows', 'create workflows', 'edit workflows', 'execute workflows',
    'view workflow versions', 'create workflow versions', 'activate workflow versions', 'rollback workflows',
    'view workflow runs', 'execute workflows', 'cancel workflow runs', 'view step runs',
    'view webhooks', 'create webhooks', 'edit webhooks', 'delete webhooks',
    'view schedules', 'create schedules', 'edit schedules', 'delete schedules',
  ],
  viewer: [
    'view workflows',
    'view workflow versions',
    'view workflow runs',
    'view step runs',
    'view webhooks',
    'view schedules',
  ],
};

export function usePermissions() {
  const { user } = useAuthStore();
  const role = user?.role ?? 'viewer';
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['viewer'];

  const can = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const canAny = (...perms: Permission[]): boolean => {
    return perms.some((p) => permissions.includes(p));
  };

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isViewer = role === 'viewer';

  return { can, canAny, isAdmin, isEditor, isViewer, role };
}
