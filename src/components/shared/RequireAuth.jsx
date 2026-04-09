import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { PageLoader } from '@/components/ui/Spinner'

export function RequireAuth({ children }) {
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  const location = useLocation()

  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  // Force change password on first login
  if (profile?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return children
}

export function RequireRole({ roles, children }) {
  const profile = useAuthStore((s) => s.profile)
  if (!profile) return <Navigate to="/login" replace />
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}
