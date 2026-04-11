import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FilePlus, FileText, ShoppingCart, UserPlus, AlertTriangle,
  DollarSign, TrendingUp, Package
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatRelative } from '@/lib/format'

export default function DashboardPage() {
  const profile = useAuthStore((s) => s.profile)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    todayOrderCount: 0,
    todayOrderTotal: 0,
    openQuotes: 0,
    unpaidTotal: 0,
    lowStock: [],
    activity: []
  })

  useEffect(() => {
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function loadStats() {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)

      const [
        todaySos,
        openQuotes,
        unpaidSos,
        products,
        activity
      ] = await Promise.all([
        supabase.from('sales_orders').select('id, total').eq('order_date', today),
        supabase.from('sales_quotes').select('id', { count: 'exact', head: true }).in('status', ['draft', 'sent']),
        supabase.from('sales_orders').select('total, payment_status').in('payment_status', ['unpaid', 'partial']),
        supabase.from('products').select('id, name, sku, current_stock_quantity, reorder_point').eq('is_active', true),
        profile?.id
          ? supabase.from('activity_log').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(10)
          : Promise.resolve({ data: [] })
      ])

      const lowStock = (products.data ?? [])
        .filter((p) => Number(p.current_stock_quantity) <= Number(p.reorder_point))
        .slice(0, 5)

      const unpaidTotal = (unpaidSos.data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0)

      setStats({
        todayOrderCount: todaySos.data?.length ?? 0,
        todayOrderTotal: (todaySos.data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0),
        openQuotes: openQuotes.count ?? 0,
        unpaidTotal,
        lowStock,
        activity: activity.data ?? []
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] ?? 'User'}`}
        description="Overview of today's activity at 360 Metal Roofing Supply."
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Link to="/quotes/new">
          <Button variant="primary" className="w-full">
            <FileText className="h-4 w-4" /> New Quote
          </Button>
        </Link>
        <Link to="/sales-orders/new">
          <Button variant="primary" className="w-full">
            <ShoppingCart className="h-4 w-4" /> New Order
          </Button>
        </Link>
        <Link to="/purchase-orders/new">
          <Button variant="secondary" className="w-full">
            <FilePlus className="h-4 w-4" /> New PO
          </Button>
        </Link>
        <Link to="/customers/new">
          <Button variant="secondary" className="w-full">
            <UserPlus className="h-4 w-4" /> New Customer
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<ShoppingCart className="h-5 w-5" />}
              label="Today's Sales"
              value={stats.todayOrderCount}
              sublabel={formatCurrency(stats.todayOrderTotal)}
              color="text-brand-700 bg-brand-50"
            />
            <StatCard
              icon={<FileText className="h-5 w-5" />}
              label="Open Quotes"
              value={stats.openQuotes}
              sublabel="Drafts + Sent"
              color="text-indigo-700 bg-indigo-50"
            />
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Unpaid A/R"
              value={formatCurrency(stats.unpaidTotal)}
              sublabel="Invoices outstanding"
              color="text-amber-700 bg-amber-50"
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Low Stock Alerts"
              value={stats.lowStock.length}
              sublabel="Below reorder point"
              color="text-rose-700 bg-rose-50"
            />
          </div>

          {/* Low stock and activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Low Stock</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                {stats.lowStock.length === 0 ? (
                  <div className="p-6 text-center text-sm text-steel-500">
                    All products above reorder point.
                  </div>
                ) : (
                  <ul className="divide-y divide-steel-100">
                    {stats.lowStock.map((p) => (
                      <li key={p.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-steel-900">{p.name}</div>
                          <div className="text-xs text-steel-500">SKU: {p.sku}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-rose-600">
                            {Number(p.current_stock_quantity).toFixed(2)}
                          </div>
                          <div className="text-xs text-steel-500">
                            min {Number(p.reorder_point).toFixed(2)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Recent Activity</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                {stats.activity.length === 0 ? (
                  <div className="p-6 text-center text-sm text-steel-500">
                    No recent activity.
                  </div>
                ) : (
                  <ul className="divide-y divide-steel-100">
                    {stats.activity.map((a) => (
                      <li key={a.id} className="px-5 py-3">
                        <div className="text-sm text-steel-900">
                          <span className="font-medium capitalize">{a.action}</span>{' '}
                          <span className="text-steel-500">{a.entity_type}</span>{' '}
                          {a.entity_label && <span>— {a.entity_label}</span>}
                        </div>
                        <div className="text-xs text-steel-500 mt-0.5">
                          {formatRelative(a.created_at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, sublabel, color }) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <div className={`rounded-md p-2 ${color}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-steel-500 uppercase tracking-wide font-medium">
            {label}
          </div>
          <div className="text-xl font-bold text-steel-900 mt-0.5 truncate">{value}</div>
          {sublabel && <div className="text-xs text-steel-500 mt-0.5 truncate">{sublabel}</div>}
        </div>
      </CardBody>
    </Card>
  )
}
