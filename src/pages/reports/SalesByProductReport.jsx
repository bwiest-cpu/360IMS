import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { ReportControls, usePeriodDefaults } from '@/components/shared/ReportControls'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency, formatNumber } from '@/lib/format'
import { exportToCsv } from '@/lib/csv'

export default function SalesByProductReport() {
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
        id, invoice_date, payment_date, status, payment_status,
        items:sales_order_items(product_id, quantity, unit_price, fifo_cost, product:products(id, name, sku, category))
      `)
      .gte(dateCol, startDate).lte(dateCol, endDate).not(dateCol, 'is', null)

    if (basis === 'cash') q = q.eq('payment_status', 'paid')
    else q = q.in('status', ['invoiced', 'fulfilled'])

    const { data } = await q
    const byProd = new Map()
    for (const so of data ?? []) {
      for (const item of so.items ?? []) {
        if (!item.product_id) continue
        const key = item.product_id
        const entry = byProd.get(key) ?? {
          id: key,
          name: item.product?.name ?? 'Unknown',
          sku: item.product?.sku ?? '',
          category: item.product?.category ?? '',
          units: 0, revenue: 0, cogs: 0
        }
        entry.units += Number(item.quantity)
        entry.revenue += Number(item.quantity) * Number(item.unit_price)
        entry.cogs += Number(item.quantity) * Number(item.fifo_cost || 0)
        byProd.set(key, entry)
      }
    }
    const result = Array.from(byProd.values()).map((r) => ({ ...r, profit: r.revenue - r.cogs }))
    setRows(result.sort((a, b) => b.revenue - a.revenue))
    setLoading(false)
  }

  function handleExport() {
    exportToCsv('sales-by-product.csv', rows, [
      { header: 'SKU', accessor: 'sku' },
      { header: 'Name', accessor: 'name' },
      { header: 'Category', accessor: 'category' },
      { header: 'Units', accessor: 'units' },
      { header: 'Revenue', accessor: 'revenue' },
      { header: 'COGS', accessor: 'cogs' },
      { header: 'Profit', accessor: 'profit' }
    ])
  }

  return (
    <div>
      <PageHeader title="Sales by Product" />
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
                <TH>SKU</TH><TH>Product</TH><TH>Category</TH>
                <TH align="right">Units</TH><TH align="right">Revenue</TH>
                <TH align="right">COGS</TH><TH align="right">Profit</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">{r.sku}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD>{r.category}</TD>
                  <TD align="right">{formatNumber(r.units)}</TD>
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
