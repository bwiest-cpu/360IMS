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

export default function CustomerFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [salespeople, setSalespeople] = useState([])
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '',
    address: '', city: '', state: 'TX', zip: '',
    notes: '', assigned_salesperson_id: '', is_active: true
  })

  useEffect(() => {
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')
      .then(({ data }) => setSalespeople(data ?? []))
    if (isEdit) loadRow()
  }, [id])

  async function loadRow() {
    setLoading(true)
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single()
    if (error) { toast.error(error.message); navigate('/customers'); return }
    setForm({
      company_name: data.company_name ?? '',
      contact_name: data.contact_name ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      address: data.address ?? '',
      city: data.city ?? '',
      state: data.state ?? 'TX',
      zip: data.zip ?? '',
      notes: data.notes ?? '',
      assigned_salesperson_id: data.assigned_salesperson_id ?? '',
      is_active: data.is_active
    })
    setLoading(false)
  }

  function u(key, value) { setForm((f) => ({ ...f, [key]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.contact_name) {
      toast.error('Contact name required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        company_name: form.company_name || null,
        contact_name: form.contact_name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        notes: form.notes || null,
        assigned_salesperson_id: form.assigned_salesperson_id || null,
        is_active: form.is_active
      }
      if (isEdit) {
        const { error } = await supabase.from('customers').update(payload).eq('id', id)
        if (error) throw error
        await logActivity('updated', 'customer', id, payload.company_name || payload.contact_name)
      } else {
        payload.created_by = profile?.id
        const { data, error } = await supabase.from('customers').insert(payload).select().single()
        if (error) throw error
        await logActivity('created', 'customer', data.id, payload.company_name || payload.contact_name)
      }
      toast.success(isEdit ? 'Customer updated' : 'Customer created')
      navigate('/customers')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="max-w-3xl">
      <PageHeader title={isEdit ? 'Edit Customer' : 'New Customer'} />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Company Name">
                <Input value={form.company_name} onChange={(e) => u('company_name', e.target.value)} />
              </FormField>
              <FormField label="Contact Name" required>
                <Input value={form.contact_name} onChange={(e) => u('contact_name', e.target.value)} />
              </FormField>
              <FormField label="Email">
                <Input type="email" value={form.email} onChange={(e) => u('email', e.target.value)} />
              </FormField>
              <FormField label="Phone">
                <Input value={form.phone} onChange={(e) => u('phone', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Address">
              <Input value={form.address} onChange={(e) => u('address', e.target.value)} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="City">
                <Input value={form.city} onChange={(e) => u('city', e.target.value)} />
              </FormField>
              <FormField label="State">
                <Input value={form.state} onChange={(e) => u('state', e.target.value)} maxLength={2} />
              </FormField>
              <FormField label="ZIP">
                <Input value={form.zip} onChange={(e) => u('zip', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Assigned Salesperson">
              <Select value={form.assigned_salesperson_id} onChange={(e) => u('assigned_salesperson_id', e.target.value)}>
                <option value="">— Unassigned —</option>
                {salespeople.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </Select>
            </FormField>
            <FormField label="Notes">
              <Textarea value={form.notes} onChange={(e) => u('notes', e.target.value)} />
            </FormField>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => u('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-steel-300 text-brand-700 focus:ring-brand-700" />
              <span className="text-sm text-steel-700">Active</span>
            </label>
          </CardBody>
        </Card>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/customers')}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Update' : 'Create'} Customer</Button>
        </div>
      </form>
    </div>
  )
}
