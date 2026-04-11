// Role-based permission matrix (defaults)
// Admin can override per-user via permissions JSONB column on users table.

export const DEFAULT_PERMISSIONS = {
  admin: {
    view_all: true,
    customers_create: true, customers_edit: true, customers_delete: true,
    suppliers_create: true, suppliers_edit: true, suppliers_delete: true,
    docs_create: true, docs_edit: true, docs_edit_own_only: false, docs_delete: true,
    docs_send_email: true, docs_convert: true, so_fulfill: true, so_mark_paid: true,
    products_manage: true, inventory_manage: true,
    commission_view_own: true, commission_view_all: true, commission_mark_paid: true,
    reports_profit: true, users_manage: true, settings_manage: true
  },
  manager: {
    view_all: true,
    customers_create: true, customers_edit: true, customers_delete: false,
    suppliers_create: true, suppliers_edit: true, suppliers_delete: false,
    docs_create: true, docs_edit: true, docs_edit_own_only: false, docs_delete: false,
    docs_send_email: true, docs_convert: true, so_fulfill: true, so_mark_paid: true,
    products_manage: true, inventory_manage: true,
    commission_view_own: true, commission_view_all: true, commission_mark_paid: false,
    reports_profit: true, users_manage: false, settings_manage: false
  },
  salesperson: {
    view_all: true,
    customers_create: true, customers_edit: true, customers_delete: false,
    suppliers_create: true, suppliers_edit: true, suppliers_delete: false,
    docs_create: true, docs_edit: true, docs_edit_own_only: true, docs_delete: false,
    docs_send_email: true, docs_convert: true, so_fulfill: true, so_mark_paid: true,
    products_manage: false, inventory_manage: false,
    commission_view_own: true, commission_view_all: false, commission_mark_paid: false,
    reports_profit: false, users_manage: false, settings_manage: false
  },
  viewer: {
    view_all: true,
    customers_create: false, customers_edit: false, customers_delete: false,
    suppliers_create: false, suppliers_edit: false, suppliers_delete: false,
    docs_create: false, docs_edit: false, docs_edit_own_only: false, docs_delete: false,
    docs_send_email: false, docs_convert: false, so_fulfill: false, so_mark_paid: false,
    products_manage: false, inventory_manage: false,
    commission_view_own: false, commission_view_all: false, commission_mark_paid: false,
    reports_profit: false, users_manage: false, settings_manage: false
  }
}

export function getEffectivePermissions(user) {
  if (!user) return DEFAULT_PERMISSIONS.viewer
  const base = DEFAULT_PERMISSIONS[user.role] ?? DEFAULT_PERMISSIONS.viewer
  if (user.permissions && typeof user.permissions === 'object') {
    return { ...base, ...user.permissions }
  }
  return base
}

export function can(user, permission, ownerId = null) {
  if (!user) return false
  const perms = getEffectivePermissions(user)
  const allowed = perms[permission]
  if (!allowed) return false
  // Handle "own only" for docs_edit
  if (permission === 'docs_edit' && perms.docs_edit_own_only && ownerId) {
    return ownerId === user.id
  }
  return true
}

export const PERMISSION_LABELS = {
  customers_create: 'Create customers',
  customers_edit: 'Edit customers',
  customers_delete: 'Delete customers',
  suppliers_create: 'Create suppliers',
  suppliers_edit: 'Edit suppliers',
  suppliers_delete: 'Delete suppliers',
  docs_create: 'Create quotes/SOs/POs',
  docs_edit: 'Edit quotes/SOs/POs',
  docs_edit_own_only: 'Restrict edit to own records',
  docs_delete: 'Delete quotes/SOs/POs',
  docs_send_email: 'Send documents via email',
  docs_convert: 'Convert quote ↔ SO',
  so_fulfill: 'Mark SO as fulfilled',
  so_mark_paid: 'Mark SO as paid',
  products_manage: 'Manage products & inventory',
  inventory_manage: 'Manage inventory lots',
  commission_view_own: 'View own commission',
  commission_view_all: 'View all commissions',
  commission_mark_paid: 'Mark commission as paid',
  reports_profit: 'View profit/margin reports',
  users_manage: 'Manage users',
  settings_manage: 'Edit system settings'
}
