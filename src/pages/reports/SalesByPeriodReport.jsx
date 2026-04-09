import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { ReportControls, usePeriodDefaults } from '@/components/shared/ReportControls'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency, formatPercent } from '@/lib/format'
import { exportToCsv } from '@/lib/csv'

export default function SalesByPeriodReport() {
  const defaults = usePeriodDefaults()
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [basis, setBasis] = useState('accrual')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [totals, setTotals] = useState({ revenue: 0, cogs: 0, profit: 0 })

  useEffect(() => { load() }, [startDate, endDate, basis])

  async function load() {
    setLoading(true)
    const dateCol = basis === 'cash' ? 'payment_date' : 'invoice_date'
    const statusFilter = basis === 'cash' ? ['paid'] : ['invoiced', 'fulfilled']

    let q = supabase
      .from('sales_orders')
      .select(`
        id, so_number, order_date, invoice_date, payment_date, subtotal, total, status, payment_status,
        items:sales_order_items(quantity, unit_price, fifo_cost)
      `)
      .gte(dateCol, startDate)
      .lte(dateCol, endDate)
      .not(dateCol, 'is', null)

    if (basis === 'cash') q = q.eq('payment_status', 'paid')
    else q = q.in('status', statusFilter)

    const { data, error } = await q
    if (error) { setRows([]); setLoading(false); return }

    const enriched = (data ?? []).map((so) => {
      const cogs = (so.items ?? []).reduce((s, it) => s + Number(it.quantity) * Number(it.fifo_cost || 0), 0)
      return {
        ...so,
        revenue: Number(so.subtotal),
        cogs,
        profit: Number(so.subtotal) - cogs
      }
    })

    const revenue = enriched.reduce((s, r) => s + r.revenue, 0)
    const cogs = enriched.reduce((s, r) => s + r.cogs, 0)
    const profit = revenue - cogs

    setRows(enriched)
    setTotals({ revenue, cogs, profit })
    setLoading(false)
  }

  function handleExport() {
    exportToCsv('sales-by-period.csv', rows, [
      { header: 'SO #', accessor: 'so_number' },
      { header: 'Invoice Date', accessor: 'invoice_date' },
      { header: 'Payment Date', accessor: 'payment_date' },
      { header: 'Revenue', accessor: 'revenue' },
      { header: 'COGS', accessor: 'cogs' },
      { header: 'Profit', accessor: 'profit' }
    ])
  }

  const margin = totals.revenue > 0 ? totals.profit / totals.revenue : 0

  return (
    <div>
      <PageHeader title="Sales by Period" description={`${basis === 'cash' ? 'Cash basis' : 'Accrual basis'}`} />
      <ReportControls
        startDate={startDate}
        endDate={endDate}
        onChangeStart={setStartDate}
        onChangeEnd={setEndDate}
        basis={basis}
        onChangeBasis={setBasis}
        onExport={handleExport}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase">Revenue</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(totals.revenue)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase">COGS</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(totals.cogs)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase">Gross Profit</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totals.profit)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase">Margin</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatPercent(margin)}</div>
        </CardBody></Card>
      </div>

      <Card>
        {loading ? <PageLoader /> : rows.length === 0 ? <EmptyState title="No sales in this period" /> : (
          <Table>
            <THead>
              <tr>
                <TH>SO #</TH>
                <TH>Invoice Date</TH>
                <TH align="right">Revenue</TH>
                <TH align="right">COGS</TH>
                <TH align="right">Profit</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">{r.so_number}</TD>
                  <TD>{r.invoice_date}</TD>
                  <TD align="right">{formatCurrency(r.revenue)}</TD>
                  <TD align="right">{formatCurrency(r.cogs)}</TD>
                  <TD align="right" className="font-semibold">{formatCurrency(r.profit)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
