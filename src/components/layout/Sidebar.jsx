import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, Warehouse, Users, Truck,
  FileText, ShoppingCart, FilePlus, BarChart3, Settings, X
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { usePermissions } from '@/hooks/usePermissions'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/quotes', label: 'Quotes', icon: FileText },
  { to: '/sales-orders', label: 'Sales Orders', icon: ShoppingCart },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: FilePlus },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/reports', label: 'Reports', icon: BarChart3 }
]

export function Sidebar({ open, onClose }) {
  const { isAdmin } = usePermissions()

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed md:sticky top-0 left-0 z-40 h-screen bg-brand-800 text-white flex flex-col transition-transform md:translate-x-0 w-64 flex-shrink-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-brand-700">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-brand-600 flex items-center justify-center font-bold text-sm">
              360
            </div>
            <div>
              <div className="font-bold text-base leading-none">360IMS</div>
              <div className="text-xs text-brand-200 mt-0.5">Metal Roofing Supply</div>
            </div>
          </div>
          <button className="md:hidden p-1" onClick={onClose} aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-1',
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-100 hover:bg-brand-700/60 hover:text-white'
                )
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/settings"
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-1',
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-100 hover:bg-brand-700/60 hover:text-white'
                )
              }
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span>Settings</span>
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-brand-700 text-[11px] text-brand-300">
          v1.0 — 360 Metal Roofing Supply
        </div>
      </aside>
    </>
  )
}
