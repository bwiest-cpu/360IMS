import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2, Plus } from 'lucide-react'
import { supabase, logActivity } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
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
    quantity_ordered: '',
    unit_cost: '',
    _new: true
  }
}

export default function PurchaseOrderFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [po, setPo] = useState({
    supplier_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    freight_cost: '0',
    notes: ''
  })
  const [lines, setLines] = useState([emptyLine()])

  useEffect(() => {
    supabase.from('suppliers').select('id, company_name').eq('is_active', true).order('company_name')
      .then(({ data }) => setSuppliers(data ?? []))
    if (isEdit) loadPo()
  }, [id])

  async function loadPo() {
    setLoading(true)
    const [poRes, itemsRes] = await Promise.all([
      supabase.from('purchase_orders').select('*').eq('id', id).single(),
      supabase.from('purchase_order_items').select('*, product:products(id, name, sku, unit_of_measure)').eq('purchase_order_id', id)
    ])
    if (poRes.error) { toast.error(poRes.error.message); navigate('/purchase-orders'); return }
    setPo({
      supplier_id: poRes.data.supplier_id,
      order_date: poRes.data.order_date,
      expected_date: poRes.data.expected_date ?? '',
      freight_cost: String(poRes.data.freight_cost ?? 0),
      notes: poRes.data.notes ?? ''
    })
    setLines((itemsRes.data ?? []).map((i) => ({
      id: i.id,
      product: i.product,
      product_id: i.product_id,
      quantity_ordered: String(i.quantity_ordered),
      unit_cost: String(i.unit_cost),
      _new: false
    })))
    setLoading(false)
  }

  function updateLine(lineId, patch) {
    setLines((ls) => ls.map((l) => l.id === lineId ? { ...l, ...patch } : l))
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine()])
  }

  function removeLine(lineId) {
    setLines((ls) => ls.filter((l) => l.id !== lineId))
  }

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity_ordered || 0) * Number(l.unit_cost || 0), 0)
  const total = subtotal + Number(po.freight_cost || 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!po.supplier_id) { toast.error('Select a supplier'); return }
    if (lines.length === 0 || !lines[0].product_id) { toast.error('Add at least one line'); return }

    setSaving(true)
    try {
      const poPayload = {
        supplier_id: po.supplier_id,
        order_date: po.order_date,
        expected_date: po.expected_date || null,
        freight_cost: Number(po.freight_cost || 0),
        subtotal: Number(subtotal.toFixed(2)),
        total: Number(total.toFixed(2)),
        notes: po.notes || null
      }

      let poId = id
      if (isEdit) {
        const { error } = await supabase.from('purchase_orders').update(poPayload).eq('id', id)
        if (error) throw error
        // Delete existing items, re-insert (safe for draft POs)
        await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id)
      } else {
        poPayload.created_by = profile?.id
        const { data, error } = await supabase.from('purchase_orders').insert(poPayload).select().single()
        if (error) throw error
        poId = data.id
      }

      const itemsPayload = lines
        .filter((l) => l.product_id && Number(l.quantity_ordered) > 0)
        .map((l) => ({
          purchase_order_id: poId,
          product_id: l.product_id,
          quantity_ordered: Number(l.quantity_ordered),
          unit_cost: Number(l.unit_cost),
          quantity_received: 0
        }))

      if (itemsPayload.length > 0) {
        const { error } = await supabase.from('purchase_order_items').insert(itemsPayload)
        if (error) throw error
      }

      await logActivity(isEdit ? 'updated' : 'created', 'purchase_order', poId, `PO`)
      toast.success(isEdit ? 'PO updated' : 'PO created')
      navigate(`/purchase-orders/${poId}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Purchase Order' : 'New Purchase Order'} />
      <form onSubmit={handleSubmit}>
        <Card className="mb-4">
          <CardHeader><CardTitle>PO Header</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Supplier" required>
              <Select value={po.supplier_id} onChange={(e) => setPo({ ...po, supplier_id: e.target.value })}>
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </Select>
            </FormField>
            <FormField label="Order Date" required>
              <Input type="date" value={po.order_date} onChange={(e) => setPo({ ...po, order_date: e.target.value })} />
            </FormField>
            <FormField label="Expected Date">
              <Input type="date" value={po.expected_date} onChange={(e) => setPo({ ...po, expected_date: e.target.value })} />
            </FormField>
          </CardBody>
        </Card>

        <Card className="mb-4">
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-start p-3 rounded-md border border-steel-200">
                <div className="col-span-12 md:col-span-5">
                  <ProductPicker
                    value={line.product}
                    onChange={(p) => updateLine(line.id, {
                      product: p,
                      product_id: p.id,
                      unit_cost: line.unit_cost || String(p.default_cost ?? 0)
                    })}
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <Input type="number" step="0.0001" placeholder="Qty"
                    value={line.quantity_ordered}
                    onChange={(e) => updateLine(line.id, { quantity_ordered: e.target.value })} />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <Input type="number" step="0.0001" placeholder="Unit cost"
                    value={line.unit_cost}
                    onChange={(e) => updateLine(line.id, { unit_cost: e.target.value })} />
                </div>
                <div className="col-span-10 md:col-span-2 text-right font-semibold text-steel-900 pt-2">
                  {formatCurrency(Number(line.quantity_ordered || 0) * Number(line.unit_cost || 0))}
                </div>
                <div className="col-span-2 md:col-span-1 flex justify-end pt-1">
                  <button type="button" onClick={() => removeLine(line.id)}
                    className="p-1.5 text-steel-500 hover:text-rose-600 hover:bg-rose-50 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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
            <FormField label="Freight Cost">
              <Input type="number" step="0.01"
                value={po.freight_cost}
                onChange={(e) => setPo({ ...po, freight_cost: e.target.value })} />
            </FormField>
            <FormField label="Notes">
              <Textarea value={po.notes} onChange={(e) => setPo({ ...po, notes: e.target.value })} />
            </FormField>
            <div className="flex justify-end">
              <div className="w-full sm:w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-steel-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-steel-500">Freight</span><span>{formatCurrency(po.freight_cost)}</span></div>
                <div className="flex justify-between border-t pt-1 font-semibold text-steel-900">
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/purchase-orders')}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Update' : 'Create'} PO</Button>
        </div>
      </form>
    </div>
  )
}
