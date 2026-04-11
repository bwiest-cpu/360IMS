import React from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3, DollarSign, Users, Package, TrendingUp, Warehouse, FileText, Receipt
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { usePermissions } from '@/hooks/usePermissions'

const reports = [
  {
    group: 'Sales',
    items: [
      { to: '/reports/sales-by-period', icon: BarChart3, title: 'Sales by Period', desc: 'Revenue, COGS, profit, margin by date range' },
      { to: '/reports/sales-by-salesperson', icon: Users, title: 'Sales by Salesperson', desc: 'Performance by team member', requires: 'reports_profit' },
      { to: '/reports/sales-by-customer', icon: Users, title: 'Sales by Customer', desc: 'Revenue per customer' },
      { to: '/reports/sales-by-product', icon: Package, title: 'Sales by Product', desc: 'Units sold, revenue, COGS per product' }
    ]
  },
  {
    group: 'Commission',
    items: [
      { to: '/reports/commission-period', icon: DollarSign, title: 'Commission by Period', desc: 'Commissions for a month' },
      { to: '/reports/commission-detail', icon: DollarSign, title: 'Commission Detail', desc: 'Drill down per salesperson' }
    ]
  },
  {
    group: 'Inventory',
    items: [
      { to: '/reports/stock-levels', icon: Warehouse, title: 'Current Stock Levels', desc: 'Stock on hand by product' },
      { to: '/reports/inventory-valuation', icon: DollarSign, title: 'Inventory Valuation', desc: 'FIFO value by category' },
      { to: '/reports/inventory-movement', icon: TrendingUp, title: 'Inventory Movement', desc: 'Receipts and deductions' }
    ]
  },
  {
    group: 'Financial',
    items: [
      { to: '/reports/pnl', icon: TrendingUp, title: 'P&L Summary', desc: 'Revenue, COGS, profit for period', requires: 'reports_profit' },
      { to: '/reports/accounts-receivable', icon: Receipt, title: 'Accounts Receivable', desc: 'Unpaid invoices aging' },
      { to: '/reports/accrual-vs-cash', icon: FileText, title: 'Accrual vs Cash', desc: 'Compare recognition methods', requires: 'reports_profit' }
    ]
  }
]

export default function ReportsIndexPage() {
  const { can } = usePermissions()
  return (
    <div>
      <PageHeader title="Reports" description="Sales, commission, inventory, and financial reports." />
      <div className="space-y-6">
        {reports.map((group) => (
          <div key={group.group}>
            <h2 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">{group.group}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items
                .filter((i) => !i.requires || can(i.requires))
                .map((item) => (
                  <Link key={item.to} to={item.to}>
                    <Card className="hover:shadow-md transition-shadow hover:border-brand-300">
                      <CardBody className="flex items-start gap-3">
                        <div className="rounded-md p-2 bg-brand-50 text-brand-700">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-steel-900">{item.title}</div>
                          <div className="text-xs text-steel-500 mt-0.5">{item.desc}</div>
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
