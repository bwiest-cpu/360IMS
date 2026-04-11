import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { ReportControls, usePeriodDefaults } from '@/components/shared/ReportControls'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency, formatPercent } from '@/lib/format'
import { exportToCsv } from '@/lib/csv'

export default function SalesBySalespersonReport() {
  const d = usePeriodDefaults()
  const [startDate, setStartDate] = useState(d.start)
  const [endDate, setEndDate] = useState(d.end)
  const [basis, setBasis] = useState('accrual')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])

  useEffect(() => { load() }, [startDate, endDate, basis])

  async function load() {
    setLoading(true)
    const dateCol = basis === 'cash' ? 'payment_date' : 'invoice_date'
    let q = supabase
      .from('sales_orders')
      .select(`
        id, salesperson_id, subtotal,
        salesperson:users!sales_orders_salesperson_id_fkey(full_name),
        items:sales_order_items(quantity, fifo_cost)
      `)
      .gte(dateCol, startDate)
      .lte(dateCol, endDate)
      .not(dateCol, 'is', null)

    if (basis === 'cash') q = q.eq('payment_status', 'paid')
    else q = q.in('status', ['invoiced', 'fulfilled'])

    const { data } = await q
    const byPerson = new Map()
    for (const so of data ?? []) {
      const key = so.salesperson_id
      const cogs = (so.items ?? []).reduce((s, it) => s + Number(it.quantity) * Number(it.fifo_cost || 0), 0)
      const entry = byPerson.get(key) ?? {
        id: key,
        name: so.salesperson?.full_name ?? 'Unknown',
        revenue: 0, cogs: 0, orderCount: 0
      }
      entry.revenue += Number(so.subtotal)
      entry.cogs += cogs
      entry.orderCount += 1
      byPerson.set(key, entry)
    }
    const result = Array.from(byPerson.values()).map((r) => ({
      ...r,
      profit: r.revenue - r.cogs,
      margin: r.revenue > 0 ? (r.revenue - r.cogs) / r.revenue : 0
    }))
    setRows(result.sort((a, b) => b.revenue - a.revenue))
    setLoading(false)
  }

  function handleExport() {
    exportToCsv('sales-by-salesperson.csv', rows, [
      { header: 'Salesperson', accessor: 'name' },
      { header: 'Orders', accessor: 'orderCount' },
      { header: 'Revenue', accessor: 'revenue' },
      { header: 'COGS', accessor: 'cogs' },
      { header: 'Profit', accessor: 'profit' },
      { header: 'Margin', accessor: (r) => (r.margin * 100).toFixed(2) + '%' }
    ])
  }

  return (
    <div>
      <PageHeader title="Sales by Salesperson" />
      <ReportControls
        startDate={startDate} endDate={endDate}
        onChangeStart={setStartDate} onChangeEnd={setEndDate}
        basis={basis} onChangeBasis={setBasis}
        onExport={handleExport}
      />
      <Card>
        {loading ? <PageLoader /> : rows.length === 0 ? <EmptyState title="No data" /> : (
          <Table>
            <THead>
              <tr>
                <TH>Salesperson</TH>
                <TH align="right">Orders</TH>
                <TH align="right">Revenue</TH>
                <TH align="right">COGS</TH>
                <TH align="right">Profit</TH>
                <TH align="right">Margin</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.name}</TD>
                  <TD align="right">{r.orderCount}</TD>
                  <TD align="right">{formatCurrency(r.revenue)}</TD>
                  <TD align="right">{formatCurrency(r.cogs)}</TD>
                  <TD align="right" className="font-semibold">{formatCurrency(r.profit)}</TD>
                  <TD align="right">{formatPercent(r.margin)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
