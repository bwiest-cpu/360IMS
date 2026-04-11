import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit2, Printer, Send, PackageCheck } from 'lucide-react'
import { supabase, logActivity } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Input'
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { EmailModal } from '@/components/shared/EmailModal'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { usePermissions } from '@/hooks/usePermissions'
import { PurchaseOrderPdf, pdfToBlob, pdfToBase64, downloadBlob } from '@/lib/pdf'
import { sendDocumentEmail, purchaseOrderEmailHtml } from '@/lib/resend'
import { receivePurchaseOrderItem } from '@/lib/fifo'
import toast from 'react-hot-toast'

export default function PurchaseOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const company = useSettingsStore((s) => s.company)
  const { can } = usePermissions()
  const [po, setPo] = useState(null)
  const [items, setItems] = useState([])
  const [supplier, setSupplier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveItem, setReceiveItem] = useState(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [poRes, itemsRes] = await Promise.all([
      supabase.from('purchase_orders')
        .select('*, supplier:suppliers(*)')
        .eq('id', id).single(),
      supabase.from('purchase_order_items')
        .select('*, product:products(id, name, sku, unit_of_measure)')
        .eq('purchase_order_id', id)
        .order('created_at', { ascending: true })
    ])
    if (poRes.error) { toast.error(poRes.error.message); navigate('/purchase-orders'); return }
    setPo(poRes.data)
    setSupplier(poRes.data.supplier)
    setItems(itemsRes.data ?? [])
    setLoading(false)
  }

  async function markSent() {
    await supabase.from('purchase_orders').update({ status: 'sent' }).eq('id', id)
    await logActivity('marked sent', 'purchase_order', id, po.po_number)
    await load()
    toast.success('Marked as sent')
  }

  async function handleSendEmail({ to, subject }) {
    if (!supplier) throw new Error('No supplier')
    setSending(true)
    try {
      const doc = <PurchaseOrderPdf po={po} supplier={supplier} items={items} company={company} />
      const base64 = await pdfToBase64(doc)
      const html = purchaseOrderEmailHtml({
        poNumber: po.po_number,
        supplierName: supplier.company_name,
        senderName: profile?.full_name,
        companyName: company?.company_name ?? '360 Metal Roofing Supply'
      })
      await sendDocumentEmail({
        to,
        subject: subject ?? `PO ${po.po_number} from 360 Metal Roofing Supply`,
        html,
        fromName: profile?.full_name,
        attachmentBase64: base64,
        attachmentFilename: `${po.po_number}.pdf`,
        documentType: 'purchase_order',
        documentId: id
      })
      if (po.status === 'draft') await markSent()
    } finally {
      setSending(false)
    }
  }

  async function handlePdf() {
    const doc = <PurchaseOrderPdf po={po} supplier={supplier} items={items} company={company} />
    const blob = await pdfToBlob(doc)
    downloadBlob(blob, `${po.po_number}.pdf`)
  }

  async function handleReceive(payload) {
    try {
      await receivePurchaseOrderItem(payload)
      toast.success('Items received')
      setReceiveOpen(false)
      setReceiveItem(null)
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) return <PageLoader />
  if (!po) return null

  const canReceive = can('inventory_manage') && ['sent', 'partially_received'].includes(po.status)
  const canEdit = can('docs_edit') && po.status === 'draft'

  return (
    <div>
      <PageHeader
        title={po.po_number}
        description={`${supplier?.company_name ?? ''} • ${formatDate(po.order_date)}`}
        actions={
          <>
            <Link to="/purchase-orders"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
            <Button variant="outline" onClick={handlePdf}><Printer className="h-4 w-4" /> PDF</Button>
            {can('docs_send_email') && (
              <Button variant="outline" onClick={() => setEmailOpen(true)}><Send className="h-4 w-4" /> Email</Button>
            )}
            {canEdit && <Link to={`/purchase-orders/${id}/edit`}><Button><Edit2 className="h-4 w-4" /> Edit</Button></Link>}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Status</div>
          <div className="mt-1"><StatusBadge status={po.status} /></div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Order Date</div>
          <div className="text-base font-semibold text-steel-900 mt-1">{formatDate(po.order_date)}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Expected</div>
          <div className="text-base font-semibold text-steel-900 mt-1">{po.expected_date ? formatDate(po.expected_date) : '—'}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-steel-500 uppercase font-medium">Total</div>
          <div className="text-2xl font-bold text-steel-900 mt-1">{formatCurrency(po.total)}</div>
        </CardBody></Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Line Items</CardTitle>
            {canReceive && (
              <Button size="sm" onClick={() => setReceiveOpen(true)}>
                <PackageCheck className="h-4 w-4" /> Receive Items
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH align="right">Ordered</TH>
                <TH align="right">Received</TH>
                <TH align="right">Unit Cost</TH>
                <TH align="right">Line Total</TH>
              </tr>
            </THead>
            <TBody>
              {items.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <div className="font-medium">{i.product?.name}</div>
                    <div className="text-xs text-steel-500 font-mono">{i.product?.sku}</div>
                  </TD>
                  <TD align="right">{formatNumber(i.quantity_ordered)} {i.product?.unit_of_measure}</TD>
                  <TD align="right">
                    <span className={Number(i.quantity_received) >= Number(i.quantity_ordered) ? 'text-emerald-600 font-semibold' : ''}>
                      {formatNumber(i.quantity_received)}
                    </span>
                  </TD>
                  <TD align="right">{formatCurrency(i.unit_cost, { decimals: 4 })}</TD>
                  <TD align="right">{formatCurrency(Number(i.quantity_ordered) * Number(i.unit_cost))}</TD>
                </TR>
              ))}
              <TR className="bg-steel-50 font-semibold">
                <TD></TD><TD></TD><TD></TD>
                <TD align="right">Subtotal</TD>
                <TD align="right">{formatCurrency(po.subtotal)}</TD>
              </TR>
              <TR className="bg-steel-50">
                <TD></TD><TD></TD><TD></TD>
                <TD align="right">Freight</TD>
                <TD align="right">{formatCurrency(po.freight_cost)}</TD>
              </TR>
              <TR className="bg-steel-100 font-bold">
                <TD></TD><TD></TD><TD></TD>
                <TD align="right">Total</TD>
                <TD align="right">{formatCurrency(po.total)}</TD>
              </TR>
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {po.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardBody><p className="text-sm text-steel-700 whitespace-pre-wrap">{po.notes}</p></CardBody>
        </Card>
      )}

      <ReceiveItemsModal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        items={items}
        onReceive={handleReceive}
      />

      <EmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultTo={supplier?.email ?? ''}
        defaultSubject={`PO ${po.po_number} from 360 Metal Roofing Supply`}
        defaultBody={`Hi ${supplier?.contact_name ?? supplier?.company_name ?? ''},\n\nPlease find attached PO ${po.po_number}.\n\nThanks,\n${profile?.full_name ?? ''}`}
        onSend={handleSendEmail}
        sending={sending}
      />
    </div>
  )
}

