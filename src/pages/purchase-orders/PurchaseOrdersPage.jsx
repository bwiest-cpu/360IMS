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

export default function PurchaseOrdersPage() {
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(company_name)')
      .order('order_date', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status && r.status !== status) return false
      if (query) {
        const q = query.toLowerCase()
        if (!r.po_number.toLowerCase().includes(q) &&
            !(r.supplier?.company_name ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [rows, query, status])

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Track orders placed with suppliers."
        actions={
          can('docs_create') && (
            <Link to="/purchase-orders/new">
              <Button><Plus className="h-4 w-4" /> New PO</Button>
            </Link>
          )
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col sm:flex-row gap-3">
          <SearchBar value={query} onChange={setQuery} placeholder="Search PO # or supplier..." className="flex-1" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </CardBody>
      </Card>

      <Card>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState
            title="No purchase orders"
            description="Create a PO to order inventory from a supplier."
            action={can('docs_create') && (
              <Link to="/purchase-orders/new"><Button><Plus className="h-4 w-4" /> New PO</Button></Link>
            )}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>PO #</TH>
                <TH>Supplier</TH>
                <TH>Order Date</TH>
                <TH>Status</TH>
                <TH align="right">Total</TH>
              </tr>
            </THead>
            <TBody>
              {filtered.map((r) => (
                <TR key={r.id} clickable onClick={() => navigate(`/purchase-orders/${r.id}`)}>
                  <TD className="font-mono text-xs">{r.po_number}</TD>
                  <TD className="font-medium">{r.supplier?.company_name ?? '—'}</TD>
                  <TD>{formatDate(r.order_date)}</TD>
                  <TD><StatusBadge status={r.status} /></TD>
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
