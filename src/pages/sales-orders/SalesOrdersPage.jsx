import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Select } from '@/components/ui/Input'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/lib/format'
import { usePermissions } from '@/hooks/usePermissions'

export default function SalesOrdersPage() {
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('sales_orders')
      .select('*, customer:customers(company_name, contact_name), salesperson:users!sales_orders_salesperson_id_fkey(full_name)')
      .order('order_date', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status && r.status !== status) return false
      if (paymentStatus && r.payment_status !== paymentStatus) return false
      if (query) {
        const q = query.toLowerCase()
        const custName = r.customer?.company_name || r.customer?.contact_name || ''
        if (!r.so_number.toLowerCase().includes(q) && !custName.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [rows, query, status, paymentStatus])

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="Track confirmed orders, invoices, and fulfillment."
        actions={
          can('docs_create') && (
            <Link to="/sales-orders/new"><Button><Plus className="h-4 w-4" /> New Order</Button></Link>
          )
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col sm:flex-row gap-3">
          <SearchBar value={query} onChange={setQuery} placeholder="Search SO # or customer..." className="flex-1" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-36">
            <option value="">Status: All</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="invoiced">Invoiced</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="sm:w-36">
            <option value="">Payment: All</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </Select>
        </CardBody>
      </Card>

      <Card>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState
            title="No sales orders"
            description="Create a sales order or convert a quote."
            action={can('docs_create') && (
              <Link to="/sales-orders/new"><Button><Plus className="h-4 w-4" /> New Order</Button></Link>
            )}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>SO #</TH><TH>Customer</TH><TH>Date</TH><TH>Salesperson</TH>
                <TH>Status</TH><TH>Payment</TH><TH align="right">Total</TH>
              </tr>
            </THead>
            <TBody>
              {filtered.map((r) => (
                <TR key={r.id} clickable onClick={() => navigate(`/sales-orders/${r.id}`)}>
                  <TD className="font-mono text-xs">{r.so_number}</TD>
                  <TD className="font-medium">{r.customer?.company_name || r.customer?.contact_name || '—'}</TD>
                  <TD>{formatDate(r.order_date)}</TD>
                  <TD>{r.salesperson?.full_name || '—'}</TD>
                  <TD><StatusBadge status={r.status} /></TD>
                  <TD><StatusBadge status={r.payment_status} /></TD>
                  <TD align="right">{formatCurrency(r.total)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
