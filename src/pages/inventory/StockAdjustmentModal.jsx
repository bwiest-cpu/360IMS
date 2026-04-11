import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea, Select } from '@/components/ui/Input'
import { applyStockAdjustment } from '@/lib/fifo'
import { useAuthStore } from '@/store/auth'
import { logActivity } from '@/lib/supabase'
import toast from 'react-hot-toast'

const REASONS = [
  { value: 'correction', label: 'Correction' },
  { value: 'damage', label: 'Damage' },
  { value: 'shrinkage', label: 'Shrinkage' },
  { value: 'opening_balance', label: 'Opening Balance' },
  { value: 'other', label: 'Other' }
]

export function StockAdjustmentModal({ product, open, onClose, onSaved }) {
  const profile = useAuthStore((s) => s.profile)
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('correction')
  const [unitCost, setUnitCost] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && product) {
      setDelta('')
      setReason('correction')
      setUnitCost(String(product.default_cost ?? ''))
      setNotes('')
    }
  }, [open, product])

  async function handleSave() {
    const num = Number(delta)
    if (!num) {
      toast.error('Enter a non-zero quantity')
      return
    }
    setSaving(true)
    try {
      await applyStockAdjustment({
        productId: product.id,
        quantityDelta: num,
        reason,
        unitCost: num > 0 ? Number(unitCost || 0) : null,
        notes: notes || null,
        userId: profile?.id ?? null
      })
      await logActivity(
        num > 0 ? 'added stock' : 'reduced stock',
        'product',
        product.id,
        product.name,
        { delta: num, reason }
      )
      toast.success('Stock adjusted')
      onSaved?.()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!product) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Adjust Stock — ${product.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Adjustment</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-steel-600">
          Current stock: <strong className="text-steel-900">
            {Number(product.current_stock_quantity).toFixed(2)} {product.unit_of_measure}
          </strong>
        </div>
        <FormField label="Quantity change" required hint="Use negative values to reduce stock">
          <Input type="number" step="0.0001" value={delta} onChange={(e) => setDelta(e.target.value)} />
        </FormField>
        <FormField label="Reason" required>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </FormField>
        {Number(delta) > 0 && (
          <FormField label="Unit cost for new lot" hint="Only used when adding stock">
            <Input type="number" step="0.0001" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </FormField>
        )}
        <FormField label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
