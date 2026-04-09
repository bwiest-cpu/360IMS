import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Select } from '@/components/ui/Input'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatNumber } from '@/lib/format'
import { calculateInventoryValuation } from '@/lib/fifo'
import { exportToCsv } from '@/lib/csv'
import { usePermissions } from '@/hooks/usePermissions'
import { StockAdjustmentModal } from './StockAdjustmentModal'

export default function InventoryPage() {
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showLow, setShowLow] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { products } = await calculateInventoryValuation()
    const productMap = new Map(products.map((p) => [p.product_id, p]))
    const { data: all } = await supabase
      .from('products')
      .select('id, sku, name, category, unit_of_measure, current_stock_quantity, reorder_point, default_sales_price')
      .eq('is_active', true)
      .order('name')

    const merged = (all ?? []).map((p) => {
      const valRow = productMap.get(p.id)
      return {
        ...p,
        fifo_value: valRow?.total_value ?? 0,
        lot_qty: valRow?.total_quantity ?? 0
      }
    })
    setRows(merged)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      if (query) {
        const q = query.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false
      }
      if (showLow && Number(p.current_stock_quantity) > Number(p.reorder_point)) return false
      return true
    })
  }, [rows, query, showLow])

  const totalValue = filtered.reduce((s, r) => s + Number(r.fifo_value ?? 0), 0)

  function handleExport() {
    exportToCsv('inventory.csv', filtered, [
      { header: 'SKU', accessor: 'sku' },
      { header: 'Name', accessor: 'name' },
      { header: 'Category', accessor: 'category' },
      { header: 'Stock', accessor: 'current_stock_quantity' },
      { header: 'UOM', accessor: 'unit_of_measure' },
      { header: 'FIFO Value', accessor: 'fifo_value' },
      { header: 'Reorder Point', accessor: 'reorder_point' }
    ])
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`Total inventory value: ${formatCurrency(totalValue)}`}
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Link to="/reports/inventory-valuation">
              <Button variant="outline">Valuation Report</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col sm:flex-row gap-3">
          <SearchBar value={query} onChange={setQuery} placeholder="Search products..." className="flex-1" />
          <Button variant={showLow ? 'primary' : 'outline'} onClick={() => setShowLow((v) => !v)}>
            Low Stock Only
          </Button>
        </CardBody>
      </Card>

      <Card>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState title="No products" />
        ) : (
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
                <TH></TH>
              </tr>
            </THead>
            <TBody>
              {filtered.map((p) => {
                const low = Number(p.current_stock_quantity) <= Number(p.reorder_point)
                return (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs">{p.sku}</TD>
                    <TD className="font-medium">
                      <Link to={`/products/${p.id}`} className="hover:text-brand-700">{p.name}</Link>
                    </TD>
                    <TD>{p.category ?? '—'}</TD>
                    <TD align="right">
                      <span className={low ? 'text-rose-600 font-semibold' : ''}>
                        {formatNumber(p.current_stock_quantity)}
                      </span>{' '}
                      <span className="text-xs text-steel-400">{p.unit_of_measure}</span>
                    </TD>
                    <TD align="right">{formatNumber(p.reorder_point)}</TD>
                    <TD align="right">{formatCurrency(p.fifo_value)}</TD>
                    <TD>
                      {low ? (
                        <Badge className="bg-rose-100 text-rose-800">Low</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800">OK</Badge>
                      )}
                    </TD>
                    <TD>
                      {can('inventory_manage') && (
                        <Button size="sm" variant="outline" onClick={() => setAdjustProduct(p)}>
                          Adjust
                        </Button>
                      )}
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <StockAdjustmentModal
        product={adjustProduct}
        open={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onSaved={() => { setAdjustProduct(null); load() }}
      />
    </div>
  )
}
