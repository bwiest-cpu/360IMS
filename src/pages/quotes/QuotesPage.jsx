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

export default function QuotesPage() {
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
      .from('sales_quotes')
      .select('*, customer:customers(company_name, contact_name), salesperson:users!sales_quotes_salesperson_id_fkey(full_name)')
      .order('quote_date', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status && r.status !== status) return false
      if (query) {
        const q = query.toLowerCase()
        const custName = r.customer?.company_name || r.customer?.contact_name || ''
        if (!r.quote_number.toLowerCase().includes(q) && !custName.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [rows, query, status])

  return (
    <div>
      <PageHeader
        title="Sales Quotes"
        description="Create and send quotes to customers."
        actions={
          can('docs_create') && (
            <Link to="/quotes/new"><Button><Plus className="h-4 w-4" /> New Quote</Button></Link>
          )
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col sm:flex-row gap-3">
          <SearchBar value={query} onChange={setQuery} placeholder="Search quote # or customer..." className="flex-1" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-36">
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
            <option value="converted">Converted</option>
          </Select>
        </CardBody>
      </Card>

      <Card>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState
            title="No quotes yet"
            description="Create a quote to start selling."
            action={can('docs_create') && (
              <Link to="/quotes/new"><Button><Plus className="h-4 w-4" /> New Quote</Button></Link>
            )}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Quote #</TH><TH>Customer</TH><TH>Date</TH><TH>Salesperson</TH><TH>Status</TH><TH align="right">Total</TH>
              </tr>
            </THead>
            <TBody>
              {filtered.map((r) => (
                <TR key={r.id} clickable onClick={() => navigate(`/quotes/${r.id}`)}>
                  <TD className="font-mono text-xs">{r.quote_number}</TD>
                  <TD className="font-medium">{r.customer?.company_name || r.customer?.contact_name || '—'}</TD>
                  <TD>{formatDate(r.quote_date)}</TD>
                  <TD>{r.salesperson?.full_name || '—'}</TD>
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
