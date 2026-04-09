import { useMemo } from 'react'
import { useAuthStore } from '@/store/auth'
import { getEffectivePermissions, can } from '@/lib/permissions'

export function usePermissions() {
  const profile = useAuthStore((s) => s.profile)
  return useMemo(() => {
    const perms = getEffectivePermissions(profile)
    return {
      user: profile,
      perms,
      can: (permission, ownerId = null) => can(profile, permission, ownerId),
      isAdmin: profile?.role === 'admin',
      isManager: profile?.role === 'manager',
      isSalesperson: profile?.role === 'salesperson',
      isViewer: profile?.role === 'viewer'
    }
  }, [profile])
}
