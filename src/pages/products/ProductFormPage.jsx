import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, logActivity } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea, Select } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { CATEGORIES, UNITS } from './constants'

export default function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    category: 'Coil',
    unit_of_measure: 'each',
    default_sales_price: '',
    default_cost: '',
    reorder_point: '',
    notes: '',
    is_active: true
  })

  useEffect(() => {
    if (isEdit) load()
  }, [id])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
    if (error) { toast.error(error.message); navigate('/products'); return }
    setForm({
      sku: data.sku ?? '',
      name: data.name ?? '',
      description: data.description ?? '',
      category: data.category ?? 'Coil',
      unit_of_measure: data.unit_of_measure ?? 'each',
      default_sales_price: String(data.default_sales_price ?? ''),
      default_cost: String(data.default_cost ?? ''),
      reorder_point: String(data.reorder_point ?? ''),
      notes: data.notes ?? '',
      is_active: data.is_active
    })
    setLoading(false)
  }

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.sku || !form.name) {
      toast.error('SKU and Name required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description || null,
        category: form.category || null,
        unit_of_measure: form.unit_of_measure,
        default_sales_price: Number(form.default_sales_price || 0),
        default_cost: Number(form.default_cost || 0),
        reorder_point: Number(form.reorder_point || 0),
        notes: form.notes || null,
        is_active: form.is_active
      }

      if (isEdit) {
        const { error } = await supabase.from('products').update(payload).eq('id', id)
        if (error) throw error
        await logActivity('updated', 'product', id, payload.name)
      } else {
        payload.created_by = profile?.id
        const { data, error } = await supabase.from('products').insert(payload).select().single()
        if (error) throw error
        await logActivity('created', 'product', data.id, payload.name)
      }
      toast.success(isEdit ? 'Product updated' : 'Product created')
      navigate('/products')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="max-w-3xl">
      <PageHeader title={isEdit ? 'Edit Product' : 'New Product'} />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="SKU" required>
                <Input value={form.sku} onChange={(e) => update('sku', e.target.value)} />
              </FormField>
              <FormField label="Name" required>
                <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Description">
              <Textarea value={form.description} onChange={(e) => update('description', e.target.value)} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Category">
                <Select value={form.category} onChange={(e) => update('category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
              <FormField label="Unit of Measure" required>
                <Select value={form.unit_of_measure} onChange={(e) => update('unit_of_measure', e.target.value)}>
                  {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Default Sales Price">
                <Input type="number" step="0.0001" value={form.default_sales_price}
                  onChange={(e) => update('default_sales_price', e.target.value)} />
              </FormField>
              <FormField label="Default Cost">
                <Input type="number" step="0.0001" value={form.default_cost}
                  onChange={(e) => update('default_cost', e.target.value)} />
              </FormField>
              <FormField label="Reorder Point">
                <Input type="number" step="0.0001" value={form.reorder_point}
                  onChange={(e) => update('reorder_point', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Notes">
              <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} />
            </FormField>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => update('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-steel-300 text-brand-700 focus:ring-brand-700"
              />
              <span className="text-sm text-steel-700">Active</span>
            </label>
          </CardBody>
        </Card>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Update' : 'Create'} Product</Button>
        </div>
      </form>
    </div>
  )
}
