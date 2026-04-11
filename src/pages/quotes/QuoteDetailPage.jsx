import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit2, Printer, Send, ShoppingCart, CheckCircle, XCircle } from 'lucide-react'
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
import { QuotePdf, pdfToBlob, pdfToBase64, downloadBlob } from '@/lib/pdf'
import { sendDocumentEmail, quoteEmailHtml } from '@/lib/resend'
import toast from 'react-hot-toast'

export default function QuoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const company = useSettingsStore((s) => s.company)
  const { can } = usePermissions()
  const [quote, setQuote] = useState(null)
  const [items, setItems] = useState([])
  const [customer, setCustomer] = useState(null)
  const [salesperson, setSalesperson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [emailOpen, setEmailOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [converting, setConverting] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [qRes, itemsRes] = await Promise.all([
      supabase.from('sales_quotes')
        .select('*, customer:customers(*), salesperson:users!sales_quotes_salesperson_id_fkey(*)')
        .eq('id', id).single(),
      supabase.from('sales_quote_items')
        .select('*, product:products(id, name, sku, unit_of_measure)')
        .eq('quote_id', id)
        .order('sort_order').order('created_at')
    ])
    if (qRes.error) { toast.error(qRes.error.message); navigate('/quotes'); return }
    setQuote(qRes.data)
    setCustomer(qRes.data.customer)
    setSalesperson(qRes.data.salesperson)
    setItems(itemsRes.data ?? [])
    setLoading(false)
  }

  async function updateStatus(newStatus) {
    const { error } = await supabase.from('sales_quotes').update({ status: newStatus }).eq('id', id)
    if (error) { toast.error(error.message); return }
    await logActivity('updated status', 'quote', id, quote.quote_number, { status: newStatus })
    toast.success(`Marked ${newStatus}`)
    await load()
  }

  async function handlePdf() {
    const doc = <QuotePdf quote={quote} customer={customer} salesperson={salesperson} items={items} company={company} />
    const blob = await pdfToBlob(doc)
    downloadBlob(blob, `${quote.quote_number}.pdf`)
  }

  async function handleSend({ to, subject }) {
    setSending(true)
    try {
      const doc = <QuotePdf quote={quote} customer={customer} salesperson={salesperson} items={items} company={company} />
      const base64 = await pdfToBase64(doc)
      const html = quoteEmailHtml({
        quoteNumber: quote.quote_number,
        customerName: customer?.contact_name || customer?.company_name || '',
        salespersonName: salesperson?.full_name || profile?.full_name || '',
        expiryDate: quote.expiry_date ? formatDate(quote.expiry_date) : null,
        companyName: company?.company_name ?? '360 Metal Roofing Supply'
      })
      await sendDocumentEmail({
        to, subject: subject ?? `Quote ${quote.quote_number}`, html,
        fromName: salesperson?.full_name || profile?.full_name,
        attachmentBase64: base64,
        attachmentFilename: `${quote.quote_number}.pdf`,
        documentType: 'quote',
        documentId: id
      })
      if (quote.status === 'draft') {
        await supabase.from('sales_quotes').update({ status: 'sent' }).eq('id', id)
        await load()
      }
    } finally {
      setSending(false)
    }
  }

  async function convertToSo() {
    if (!confirm('Convert this quote to a Sales Order?')) return
    setConverting(true)
    try {
      const soPayload = {
        customer_id: quote.customer_id,
        salesperson_id: quote.salesperson_id,
        order_date: new Date().toISOString().slice(0, 10),
        subtotal: quote.subtotal,
        freight_charge: quote.freight_charge,
        sales_tax_rate: quote.sales_tax_rate,
        sales_tax_amount: quote.sales_tax_amount,
        total: quote.total,
        notes: quote.notes,
        internal_notes: quote.internal_notes,
        converted_from_quote_id: id,
        created_by: profile?.id
      }
      const { data: so, error } = await supabase.from('sales_orders').insert(soPayload).select().single()
      if (error) throw error

      const soItems = items.map((i, idx) => ({
        sales_order_id: so.id,
        product_id: i.product_id,
        custom_description: i.custom_description,
        quantity: i.quantity,
        unit_of_measure: i.unit_of_measure,
        unit_price: i.unit_price,
        fifo_cost: 0,
        sort_order: idx
      }))
      await supabase.from('sales_order_items').insert(soItems)

      await supabase.from('sales_quotes').update({
        status: 'converted', converted_to_so_id: so.id
      }).eq('id', id)

      await logActivity('converted to SO', 'quote', id, quote.quote_number)
      toast.success('Converted to Sales Order')
      navigate(`/sales-orders/${so.id}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setConverting(false)
    }
  }

  if (loading) return <PageLoader />
  if (!quote) return null

  const canEdit = can('docs_edit', quote.salesperson_id) && ['draft', 'sent'].includes(quote.status)

  return (
    <div>
      <PageHeader
        title={quote.quote_number}
        description={`${customer?.company_name || customer?.contact_name || ''} • ${formatDate(quote.quote_date)}`}
        actions={
          <>
            <Link to="/quotes"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
            <Button variant="outline" onClick={handlePdf}><Printer className="h-4 w-4" /> PDF</Button>
            {can('docs_send_email') && (
              <Button variant="outline" onClick={() => setEmailOpen(true)}><Send className="h-4 w-4" /> Email</Button>
            )}
            {canEdit && (
              <Link to={`/quotes/${id}/edit`}><Button variant="outline"><Edit2 className="h-4 w-4" /> Edit</Button></Link>
            )}
            {can('docs_convert') && quote.status !== 'converted' && (
              <Button onClick={convertToSo} loading={converting}>
                <ShoppingCart className="h-4 w-4" /> Convert to SO
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Status</div>
          <div className="mt-1"><StatusBadge status={quote.status} /></div>
          {can('docs_edit', quote.salesperson_id) && quote.status === 'sent' && (
            <div className="flex gap-1 mt-3">
              <Button size="sm" variant="success" onClick={() => updateStatus('accepted')}>
                <CheckCircle className="h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="danger" onClick={() => updateStatus('declined')}>
                <XCircle className="h-3.5 w-3.5" /> Decline
              </Button>
            </div>
          )}
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Quote Date</div>
          <div className="text-base font-semibold text-steel-900 mt-1">{formatDate(quote.quote_date)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Expires</div>
          <div className="text-base font-semibold text-steel-900 mt-1">{quote.expiry_date ? formatDate(quote.expiry_date) : '—'}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Total</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(quote.total)}</div>
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
                  <TD align="right">{formatCurrency(Number(i.quantity) * Number(i.unit_price))}</TD>
                </TR>
              ))}
              <TR className="bg-steel-50 font-semibold">
                <TD></TD><TD></TD><TD></TD>
                <TD align="right">Subtotal</TD>
                <TD align="right">{formatCurrency(quote.subtotal)}</TD>
              </TR>
              {Number(quote.freight_charge) > 0 && (
                <TR className="bg-steel-50">
                  <TD></TD><TD></TD><TD></TD>
                  <TD align="right">Freight</TD>
                  <TD align="right">{formatCurrency(quote.freight_charge)}</TD>
                </TR>
              )}
              <TR className="bg-steel-50">
                <TD></TD><TD></TD><TD></TD>
                <TD align="right">Tax ({(Number(quote.sales_tax_rate) * 100).toFixed(3)}%)</TD>
                <TD align="right">{formatCurrency(quote.sales_tax_amount)}</TD>
              </TR>
              <TR className="bg-steel-100 font-bold">
                <TD></TD><TD></TD><TD></TD>
                <TD align="right">Total</TD>
                <TD align="right">{formatCurrency(quote.total)}</TD>
              </TR>
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {(quote.notes || quote.internal_notes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quote.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardBody><p className="text-sm text-steel-700 whitespace-pre-wrap">{quote.notes}</p></CardBody>
            </Card>
          )}
          {quote.internal_notes && (
            <Card>
              <CardHeader><CardTitle>Internal Notes</CardTitle></CardHeader>
              <CardBody><p className="text-sm text-steel-700 whitespace-pre-wrap">{quote.internal_notes}</p></CardBody>
            </Card>
          )}
        </div>
      )}

      <EmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultTo={customer?.email ?? ''}
        defaultSubject={`Quote ${quote.quote_number} from 360 Metal Roofing Supply`}
        defaultBody={`Hi ${customer?.contact_name || customer?.company_name || ''},\n\nPlease find attached quote ${quote.quote_number}.\n\nThanks,\n${salesperson?.full_name || profile?.full_name || ''}`}
        onSend={handleSend}
        sending={sending}
      />
    </div>
  )
}
