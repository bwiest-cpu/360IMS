import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { ReportControls, usePeriodDefaults } from '@/components/shared/ReportControls'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import { exportToCsv } from '@/lib/csv'

export default function SalesByCustomerReport() {
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
      .select(`id, customer_id, total, customer:customers(company_name, contact_name)`)
      .gte(dateCol, startDate).lte(dateCol, endDate).not(dateCol, 'is', null)

    if (basis === 'cash') q = q.eq('payment_status', 'paid')
    else q = q.in('status', ['invoiced', 'fulfilled'])

    const { data } = await q
    const byCust = new Map()
    for (const so of data ?? []) {
      const key = so.customer_id
      const entry = byCust.get(key) ?? {
        id: key,
        name: so.customer?.company_name || so.customer?.contact_name || 'Unknown',
        revenue: 0, orderCount: 0
      }
      entry.revenue += Number(so.total)
      entry.orderCount += 1
      byCust.set(key, entry)
    }
    const result = Array.from(byCust.values()).map((r) => ({
      ...r, avgOrder: r.orderCount > 0 ? r.revenue / r.orderCount : 0
    }))
    setRows(result.sort((a, b) => b.revenue - a.revenue))
    setLoading(false)
  }

  function handleExport() {
    exportToCsv('sales-by-customer.csv', rows, [
      { header: 'Customer', accessor: 'name' },
      { header: 'Orders', accessor: 'orderCount' },
      { header: 'Revenue', accessor: 'revenue' },
      { header: 'Avg Order', accessor: 'avgOrder' }
    ])
  }

  return (
    <div>
      <PageHeader title="Sales by Customer" />
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
                <TH>Customer</TH>
                <TH align="right">Orders</TH>
                <TH align="right">Revenue</TH>
                <TH align="right">Avg Order</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.name}</TD>
                  <TD align="right">{r.orderCount}</TD>
                  <TD align="right">{formatCurrency(r.revenue)}</TD>
                  <TD align="right">{formatCurrency(r.avgOrder)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
