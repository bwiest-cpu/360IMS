import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '@/store/settings'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

export default function CompanySettingsTab() {
  const company = useSettingsStore((s) => s.company)
  const update = useSettingsStore((s) => s.update)
  const load = useSettingsStore((s) => s.load)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!company) load()
  }, [])

  useEffect(() => {
    if (company && !form) setForm(company)
  }, [company])

  if (!form) return <PageLoader />

  function u(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    try {
      await update({
        company_name: form.company_name,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        phone: form.phone,
        email: form.email,
        logo_url: form.logo_url,
        default_tax_rate: Number(form.default_tax_rate || 0),
        default_credit_card_fee_rate: Number(form.default_credit_card_fee_rate || 0),
        default_commission_rate: Number(form.default_commission_rate || 0)
      })
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <FormField label="Company Name"><Input value={form.company_name ?? ''} onChange={(e) => u('company_name', e.target.value)} /></FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Email"><Input type="email" value={form.email ?? ''} onChange={(e) => u('email', e.target.value)} /></FormField>
            <FormField label="Phone"><Input value={form.phone ?? ''} onChange={(e) => u('phone', e.target.value)} /></FormField>
          </div>
          <FormField label="Address"><Input value={form.address ?? ''} onChange={(e) => u('address', e.target.value)} /></FormField>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="City"><Input value={form.city ?? ''} onChange={(e) => u('city', e.target.value)} /></FormField>
            <FormField label="State"><Input value={form.state ?? ''} onChange={(e) => u('state', e.target.value)} /></FormField>
            <FormField label="ZIP"><Input value={form.zip ?? ''} onChange={(e) => u('zip', e.target.value)} /></FormField>
          </div>
          <FormField label="Logo URL" hint="Paste a public URL to your company logo">
            <Input value={form.logo_url ?? ''} onChange={(e) => u('logo_url', e.target.value)} />
          </FormField>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Defaults</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Sales Tax Rate" hint="0.0825 = 8.25%">
            <Input type="number" step="0.0001" value={form.default_tax_rate ?? ''} onChange={(e) => u('default_tax_rate', e.target.value)} />
          </FormField>
          <FormField label="Credit Card Fee Rate" hint="0.03 = 3%">
            <Input type="number" step="0.0001" value={form.default_credit_card_fee_rate ?? ''} onChange={(e) => u('default_credit_card_fee_rate', e.target.value)} />
          </FormField>
          <FormField label="Default Commission Rate" hint="0.10 = 10%">
            <Input type="number" step="0.0001" value={form.default_commission_rate ?? ''} onChange={(e) => u('default_commission_rate', e.target.value)} />
          </FormField>
        </CardBody>
      </Card>

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} loading={saving}>Save Settings</Button>
      </div>
    </div>
  )
}