function ReceiveItemsModal({ open, onClose, items, onReceive }) {
  const [receiving, setReceiving] = useState({})

  React.useEffect(() => {
    if (open) {
      const initial = {}
      items.forEach((i) => {
        const remaining = Number(i.quantity_ordered) - Number(i.quantity_received)
        initial[i.id] = {
          qty: remaining > 0 ? String(remaining) : '',
          cost: String(i.unit_cost)
        }
      })
      setReceiving(initial)
    }
  }, [open, items])

  async function submit() {
    for (const item of items) {
      const r = receiving[item.id]
      if (!r?.qty || Number(r.qty) <= 0) continue
      await onReceive({
        poItemId: item.id,
        quantityReceived: Number(r.qty),
        actualUnitCost: Number(r.cost || item.unit_cost)
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive Items"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Receive All</Button>
        </div>
      }
    >
      <p className="text-sm text-steel-600 mb-4">
        Enter the actual quantity and unit cost received for each line item. This creates inventory lots and updates stock.
      </p>
      <div className="space-y-4">
        {items.map((i) => {
          const remaining = Number(i.quantity_ordered) - Number(i.quantity_received)
          return (
            <div key={i.id} className="p-3 border border-steel-200 rounded-md">
              <div className="font-medium">{i.product?.name}</div>
              <div className="text-xs text-steel-500 font-mono mb-2">{i.product?.sku}</div>
              <div className="text-xs text-steel-500 mb-2">
                Ordered: {formatNumber(i.quantity_ordered)} • Received: {formatNumber(i.quantity_received)} • Remaining: {formatNumber(remaining)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Qty Received">
                  <Input type="number" step="0.0001"
                    value={receiving[i.id]?.qty ?? ''}
                    onChange={(e) => setReceiving((r) => ({ ...r, [i.id]: { ...r[i.id], qty: e.target.value } }))} />
                </FormField>
                <FormField label="Actual Unit Cost">
                  <Input type="number" step="0.0001"
                    value={receiving[i.id]?.cost ?? ''}
                    onChange={(e) => setReceiving((r) => ({ ...r, [i.id]: { ...r[i.id], cost: e.target.value } }))} />
                </FormField>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
