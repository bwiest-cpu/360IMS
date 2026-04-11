import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Printer, Send, FileText, CheckCircle2, DollarSign, PackageCheck
} from 'lucide-react'
import { supabase, logActivity } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { EmailModal } from '@/components/shared/EmailModal'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { usePermissions } from '@/hooks/usePermissions'
import { SalesOrderPdf, pdfToBlob, pdfToBase64, downloadBlob } from '@/lib/pdf'
import { sendDocumentEmail, invoiceEmailHtml } from '@/lib/resend'
import { fulfillSalesOrder } from '@/lib/fifo'
import { createCommissionForSalesOrder } from '@/lib/commission'
import toast from 'react-hot-toast'

export default function SalesOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const company = useSettingsStore((s) => s.company)
  const { can } = usePermissions()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [customer, setCustomer] = useState(null)
  const [salesperson, setSalesperson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [emailOpen, setEmailOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [oRes, itemsRes] = await Promise.all([
      supabase.from('sales_orders')
        .select('*, customer:customers(*), salesperson:users!sales_orders_salesperson_id_fkey(*)')
        .eq('id', id).single(),
      supabase.from('sales_order_items')
        .select('*, product:products(id, name, sku, unit_of_measure)')
        .eq('sales_order_id', id)
        .order('sort_order').order('created_at')
    ])
    if (oRes.error) { toast.error(oRes.error.message); navigate('/sales-orders'); return }
    setOrder(oRes.data)
    setCustomer(oRes.data.customer)
    setSalesperson(oRes.data.salesperson)
    setItems(itemsRes.data ?? [])
    setLoading(false)
  }

  async function setStatus(newStatus, extra = {}) {
    const { error } = await supabase.from('sales_orders').update({ status: newStatus, ...extra }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    await logActivity('updated status', 'sales_order', id, order.so_number, { status: newStatus })
    await load()
    return true
  }

  async function handleConfirm() {
    setBusy(true)
    try {
      if (await setStatus('confirmed')) toast.success('Order confirmed')
    } finally { setBusy(false) }
  }

  async function handleInvoice() {
    setBusy(true)
    try {
      if (await setStatus('invoiced', { invoice_date: new Date().toISOString().slice(0, 10) })) {
        toast.success('Marked invoiced')
      }
    } finally { setBusy(false) }
  }

  async function handleFulfill() {
    if (!confirm('This will deduct inventory using FIFO and lock costs. Continue?')) return
    setBusy(true)
    try {
      await fulfillSalesOrder(id)
      await logActivity('fulfilled', 'sales_order', id, order.so_number)
      toast.success('Order fulfilled — inventory updated')
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally { setBusy(false) }
  }

  async function handleMarkPaid() {
    if (!confirm('Mark this order as paid? This will generate a commission record for the salesperson.')) return
    setBusy(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { error } = await supabase.from('sales_orders').update({
        payment_status: 'paid',
        payment_date: today
      }).eq('id', id)
      if (error) throw error
      try {
        await createCommissionForSalesOrder(id)
      } catch (err) {
        // commission creation may fail if items not fulfilled — warn but don't block
        toast.error(`Marked paid but commission failed: ${err.message}`)
      }
      await logActivity('marked paid', 'sales_order', id, order.so_number)
      toast.success('Marked paid, commission generated')
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally { setBusy(false) }
  }

  async function handleMarkPartial() {
    const { error } = await supabase.from('sales_orders').update({ payment_status: 'partial' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Marked partially paid')
    await load()
  }

  async function handlePdf() {
    const doc = <SalesOrderPdf order={order} customer={customer} salesperson={salesperson} items={items} company={company} />
    const blob = await pdfToBlob(doc)
    downloadBlob(blob, `${order.so_number}.pdf`)
  }

  async function handleSend({ to, subject }) {
    setSending(true)
    try {
      const doc = <SalesOrderPdf order={order} customer={customer} salesperson={salesperson} items={items} company={company} />
      const base64 = await pdfToBase64(doc)
      const html = invoiceEmailHtml({
        soNumber: order.so_number,
        customerName: customer?.contact_name || customer?.company_name || '',
        salespersonName: salesperson?.full_name || profile?.full_name || '',
        companyName: company?.company_name ?? '360 Metal Roofing Supply'
      })
      await sendDocumentEmail({
        to, subject: subject ?? `Invoice ${order.so_number}`, html,
        fromName: salesperson?.full_name || profile?.full_name,
        attachmentBase64: base64,
        attachmentFilename: `${order.so_number}.pdf`,
        documentType: 'sales_order',
        documentId: id
      })
    } finally {
      setSending(false)
    }
  }

  async function convertToQuote() {
    if (!confirm('Convert this order back to a quote?')) return
    try {
      const payload = {
        customer_id: order.customer_id,
        salesperson_id: order.salesperson_id,
        quote_date: new Date().toISOString().slice(0, 10),
        subtotal: order.subtotal,
        freight_charge: order.freight_charge,
        sales_tax_rate: order.sales_tax_rate,
        sales_tax_amount: order.sales_tax_amount,
        total: order.subtotal + order.freight_charge + order.sales_tax_amount,
        notes: order.notes,
        internal_notes: order.internal_notes,
        created_by: profile?.id
      }
      const { data: newQuote, error } = await supabase.from('sales_quotes').insert(payload).select().single()
      if (error) throw error
      const quoteItems = items.map((i, idx) => ({
        quote_id: newQuote.id,
        product_id: i.product_id,
        custom_description: i.custom_description,
        quantity: i.quantity,
        unit_of_measure: i.unit_of_measure,
        unit_price: i.unit_price,
        fifo_cost_snapshot: i.fifo_cost,
        sort_order: idx
      }))
      await supabase.from('sales_quote_items').insert(quoteItems)
      toast.success('Converted to quote')
      navigate(`/quotes/${newQuote.id}`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) return <PageLoader />
  if (!order) return null

  const canEdit = can('docs_edit', order.salesperson_id) && order.status === 'draft'

  return (
    <div>
      <PageHeader
        title={order.so_number}
        description={`${customer?.company_name || customer?.contact_name || ''} • ${formatDate(order.order_date)}`}
        actions={
          <>
            <Link to="/sales-orders"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
            <Button variant="outline" onClick={handlePdf}><Printer className="h-4 w-4" /> PDF</Button>
            {can('docs_send_email') && (
              <Button variant="outline" onClick={() => setEmailOpen(true)}><Send className="h-4 w-4" /> Email</Button>
            )}
            {canEdit && <Link to={`/sales-orders/${id}/edit`}><Button variant="outline"><Edit2 className="h-4 w-4" /> Edit</Button></Link>}
            {can('docs_convert') && (
              <Button variant="outline" onClick={convertToQuote}><FileText className="h-4 w-4" /> To Quote</Button>
            )}
          </>
        }
      />

      {/* Status + actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Status</div>
          <div className="mt-1"><StatusBadge status={order.status} /></div>
          {can('docs_edit', order.salesperson_id) && (
            <div className="flex flex-col gap-1 mt-3">
              {order.status === 'draft' && (
                <Button size="sm" onClick={handleConfirm} loading={busy}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                </Button>
              )}
              {['draft', 'confirmed'].includes(order.status) && (
                <Button size="sm" variant="secondary" onClick={handleInvoice} loading={busy}>
                  <FileText className="h-3.5 w-3.5" /> Mark Invoiced
                </Button>
              )}
              {can('so_fulfill') && ['confirmed', 'invoiced'].includes(order.status) && (
                <Button size="sm" variant="success" onClick={handleFulfill} loading={busy}>
                  <PackageCheck className="h-3.5 w-3.5" /> Fulfill
                </Button>
              )}
            </div>
          )}
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Payment</div>
          <div className="mt-1"><StatusBadge status={order.payment_status} /></div>
          {can('so_mark_paid') && order.payment_status !== 'paid' && (
            <div className="flex flex-col gap-1 mt-3">
              {order.payment_status === 'unpaid' && (
                <Button size="sm" variant="outline" onClick={handleMarkPartial}>
                  Partial
                </Button>
              )}
              <Button size="sm" variant="success" onClick={handleMarkPaid} loading={busy}>
                <DollarSign className="h-3.5 w-3.5" /> Mark Paid
              </Button>
            </div>
          )}
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Invoice Date</div>
          <div className="text-base font-semibold text-steel-900 mt-1">{order.invoice_date ? formatDate(order.invoice_date) : '—'}</div>
          {order.fulfilled_date && (
            <>
              <div className="text-xs text-steel-500 uppercase font-medium mt-3">Fulfilled</div>
              <div className="text-base font-semibold text-steel-900 mt-1">{formatDate(order.fulfilled_date)}</div>
            </>
          )}
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Total</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(order.total)}</div>
          {order.payment_date && (
            <div className="text-xs text-steel-500 mt-1">Paid {formatDate(order.payment_date)}</div>
          )}
        </CardBody></Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <CardBody className="p-0">
          <Table>
            <THead>
              <tr>
                <TH>Description</TH>
                <TH align="right">Qty</TH>
                <TH>UOM</TH>
                <TH align="right">Unit Price</TH>
                {can('reports_profit') && <TH align="right">FIFO Cost</TH>}
                <TH align="right">Total</TH>
              </tr>
            </THead>
            <TBody>
              {items.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <div className="font-medium">{i.custom_description || i.product?.name || '—'}</div>
                    {i.product?.sku && <div className="text-xs text-steel-500 font-mono">{i.product.sku}</div>}
                  </TD>
                  <TD align="right">{formatNumber(i.quantity)}</TD>
                  <TD>{i.unit_of_measure}</TD>
                  <TD align="right">{formatCurrency(i.unit_price)}</TD>
                  {can('reports_profit') && (
                    <TD align="right" className="text-steel-500">{formatCurrency(i.fifo_cost, { decimals: 4 })}</TD>
                  )}
                  <TD align="right">{formatCurrency(Number(i.quantity) * Number(i.unit_price))}</TD>
                </TR>
              ))}
              <TR className="bg-steel-50 font-semibold">
                <TD></TD><TD></TD><TD></TD><TD></TD>
                {can('reports_profit') && <TD></TD>}
                <TD align="right">{formatCurrency(order.subtotal)}</TD>
              </TR>
              {Number(order.freight_charge) > 0 && (
                <TR className="bg-steel-50">
                  <TD colSpan={can('reports_profit') ? 4 : 3}></TD>
                  <TD align="right">Freight</TD>
                  <TD align="right">{formatCurrency(order.freight_charge)}</TD>
                </TR>
              )}
              <TR className="bg-steel-50">
                <TD colSpan={can('reports_profit') ? 4 : 3}></TD>
                <TD align="right">Tax ({(Number(order.sales_tax_rate) * 100).toFixed(3)}%)</TD>
                <TD align="right">{formatCurrency(order.sales_tax_amount)}</TD>
              </TR>
              {Number(order.credit_card_fee_amount) > 0 && (
                <TR className="bg-steel-50">
                  <TD colSpan={can('reports_profit') ? 4 : 3}></TD>
                  <TD align="right">CC Fee ({(Number(order.credit_card_fee_rate) * 100).toFixed(2)}%)</TD>
                  <TD align="right">{formatCurrency(order.credit_card_fee_amount)}</TD>
                </TR>
              )}
              <TR className="bg-steel-100 font-bold">
                <TD colSpan={can('reports_profit') ? 4 : 3}></TD>
                <TD align="right">Total</TD>
                <TD align="right">{formatCurrency(order.total)}</TD>
              </TR>
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {(order.notes || order.internal_notes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {order.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardBody><p className="text-sm text-steel-700 whitespace-pre-wrap">{order.notes}</p></CardBody>
            </Card>
          )}
          {order.internal_notes && can('reports_profit') && (
            <Card>
              <CardHeader><CardTitle>Internal Notes</CardTitle></CardHeader>
              <CardBody><p className="text-sm text-steel-700 whitespace-pre-wrap">{order.internal_notes}</p></CardBody>
            </Card>
          )}
        </div>
      )}

      <EmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultTo={customer?.email ?? ''}
        defaultSubject={`Invoice ${order.so_number} from 360 Metal Roofing Supply`}
        defaultBody={`Hi ${customer?.contact_name || customer?.company_name || ''},\n\nPlease find attached invoice ${order.so_number}.\n\nThanks,\n${salesperson?.full_name || profile?.full_name || ''}`}
        onSend={handleSend}
        sending={sending}
      />
    </div>
  )
}
