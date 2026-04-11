import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/cn'

const tabs = [
  { to: '/settings/company', label: 'Company' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/email-logs', label: 'Email Logs' },
  { to: '/settings/integrations', label: 'Integrations' }
]

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Admin configuration for 360IMS." />

      <div className="mb-4 border-b border-steel-200 overflow-x-auto">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) => cn(
                'px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap',
                isActive
                  ? 'border-brand-700 text-brand-700'
                  : 'border-transparent text-steel-500 hover:text-steel-700'
              )}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
