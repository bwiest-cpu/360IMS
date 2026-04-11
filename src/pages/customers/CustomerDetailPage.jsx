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

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { can } = usePermissions()
  const [customer, setCustomer] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [custRes, qRes, oRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('sales_quotes').select('*').eq('customer_id', id).order('quote_date', { ascending: false }),
        supabase.from('sales_orders').select('*').eq('customer_id', id).order('order_date', { ascending: false })
      ])
      setCustomer(custRes.data)
      setQuotes(qRes.data ?? [])
      setOrders(oRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <PageLoader />
  if (!customer) return <div>Customer not found.</div>

  const totalRevenue = orders
    .filter((o) => ['invoiced', 'fulfilled'].includes(o.status))
    .reduce((s, o) => s + Number(o.total), 0)
  const totalUnits = 0 // filled in below on join

  return (
    <div>
      <PageHeader
        title={customer.company_name || customer.contact_name}
        description={customer.company_name ? customer.contact_name : undefined}
        actions={
          <>
            <Link to="/customers"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
            {can('customers_edit') && (
              <Link to={`/customers/${id}/edit`}>
                <Button><Edit2 className="h-4 w-4" /> Edit</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Total Revenue</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(totalRevenue)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Total Orders</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{orders.length}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Open Quotes</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">
            {quotes.filter((q) => ['draft', 'sent'].includes(q.status)).length}
          </div>
        </CardBody></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div><span className="text-steel-500">Email:</span> {customer.email || '—'}</div>
            <div><span className="text-steel-500">Phone:</span> {customer.phone || '—'}</div>
            <div><span className="text-steel-500">Address:</span> {customer.address || '—'}</div>
            <div><span className="text-steel-500">City/State:</span> {[customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || '—'}</div>
            {customer.notes && <div className="pt-2 border-t border-steel-100 text-steel-600">{customer.notes}</div>}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Sales Orders</CardTitle></CardHeader>
        <CardBody className="p-0">
          {orders.length === 0 ? <EmptyState title="No orders" /> : (
            <Table>
              <THead>
                <tr>
                  <TH>SO #</TH><TH>Date</TH><TH>Status</TH><TH>Payment</TH><TH align="right">Total</TH>
                </tr>
              </THead>
              <TBody>
                {orders.map((o) => (
                  <TR key={o.id}>
                    <TD><Link to={`/sales-orders/${o.id}`} className="font-mono text-xs text-brand-700 hover:underline">{o.so_number}</Link></TD>
                    <TD>{formatDate(o.order_date)}</TD>
                    <TD><StatusBadge status={o.status} /></TD>
                    <TD><StatusBadge status={o.payment_status} /></TD>
                    <TD align="right">{formatCurrency(o.total)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quotes</CardTitle></CardHeader>
        <CardBody className="p-0">
          {quotes.length === 0 ? <EmptyState title="No quotes" /> : (
            <Table>
              <THead>
                <tr>
                  <TH>Quote #</TH><TH>Date</TH><TH>Status</TH><TH align="right">Total</TH>
                </tr>
              </THead>
              <TBody>
                {quotes.map((q) => (
                  <TR key={q.id}>
                    <TD><Link to={`/quotes/${q.id}`} className="font-mono text-xs text-brand-700 hover:underline">{q.quote_number}</Link></TD>
                    <TD>{formatDate(q.quote_date)}</TD>
                    <TD><StatusBadge status={q.status} /></TD>
                    <TD align="right">{formatCurrency(q.total)}</TD>
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
