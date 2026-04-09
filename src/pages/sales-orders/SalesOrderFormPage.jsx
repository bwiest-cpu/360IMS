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
import toast from 'react-hot-toast'

function emptyLine() {
  return {
    id: crypto.randomUUID(),
    product: null,
    product_id: null,
    custom_description: '',
    quantity: '',
    unit_of_measure: 'each',
    unit_price: ''
  }
}

export default function SalesOrderFormPage() {
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
    order_date: new Date().toISOString().slice(0, 10),
    freight_charge: '0',
    sales_tax_rate: String(company?.default_tax_rate ?? 0.0825),
    credit_card_fee_rate: String(company?.default_credit_card_fee_rate ?? 0),
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
  }, [id])

  async function loadRow() {
    setLoading(true)
    const [soRes, itemsRes] = await Promise.all([
      supabase.from('sales_orders').select('*').eq('id', id).single(),
      supabase.from('sales_order_items').select('*, product:products(id, name, sku, unit_of_measure)')
        .eq('sales_order_id', id).order('sort_order').order('created_at')
    ])
    if (soRes.error) { toast.error(soRes.error.message); navigate('/sales-orders'); return }
    const s = soRes.data
    setHeader({
      customer_id: s.customer_id,
      salesperson_id: s.salesperson_id,
      order_date: s.order_date,
      freight_charge: String(s.freight_charge ?? 0),
      sales_tax_rate: String(s.sales_tax_rate ?? 0.0825),
      credit_card_fee_rate: String(s.credit_card_fee_rate ?? 0),
      notes: s.notes ?? '',
      internal_notes: s.internal_notes ?? ''
    })
    setLines((itemsRes.data ?? []).map((i) => ({
      id: i.id,
      product: i.product,
      product_id: i.product_id,
      custom_description: i.custom_description ?? '',
      quantity: String(i.quantity),
      unit_of_measure: i.unit_of_measure,
      unit_price: String(i.unit_price)
    })))
    setLoading(false)
  }

  function updateLine(lineId, patch) {
    setLines((ls) => ls.map((l) => l.id === lineId ? { ...l, ...patch } : l))
  }
  function addLine() { setLines((ls) => [...ls, emptyLine()]) }
  function removeLine(lineId) { setLines((ls) => ls.filter((l) => l.id !== lineId)) }

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0)
  const taxAmount = subtotal * Number(header.sales_tax_rate || 0)
  const preCc = subtotal + Number(header.freight_charge || 0) + taxAmount
  const ccFee = preCc * Number(header.credit_card_fee_rate || 0)
  const total = preCc + ccFee

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
        order_date: header.order_date,
        subtotal: Number(subtotal.toFixed(2)),
        freight_charge: Number(header.freight_charge || 0),
        sales_tax_rate: Number(header.sales_tax_rate || 0),
        sales_tax_amount: Number(taxAmount.toFixed(2)),
        credit_card_fee_rate: Number(header.credit_card_fee_rate || 0),
        credit_card_fee_amount: Number(ccFee.toFixed(2)),
        total: Number(total.toFixed(2)),
        notes: header.notes || null,
        internal_notes: header.internal_notes || null
      }

      let soId = id
      if (isEdit) {
        const { error } = await supabase.from('sales_orders').update(payload).eq('id', id)
        if (error) throw error
        await supabase.from('sales_order_items').delete().eq('sales_order_id', id)
      } else {
        payload.created_by = profile?.id
        const { data, error } = await supabase.from('sales_orders').insert(payload).select().single()
        if (error) throw error
        soId = data.id
      }

      const itemsPayload = validLines.map((l, idx) => ({
        sales_order_id: soId,
        product_id: l.product_id || null,
        custom_description: l.custom_description || null,
        quantity: Number(l.quantity),
        unit_of_measure: l.unit_of_measure,
        unit_price: Number(l.unit_price || 0),
        fifo_cost: 0,
        sort_order: idx
      }))
      const { error } = await supabase.from('sales_order_items').insert(itemsPayload)
      if (error) throw error

      await logActivity(isEdit ? 'updated' : 'created', 'sales_order', soId, 'Sales Order')
      toast.success(isEdit ? 'Sales order updated' : 'Sales order created')
      navigate(`/sales-orders/${soId}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Sales Order' : 'New Sales Order'} />
      <form onSubmit={handleSubmit}>
        <Card className="mb-4">
          <CardHeader><CardTitle>Order Header</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <FormField label="Order Date" required>
              <Input type="date" value={header.order_date} onChange={(e) => setHeader({ ...header, order_date: e.target.value })} />
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
                      onChange={(p) => updateLine(line.id, {
                        product: p, product_id: p.id,
                        unit_of_measure: p.unit_of_measure,
                        unit_price: line.unit_price || String(p.default_sales_price ?? 0)
                      })}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Freight Charge">
                <Input type="number" step="0.01" value={header.freight_charge}
                  onChange={(e) => setHeader({ ...header, freight_charge: e.target.value })} />
              </FormField>
              <FormField label="Sales Tax Rate" hint="e.g., 0.0825">
                <Input type="number" step="0.0001" value={header.sales_tax_rate}
                  onChange={(e) => setHeader({ ...header, sales_tax_rate: e.target.value })} />
              </FormField>
              <FormField label="Credit Card Fee Rate" hint="e.g., 0.03 for 3%">
                <Input type="number" step="0.0001" value={header.credit_card_fee_rate}
                  onChange={(e) => setHeader({ ...header, credit_card_fee_rate: e.target.value })} />
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
                <div className="flex justify-between"><span className="text-steel-500">Tax</span><span>{formatCurrency(taxAmount)}</span></div>
                <div className="flex justify-between"><span className="text-steel-500">CC Fee</span><span>{formatCurrency(ccFee)}</span></div>
                <div className="flex justify-between border-t pt-1 font-semibold text-steel-900">
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/sales-orders')}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Update' : 'Create'} Sales Order</Button>
        </div>
      </form>
    </div>
  )
}
