import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { FormField, Select } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/format'
import { usePermissions } from '@/hooks/usePermissions'

export default function CommissionDetailReport() {
  const profile = useAuthStore((s) => s.profile)
  const { can } = usePermissions()
  const canViewAll = can('commission_view_all')
  const [salespeople, setSalespeople] = useState([])
  const [selected, setSelected] = useState(profile?.id ?? '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (canViewAll) {
      supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')
        .then(({ data }) => setSalespeople(data ?? []))
    }
  }, [canViewAll])

  useEffect(() => {
    if (selected) load()
  }, [selected])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('commission_records')
      .select(`*, sales_order:sales_orders(so_number, customer:customers(company_name, contact_name))`)
      .eq('salesperson_id', selected)
      .order('invoice_date', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  const total = rows.reduce((s, r) => s + Number(r.commission_amount), 0)
  const unpaid = rows.filter((r) => !r.is_paid).reduce((s, r) => s + Number(r.commission_amount), 0)

  return (
    <div>
      <PageHeader title="Commission Detail" />

      {canViewAll && (
        <Card className="mb-4">
          <CardBody>
            <FormField label="Salesperson">
              <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">— Select —</option>
                {salespeople.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </Select>
            </FormField>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase">Total Earned</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(total)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase">Paid Out</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(total - unpaid)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase">Pending</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(unpaid)}</div>
        </CardBody></Card>
      </div>

      <Card>
        {loading ? <PageLoader /> : rows.length === 0 ? <EmptyState title="No records" /> : (
          <Table>
            <THead>
              <tr>
                <TH>Period</TH>
                <TH>SO #</TH>
                <TH>Customer</TH>
                <TH>Invoice</TH>
                <TH align="right">Net Profit</TH>
                <TH align="right">Commission</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>{r.commission_period}</TD>
                  <TD className="font-mono text-xs">{r.sales_order?.so_number}</TD>
                  <TD>{r.sales_order?.customer?.company_name || r.sales_order?.customer?.contact_name}</TD>
                  <TD>{formatDate(r.invoice_date)}</TD>
                  <TD align="right">{formatCurrency(r.net_profit)}</TD>
                  <TD align="right" className="font-semibold">{formatCurrency(r.commission_amount)}</TD>
                  <TD>{r.is_paid ? <span className="text-emerald-700 text-xs">Paid</span> : <span className="text-amber-700 text-xs">Pending</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
