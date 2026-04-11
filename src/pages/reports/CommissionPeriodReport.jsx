import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/format'
import { exportToCsv } from '@/lib/csv'
import { usePermissions } from '@/hooks/usePermissions'
import { Printer, Download, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CommissionPeriodReport() {
  const profile = useAuthStore((s) => s.profile)
  const { can } = usePermissions()
  const canViewAll = can('commission_view_all')
  const today = new Date()
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [period, setPeriod] = useState(defaultPeriod)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('commission_records')
      .select(`
        *,
        salesperson:users!commission_records_salesperson_id_fkey(full_name),
        sales_order:sales_orders(so_number, customer:customers(company_name, contact_name))
      `)
      .eq('commission_period', period)
      .order('invoice_date', { ascending: false })

    if (!canViewAll && profile?.id) {
      q = q.eq('salesperson_id', profile.id)
    }

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  async function markPaid(id) {
    const { error } = await supabase
      .from('commission_records')
      .update({ is_paid: true, paid_date: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Marked paid')
    await load()
  }

  function handleExport() {
    exportToCsv(`commissions-${period}.csv`, rows, [
      { header: 'SO #', accessor: (r) => r.sales_order?.so_number },
      { header: 'Salesperson', accessor: (r) => r.salesperson?.full_name },
      { header: 'Customer', accessor: (r) => r.sales_order?.customer?.company_name || r.sales_order?.customer?.contact_name },
      { header: 'Invoice Date', accessor: 'invoice_date' },
      { header: 'Payment Date', accessor: 'payment_date' },
      { header: 'Revenue', accessor: 'gross_revenue' },
      { header: 'COGS', accessor: 'cogs' },
      { header: 'Net Profit', accessor: 'net_profit' },
      { header: 'Rate', accessor: 'commission_rate' },
      { header: 'Commission', accessor: 'commission_amount' },
      { header: 'Paid', accessor: (r) => (r.is_paid ? 'Y' : 'N') }
    ])
  }

  // Group by salesperson
  const bySalesperson = new Map()
  for (const r of rows) {
    const key = r.salesperson_id
    if (!bySalesperson.has(key)) {
      bySalesperson.set(key, {
        name: r.salesperson?.full_name ?? 'Unknown',
        records: [],
        total: 0
      })
    }
    const entry = bySalesperson.get(key)
    entry.records.push(r)
    entry.total += Number(r.commission_amount)
  }

  return (
    <div>
      <PageHeader title="Commission by Period" description="Commissions earned per period (YYYY-MM)" />

      <Card className="mb-4">
        <CardBody className="flex items-end gap-3">
          <FormField label="Period (YYYY-MM)">
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-04" />
          </FormField>
          <div className="flex-1" />
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </CardBody>
      </Card>

      {loading ? <PageLoader /> : rows.length === 0 ? (
        <Card><EmptyState title="No commissions for this period" description="Commissions are created when a sales order is marked paid." /></Card>
      ) : (
        Array.from(bySalesperson.entries()).map(([id, entry]) => (
          <Card key={id} className="mb-4">
            <div className="px-5 py-3 border-b border-steel-200 flex justify-between items-center">
              <div className="font-semibold text-steel-900">{entry.name}</div>
              <div className="text-sm text-steel-600">
                Total: <strong className="text-emerald-700">{formatCurrency(entry.total)}</strong>
              </div>
            </div>
            <Table>
              <THead>
                <tr>
                  <TH>SO #</TH>
                  <TH>Customer</TH>
                  <TH>Invoice</TH>
                  <TH>Paid</TH>
                  <TH align="right">Revenue</TH>
                  <TH align="right">COGS</TH>
                  <TH align="right">Net Profit</TH>
                  <TH align="right">Commission</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {entry.records.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono text-xs">{r.sales_order?.so_number}</TD>
                    <TD>{r.sales_order?.customer?.company_name || r.sales_order?.customer?.contact_name}</TD>
                    <TD>{formatDate(r.invoice_date)}</TD>
                    <TD>{formatDate(r.payment_date)}</TD>
                    <TD align="right">{formatCurrency(r.gross_revenue)}</TD>
                    <TD align="right">{formatCurrency(r.cogs)}</TD>
                    <TD align="right">{formatCurrency(r.net_profit)}</TD>
                    <TD align="right" className="font-semibold">{formatCurrency(r.commission_amount)}</TD>
                    <TD>
                      {r.is_paid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Paid {r.paid_date ? formatDate(r.paid_date) : ''}
                        </span>
                      ) : can('commission_mark_paid') ? (
                        <Button size="sm" variant="outline" onClick={() => markPaid(r.id)}>Mark paid</Button>
                      ) : (
                        <span className="text-xs text-steel-500">Pending</span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  )
}
