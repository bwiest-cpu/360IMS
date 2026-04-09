import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Edit2, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency, formatNumber, formatDate } from '@/lib/format'
import { usePermissions } from '@/hooks/usePermissions'

export default function ProductDetailPage() {
  const { id } = useParams()
  const { can } = usePermissions()
  const [product, setProduct] = useState(null)
  const [lots, setLots] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [prodRes, lotsRes, salesRes] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).single(),
        supabase.from('inventory_lots').select('*, purchase_order:purchase_orders(po_number)')
          .eq('product_id', id).order('received_date', { ascending: false }),
        supabase.from('sales_order_items').select('*, sales_order:sales_orders(so_number, order_date, status)')
          .eq('product_id', id).order('created_at', { ascending: false }).limit(20)
      ])
      setProduct(prodRes.data)
      setLots(lotsRes.data ?? [])
      setSales(salesRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <PageLoader />
  if (!product) return <div>Product not found.</div>

  const totalValue = lots.reduce((s, l) => s + Number(l.quantity_remaining) * Number(l.unit_cost), 0)

  return (
    <div>
      <PageHeader
        title={product.name}
        description={`SKU: ${product.sku}`}
        actions={
          <>
            <Link to="/products">
              <Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
            {can('products_manage') && (
              <Link to={`/products/${id}/edit`}>
                <Button><Edit2 className="h-4 w-4" /> Edit</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Stock on Hand</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">
            {formatNumber(product.current_stock_quantity)}
          </div>
          <div className="text-xs text-steel-500">{product.unit_of_measure}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">FIFO Value</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(totalValue)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Sales Price</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(product.default_sales_price)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Reorder Point</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatNumber(product.reorder_point)}</div>
        </CardBody></Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Inventory Lots (FIFO)</CardTitle></CardHeader>
        <CardBody className="p-0">
          {lots.length === 0 ? (
            <EmptyState title="No inventory lots" description="Receive a PO to add inventory." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Received Date</TH>
                  <TH>PO #</TH>
                  <TH align="right">Qty Received</TH>
                  <TH align="right">Qty Remaining</TH>
                  <TH align="right">Unit Cost</TH>
                  <TH align="right">Value</TH>
                </tr>
              </THead>
              <TBody>
                {lots.map((lot) => (
                  <TR key={lot.id}>
                    <TD>{formatDate(lot.received_date)}</TD>
                    <TD className="font-mono text-xs">{lot.purchase_order?.po_number ?? '—'}</TD>
                    <TD align="right">{formatNumber(lot.quantity_received)}</TD>
                    <TD align="right">{formatNumber(lot.quantity_remaining)}</TD>
                    <TD align="right">{formatCurrency(lot.unit_cost, { decimals: 4 })}</TD>
                    <TD align="right">{formatCurrency(Number(lot.quantity_remaining) * Number(lot.unit_cost))}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
        <CardBody className="p-0">
          {sales.length === 0 ? (
            <EmptyState title="No sales yet" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>SO #</TH>
                  <TH>Date</TH>
                  <TH>Status</TH>
                  <TH align="right">Qty</TH>
                  <TH align="right">Unit Price</TH>
                  <TH align="right">Line Total</TH>
                </tr>
              </THead>
              <TBody>
                {sales.map((item) => (
                  <TR key={item.id}>
                    <TD className="font-mono text-xs">{item.sales_order?.so_number}</TD>
                    <TD>{formatDate(item.sales_order?.order_date)}</TD>
                    <TD><Badge variant={item.sales_order?.status}>{item.sales_order?.status}</Badge></TD>
                    <TD align="right">{formatNumber(item.quantity)}</TD>
                    <TD align="right">{formatCurrency(item.unit_price)}</TD>
                    <TD align="right">{formatCurrency(Number(item.quantity) * Number(item.unit_price))}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
