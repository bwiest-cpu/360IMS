import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Trash2, Plus } from 'lucide-react'
import { supabase, logActivity } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea, Select } from '@/components/ui/Input'
import { ProductPicker } from '@/components/shared/ProductPicker'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import { previewFifoCost } from '@/lib/fifo'
import toast from 'react-hot-toast'

function emptyLine() {
  return {
    id: crypto.randomUUID(),
    product: null,
    product_id: null,
    custom_description: '',
    quantity: '',
    unit_of_measure: 'each',
    unit_price: '',
    fifo_cost_snapshot: 0
  }
}

export default function QuoteFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useAuthStore((s) => s.profile)
  const company = useSettingsStore((s) => s.company)
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [salespeople, setSalespeople] = useState([])
  const [header, setHeader] = useState({
    customer_id: '',
    salesperson_id: profile?.id ?? '',
    quote_date: new Date().toISOString().slice(0, 10),
    expiry_date: '',
    freight_charge: '0',
    sales_tax_rate: String(company?.default_tax_rate ?? 0.0825),
    notes: '',
    internal_notes: ''
  })
  const [lines, setLines] = useState([emptyLine()])

  useEffect(() => {
    supabase.from('customers').select('id, company_name, contact_name').eq('is_active', true).order('company_name')
      .then(({ data }) => setCustomers(data ?? []))
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')
      .then(({ data }) => setSalespeople(data ?? []))
    if (isEdit) loadRow()
    else if (location.state?.fromSalesOrder) {
      // Pre-fill from a sales order (conversion)
      const so = location.state.fromSalesOrder
      setHeader((h) => ({
        ...h,
        customer_id: so.customer_id,
        salesperson_id: so.salesperson_id,
        freight_charge: String(so.freight_charge ?? 0),
        sales_tax_rate: String(so.sales_tax_rate ?? h.sales_tax_rate),
        notes: so.notes ?? ''
      }))
      const soLines = (location.state.items ?? []).map((i) => ({
        id: crypto.randomUUID(),
        product: i.product ?? null,
        product_id: i.product_id ?? null,
        custom_description: i.custom_description ?? '',
        quantity: String(i.quantity),
        unit_of_measure: i.unit_of_measure,
        unit_price: String(i.unit_price),
        fifo_cost_snapshot: Number(i.fifo_cost ?? 0)
      }))
      if (soLines.length > 0) setLines(soLines)
    }
  }, [id])

  async function loadRow() {
    setLoading(true)
    const [qRes, itemsRes] = await Promise.all([
      supabase.from('sales_quotes').select('*').eq('id', id).single(),
      supabase.from('sales_quote_items').select('*, product:products(id, name, sku, unit_of_measure)')
        .eq('quote_id', id).order('sort_order').order('created_at')
    ])
    if (qRes.error) { toast.error(qRes.error.message); navigate('/quotes'); return }
    const q = qRes.data
    setHeader({
      customer_id: q.customer_id,
      salesperson_id: q.salesperson_id,
      quote_date: q.quote_date,
      expiry_date: q.expiry_date ?? '',
      freight_charge: String(q.freight_charge ?? 0),
      sales_tax_rate: String(q.sales_tax_rate ?? 0.0825),
      notes: q.notes ?? '',
      internal_notes: q.internal_notes ?? ''
    })
    setLines((itemsRes.data ?? []).map((i) => ({
      id: i.id,
      product: i.product,
      product_id: i.product_id,
      custom_description: i.custom_description ?? '',
      quantity: String(i.quantity),
      unit_of_measure: i.unit_of_measure,
      unit_price: String(i.unit_price),
      fifo_cost_snapshot: Number(i.fifo_cost_snapshot ?? 0)
    })))
    setLoading(false)
  }

  function updateLine(lineId, patch) {
    setLines((ls) => ls.map((l) => l.id === lineId ? { ...l, ...patch } : l))
  }
  function addLine() { setLines((ls) => [...ls, emptyLine()]) }
  function removeLine(lineId) { setLines((ls) => ls.filter((l) => l.id !== lineId)) }

  async function onProductSelect(line, p) {
    let fifoCost = 0
    try {
      const preview = await previewFifoCost(p.id, Number(line.quantity || 1))
      fifoCost = preview.avgUnitCost
    } catch {}
    updateLine(line.id, {
      product: p,
      product_id: p.id,
      unit_of_measure: p.unit_of_measure,
      unit_price: line.unit_price || String(p.default_sales_price ?? 0),
      fifo_cost_snapshot: fifoCost
    })
  }

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0)
  const taxAmount = subtotal * Number(header.sales_tax_rate || 0)
  const total = subtotal + Number(header.freight_charge || 0) + taxAmount

  async function handleSubmit(e) {
    e.preventDefault()
    if (!header.customer_id) { toast.error('Select a customer'); return }
    if (!header.salesperson_id) { toast.error('Select a salesperson'); return }
    const validLines = lines.filter((l) => Number(l.quantity || 0) > 0 && (l.product_id || l.custom_description))
    if (validLines.length === 0) { toast.error('Add at least one line item'); return }

    setSaving(true)
    try {
      const payload = {
        customer_id: header.customer_id,
        salesperson_id: header.salesperson_id,
        quote_date: header.quote_date,
        expiry_date: header.expiry_date || null,
        subtotal: Number(subtotal.toFixed(2)),
        freight_charge: Number(header.freight_charge || 0),
        sales_tax_rate: Number(header.sales_tax_rate || 0),
        sales_tax_amount: Number(taxAmount.toFixed(2)),
        total: Number(total.toFixed(2)),
        notes: header.notes || null,
        internal_notes: header.internal_notes || null
      }

      let quoteId = id
      if (isEdit) {
        const { error } = await supabase.from('sales_quotes').update(payload).eq('id', id)
        if (error) throw error
        await supabase.from('sales_quote_items').delete().eq('quote_id', id)
      } else {
        payload.created_by = profile?.id
        const { data, error } = await supabase.from('sales_quotes').insert(payload).select().single()
        if (error) throw error
        quoteId = data.id
      }

      const itemsPayload = validLines.map((l, idx) => ({
        quote_id: quoteId,
        product_id: l.product_id || null,
        custom_description: l.custom_description || null,
        quantity: Number(l.quantity),
        unit_of_measure: l.unit_of_measure,
        unit_price: Number(l.unit_price || 0),
        fifo_cost_snapshot: Number(l.fifo_cost_snapshot || 0),
        sort_order: idx
      }))
      const { error } = await supabase.from('sales_quote_items').insert(itemsPayload)
      if (error) throw error

      await logActivity(isEdit ? 'updated' : 'created', 'quote', quoteId, `Quote`)
      toast.success(isEdit ? 'Quote updated' : 'Quote created')
      navigate(`/quotes/${quoteId}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Quote' : 'New Quote'} />
      <form onSubmit={handleSubmit}>
        <Card className="mb-4">
          <CardHeader><CardTitle>Quote Header</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Customer" required>
              <Select value={header.customer_id} onChange={(e) => setHeader({ ...header, customer_id: e.target.value })}>
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name || c.contact_name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Salesperson" required>
              <Select value={header.salesperson_id} onChange={(e) => setHeader({ ...header, salesperson_id: e.target.value })}>
                <option value="">— Select —</option>
                {salespeople.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </Select>
            </FormField>
            <FormField label="Quote Date" required>
              <Input type="date" value={header.quote_date} onChange={(e) => setHeader({ ...header, quote_date: e.target.value })} />
            </FormField>
            <FormField label="Expiry Date">
              <Input type="date" value={header.expiry_date} onChange={(e) => setHeader({ ...header, expiry_date: e.target.value })} />
            </FormField>
          </CardBody>
        </Card>

        <Card className="mb-4">
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="p-3 rounded-md border border-steel-200 space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 md:col-span-5">
                    <ProductPicker
                      value={line.product}
                      onChange={(p) => onProductSelect(line, p)}
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Input type="number" step="0.0001" placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: e.target.value })} />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Input type="number" step="0.0001" placeholder="Unit price"
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.id, { unit_price: e.target.value })} />
                  </div>
                  <div className="col-span-10 md:col-span-2 text-right font-semibold text-steel-900 pt-2">
                    {formatCurrency(Number(line.quantity || 0) * Number(line.unit_price || 0))}
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeLine(line.id)}
                      className="p-1.5 text-steel-500 hover:text-rose-600 hover:bg-rose-50 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Input
                  placeholder="Custom description (optional)"
                  value={line.custom_description}
                  onChange={(e) => updateLine(line.id, { custom_description: e.target.value })}
                />
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4" /> Add Line
            </Button>
          </CardBody>
        </Card>

        <Card className="mb-4">
          <CardHeader><CardTitle>Totals & Notes</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Freight Charge">
                <Input type="number" step="0.01" value={header.freight_charge}
                  onChange={(e) => setHeader({ ...header, freight_charge: e.target.value })} />
              </FormField>
              <FormField label="Sales Tax Rate" hint="e.g., 0.0825 for 8.25%">
                <Input type="number" step="0.0001" value={header.sales_tax_rate}
                  onChange={(e) => setHeader({ ...header, sales_tax_rate: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Notes (shown on PDF)">
              <Textarea value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
            </FormField>
            <FormField label="Internal Notes (not shown on PDF)">
              <Textarea value={header.internal_notes} onChange={(e) => setHeader({ ...header, internal_notes: e.target.value })} />
            </FormField>
            <div className="flex justify-end">
              <div className="w-full sm:w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-steel-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-steel-500">Freight</span><span>{formatCurrency(header.freight_charge)}</span></div>
                <div className="flex justify-between"><span className="text-steel-500">Tax ({(Number(header.sales_tax_rate) * 100).toFixed(3)}%)</span><span>{formatCurrency(taxAmount)}</span></div>
                <div className="flex justify-between border-t pt-1 font-semibold text-steel-900">
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/quotes')}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Update' : 'Create'} Quote</Button>
        </div>
      </form>
    </div>
  )
}
