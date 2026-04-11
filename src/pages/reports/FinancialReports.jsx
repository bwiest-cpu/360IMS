import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { ReportControls, usePeriodDefaults } from '@/components/shared/ReportControls'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/lib/format'
import { differenceInDays, parseISO } from 'date-fns'

export function PnLReport() {
  const d = usePeriodDefaults()
  const [startDate, setStartDate] = useState(d.start)
  const [endDate, setEndDate] = useState(d.end)
  const [basis, setBasis] = useState('accrual')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ revenue: 0, cogs: 0, freight: 0, cc: 0, tax: 0, profit: 0 })

  useEffect(() => { load() }, [startDate, endDate, basis])

  async function load() {
    setLoading(true)
    const dateCol = basis === 'cash' ? 'payment_date' : 'invoice_date'
    let q = supabase
      .from('sales_orders')
      .select(`subtotal, freight_charge, sales_tax_amount, credit_card_fee_amount, items:sales_order_items(quantity, fifo_cost)`)
      .gte(dateCol, startDate).lte(dateCol, endDate).not(dateCol, 'is', null)
    if (basis === 'cash') q = q.eq('payment_status', 'paid')
    else q = q.in('status', ['invoiced', 'fulfilled'])

    const { data: sos } = await q
    // freight "in" - from POs in range
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('freight_cost')
      .gte('order_date', startDate).lte('order_date', endDate)

    let revenue = 0, cogs = 0, freightOut = 0, cc = 0, tax = 0
    for (const so of sos ?? []) {
      revenue += Number(so.subtotal)
      freightOut += Number(so.freight_charge)
      cc += Number(so.credit_card_fee_amount)
      tax += Number(so.sales_tax_amount)
      for (const i of so.items ?? []) {
        cogs += Number(i.quantity) * Number(i.fifo_cost || 0)
      }
    }
    const freightIn = (pos ?? []).reduce((s, p) => s + Number(p.freight_cost), 0)

    const profit = revenue - cogs - freightIn - cc
    setSummary({ revenue, cogs, freight: freightIn, cc, tax, profit })
    setLoading(false)
  }

  return (
    <div>
      <PageHeader title="P&L Summary" />
      <ReportControls
        startDate={startDate} endDate={endDate}
        onChangeStart={setStartDate} onChangeEnd={setEndDate}
        basis={basis} onChangeBasis={setBasis}
      />
      {loading ? <PageLoader /> : (
        <Card>
          <Table>
            <TBody>
              <TR className="font-semibold bg-steel-50"><TD>Revenue</TD><TD align="right">{formatCurrency(summary.revenue)}</TD></TR>
              <TR><TD className="pl-8 text-steel-600">Cost of Goods Sold</TD><TD align="right" className="text-rose-600">({formatCurrency(summary.cogs)})</TD></TR>
              <TR><TD className="pl-8 text-steel-600">Freight (inbound)</TD><TD align="right" className="text-rose-600">({formatCurrency(summary.freight)})</TD></TR>
              <TR><TD className="pl-8 text-steel-600">Credit Card Fees</TD><TD align="right" className="text-rose-600">({formatCurrency(summary.cc)})</TD></TR>
              <TR className="font-bold bg-brand-50">
                <TD>Net Profit</TD>
                <TD align="right">{formatCurrency(summary.profit)}</TD>
              </TR>
              <TR className="text-xs text-steel-500">
                <TD>Sales Tax Collected (pass-through)</TD>
                <TD align="right">{formatCurrency(summary.tax)}</TD>
              </TR>
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

export function AccountsReceivableReport() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('sales_orders')
      .select('*, customer:customers(company_name, contact_name)')
      .in('payment_status', ['unpaid', 'partial'])
      .in('status', ['invoiced', 'fulfilled'])
      .order('invoice_date', { ascending: true })
    const today = new Date()
    const enriched = (data ?? []).map((r) => ({
      ...r,
      days: r.invoice_date ? differenceInDays(today, parseISO(r.invoice_date)) : 0
    }))
    setRows(enriched)
    setLoading(false)
  }

  const total = rows.reduce((s, r) => s + Number(r.total), 0)

  return (
    <div>
      <PageHeader title="Accounts Receivable" description={`Total outstanding: ${formatCurrency(total)}`} />
      {loading ? <PageLoader /> : rows.length === 0 ? (
        <Card><EmptyState title="No outstanding invoices" /></Card>
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>SO #</TH><TH>Customer</TH><TH>Invoice Date</TH>
                <TH align="right">Days</TH><TH>Payment</TH><TH align="right">Total</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">{r.so_number}</TD>
                  <TD className="font-medium">{r.customer?.company_name || r.customer?.contact_name}</TD>
                  <TD>{formatDate(r.invoice_date)}</TD>
                  <TD align="right" className={r.days > 60 ? 'text-rose-600 font-semibold' : r.days > 30 ? 'text-amber-700 font-semibold' : ''}>
                    {r.days}
                  </TD>
                  <TD>{r.payment_status}</TD>
                  <TD align="right">{formatCurrency(r.total)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

export function AccrualVsCashReport() {
  const d = usePeriodDefaults()
  const [startDate, setStartDate] = useState(d.start)
  const [endDate, setEndDate] = useState(d.end)
  const [accrual, setAccrual] = useState({ revenue: 0, count: 0 })
  const [cash, setCash] = useState({ revenue: 0, count: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [startDate, endDate])

  async function load() {
    setLoading(true)
    const [a, c] = await Promise.all([
      supabase.from('sales_orders').select('total')
        .gte('invoice_date', startDate).lte('invoice_date', endDate)
        .in('status', ['invoiced', 'fulfilled']),
      supabase.from('sales_orders').select('total')
        .gte('payment_date', startDate).lte('payment_date', endDate)
        .eq('payment_status', 'paid')
    ])
    setAccrual({
      revenue: (a.data ?? []).reduce((s, r) => s + Number(r.total), 0),
      count: a.data?.length ?? 0
    })
    setCash({
      revenue: (c.data ?? []).reduce((s, r) => s + Number(r.total), 0),
      count: c.data?.length ?? 0
    })
    setLoading(false)
  }

  return (
    <div>
      <PageHeader title="Accrual vs Cash Comparison" />
      <ReportControls
        startDate={startDate} endDate={endDate}
        onChangeStart={setStartDate} onChangeEnd={setEndDate}
        showBasis={false}
      />
      {loading ? <PageLoader /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardBody>
              <div className="text-xs text-steel-500 uppercase">Accrual (Invoice Date)</div>
              <div className="text-3xl font-bold text-steel-900 mt-2">{formatCurrency(accrual.revenue)}</div>
              <div className="text-sm text-steel-500 mt-1">{accrual.count} invoices</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-steel-500 uppercase">Cash (Payment Date)</div>
              <div className="text-3xl font-bold text-steel-900 mt-2">{formatCurrency(cash.revenue)}</div>
              <div className="text-sm text-steel-500 mt-1">{cash.count} payments received</div>
            </CardBody>
          </Card>
          <Card className="md:col-span-2">
            <CardBody>
              <div className="text-xs text-steel-500 uppercase">Difference</div>
              <div className="text-2xl font-bold mt-2">
                {formatCurrency(accrual.revenue - cash.revenue)}
              </div>
              <div className="text-sm text-steel-500 mt-1">
                Accrual higher than cash indicates unpaid invoices in the period.
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
