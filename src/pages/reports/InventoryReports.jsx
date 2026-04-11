import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Input'
import { formatCurrency, formatNumber, formatDate } from '@/lib/format'
import { exportToCsv } from '@/lib/csv'
import { calculateInventoryValuation } from '@/lib/fifo'
import { Download, Printer } from 'lucide-react'
import { usePeriodDefaults } from '@/components/shared/ReportControls'

export function StockLevelsReport() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name, category, current_stock_quantity, reorder_point, unit_of_measure')
      .eq('is_active', true)
      .order('name')

    const { products: valuation } = await calculateInventoryValuation()
    const valMap = new Map(valuation.map((v) => [v.product_id, v.total_value]))

    const enriched = (products ?? []).map((p) => ({
      ...p,
      fifo_value: valMap.get(p.id) ?? 0,
      status: Number(p.current_stock_quantity) <= Number(p.reorder_point) ? 'Low' : 'OK'
    }))
    setRows(enriched)
    setLoading(false)
  }

  function handleExport() {
    exportToCsv('stock-levels.csv', rows, [
      { header: 'SKU', accessor: 'sku' },
      { header: 'Name', accessor: 'name' },
      { header: 'Category', accessor: 'category' },
      { header: 'Stock', accessor: 'current_stock_quantity' },
      { header: 'UOM', accessor: 'unit_of_measure' },
      { header: 'Reorder Point', accessor: 'reorder_point' },
      { header: 'FIFO Value', accessor: 'fifo_value' },
      { header: 'Status', accessor: 'status' }
    ])
  }

  const totalValue = rows.reduce((s, r) => s + Number(r.fifo_value), 0)

  return (
    <div>
      <PageHeader title="Stock Levels" description={`Total value: ${formatCurrency(totalValue)}`}
        actions={
          <>
            <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          </>
        }
      />
      <Card>
        {loading ? <PageLoader /> : rows.length === 0 ? <EmptyState title="No products" /> : (
          <Table>
            <THead>
              <tr>
                <TH>SKU</TH>
                <TH>Name</TH>
                <TH>Category</TH>
                <TH align="right">Stock</TH>
                <TH align="right">Reorder Pt</TH>
                <TH align="right">FIFO Value</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">{r.sku}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD>{r.category}</TD>
                  <TD align="right">{formatNumber(r.current_stock_quantity)} {r.unit_of_measure}</TD>
                  <TD align="right">{formatNumber(r.reorder_point)}</TD>
                  <TD align="right">{formatCurrency(r.fifo_value)}</TD>
                  <TD className={r.status === 'Low' ? 'text-rose-600 font-semibold' : 'text-emerald-700'}>{r.status}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

export function InventoryValuationReport() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { products, grandTotal } = await calculateInventoryValuation()
      setRows(products)
      setTotal(grandTotal)
      setLoading(false)
    })()
  }, [])

  const byCategory = new Map()
  for (const r of rows) {
    const cat = r.category || 'Uncategorized'
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + r.total_value)
  }

  function handleExport() {
    exportToCsv('inventory-valuation.csv', rows, [
      { header: 'SKU', accessor: 'sku' },
      { header: 'Name', accessor: 'name' },
      { header: 'Category', accessor: 'category' },
      { header: 'Quantity', accessor: 'total_quantity' },
      { header: 'Value', accessor: 'total_value' }
    ])
  }

  return (
    <div>
      <PageHeader title="Inventory Valuation" description={`Total FIFO value: ${formatCurrency(total)}`}
        actions={
          <>
            <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="p-5 border-b border-steel-100 font-semibold text-steel-900">By Category</div>
        <Table>
          <THead>
            <tr><TH>Category</TH><TH align="right">Value</TH></tr>
          </THead>
          <TBody>
            {Array.from(byCategory.entries()).map(([cat, val]) => (
              <TR key={cat}>
                <TD className="font-medium">{cat}</TD>
                <TD align="right">{formatCurrency(val)}</TD>
              </TR>
            ))}
            <TR className="bg-steel-100 font-bold">
              <TD>Total</TD>
              <TD align="right">{formatCurrency(total)}</TD>
            </TR>
          </TBody>
        </Table>
      </Card>

      <Card>
        {loading ? <PageLoader /> : (
          <Table>
            <THead>
              <tr>
                <TH>SKU</TH><TH>Name</TH><TH>Category</TH>
                <TH align="right">Quantity</TH><TH align="right">FIFO Value</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.product_id}>
                  <TD className="font-mono text-xs">{r.sku}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD>{r.category}</TD>
                  <TD align="right">{formatNumber(r.total_quantity)}</TD>
                  <TD align="right">{formatCurrency(r.total_value)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

export function InventoryMovementReport() {
  const d = usePeriodDefaults()
  const [startDate, setStartDate] = useState(d.start)
  const [endDate, setEndDate] = useState(d.end)
  const [productId, setProductId] = useState('')
  const [products, setProducts] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('products').select('id, name, sku').eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  useEffect(() => { if (productId) load() }, [productId, startDate, endDate])

  async function load() {
    setLoading(true)
    const [lotsRes, adjRes, soiRes] = await Promise.all([
      supabase.from('inventory_lots').select('*, purchase_order:purchase_orders(po_number)')
        .eq('product_id', productId)
        .gte('received_date', startDate).lte('received_date', endDate),
      supabase.from('stock_adjustments').select('*').eq('product_id', productId)
        .gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),
      supabase.from('sales_order_items')
        .select('*, sales_order:sales_orders(so_number, fulfilled_date, status)')
        .eq('product_id', productId)
    ])

    const movements = []
    for (const lot of lotsRes.data ?? []) {
      movements.push({
        date: lot.received_date,
        type: 'Receipt',
        qty: Number(lot.quantity_received),
        cost: Number(lot.unit_cost),
        ref: lot.purchase_order?.po_number ?? 'Adjustment'
      })
    }
    for (const adj of adjRes.data ?? []) {
      movements.push({
        date: adj.created_at.slice(0, 10),
        type: 'Adjustment',
        qty: Number(adj.quantity_delta),
        cost: Number(adj.unit_cost ?? 0),
        ref: adj.reason
      })
    }
    for (const item of soiRes.data ?? []) {
      const so = item.sales_order
      if (so?.status === 'fulfilled' && so.fulfilled_date >= startDate && so.fulfilled_date <= endDate) {
        movements.push({
          date: so.fulfilled_date,
          type: 'Sale',
          qty: -Number(item.quantity),
          cost: Number(item.fifo_cost),
          ref: so.so_number
        })
      }
    }

    setRows(movements.sort((a, b) => a.date.localeCompare(b.date)))
    setLoading(false)
  }

  function handleExport() {
    exportToCsv('inventory-movement.csv', rows, [
      { header: 'Date', accessor: 'date' },
      { header: 'Type', accessor: 'type' },
      { header: 'Reference', accessor: 'ref' },
      { header: 'Quantity', accessor: 'qty' },
      { header: 'Unit Cost', accessor: 'cost' }
    ])
  }

  return (
    <div>
      <PageHeader title="Inventory Movement" />
      <Card className="mb-4">
        <CardBody className="flex flex-col md:flex-row gap-3 items-end">
          <FormField label="Product">
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">— Select —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </Select>
          </FormField>
          <FormField label="Start">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label="End">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
        </CardBody>
      </Card>
      <Card>
        {loading ? <PageLoader /> : rows.length === 0 ? (
          <EmptyState title="No movements" description="Select a product and date range." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH><TH>Type</TH><TH>Reference</TH>
                <TH align="right">Qty</TH><TH align="right">Unit Cost</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r, i) => (
                <TR key={i}>
                  <TD>{formatDate(r.date)}</TD>
                  <TD>{r.type}</TD>
                  <TD className="font-mono text-xs">{r.ref}</TD>
                  <TD align="right" className={r.qty < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                    {r.qty > 0 ? '+' : ''}{formatNumber(r.qty)}
                  </TD>
                  <TD align="right">{formatCurrency(r.cost, { decimals: 4 })}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
