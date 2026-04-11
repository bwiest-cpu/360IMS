import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Edit2, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/lib/format'
import { usePermissions } from '@/hooks/usePermissions'

export default function SupplierDetailPage() {
  const { id } = useParams()
  const { can } = usePermissions()
  const [supplier, setSupplier] = useState(null)
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [sRes, poRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('id', id).single(),
        supabase.from('purchase_orders').select('*').eq('supplier_id', id).order('order_date', { ascending: false })
      ])
      setSupplier(sRes.data)
      setPos(poRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <PageLoader />
  if (!supplier) return <div>Supplier not found.</div>

  const totalSpend = pos
    .filter((p) => ['received', 'partially_received', 'sent'].includes(p.status))
    .reduce((s, p) => s + Number(p.total), 0)

  return (
    <div>
      <PageHeader
        title={supplier.company_name}
        description={supplier.contact_name}
        actions={
          <>
            <Link to="/suppliers"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
            {can('suppliers_edit') && (
              <Link to={`/suppliers/${id}/edit`}><Button><Edit2 className="h-4 w-4" /> Edit</Button></Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Total Spend</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(totalSpend)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Total POs</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{pos.length}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Open POs</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">
            {pos.filter((p) => ['draft', 'sent', 'partially_received'].includes(p.status)).length}
          </div>
        </CardBody></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div><span className="text-steel-500">Email:</span> {supplier.email || '—'}</div>
            <div><span className="text-steel-500">Phone:</span> {supplier.phone || '—'}</div>
            <div><span className="text-steel-500">Address:</span> {supplier.address || '—'}</div>
            <div><span className="text-steel-500">City/State:</span> {[supplier.city, supplier.state, supplier.zip].filter(Boolean).join(', ') || '—'}</div>
            {supplier.notes && <div className="pt-2 border-t border-steel-100 text-steel-600">{supplier.notes}</div>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Purchase Orders</CardTitle></CardHeader>
        <CardBody className="p-0">
          {pos.length === 0 ? <EmptyState title="No POs" /> : (
            <Table>
              <THead>
                <tr>
                  <TH>PO #</TH><TH>Date</TH><TH>Status</TH><TH align="right">Total</TH>
                </tr>
              </THead>
              <TBody>
                {pos.map((p) => (
                  <TR key={p.id}>
                    <TD><Link to={`/purchase-orders/${p.id}`} className="font-mono text-xs text-brand-700 hover:underline">{p.po_number}</Link></TD>
                    <TD>{formatDate(p.order_date)}</TD>
                    <TD><StatusBadge status={p.status} /></TD>
                    <TD align="right">{formatCurrency(p.total)}</TD>
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
