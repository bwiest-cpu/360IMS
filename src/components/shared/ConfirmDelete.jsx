import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AlertTriangle } from 'lucide-react'

export function ConfirmDelete({ open, onClose, onConfirm, itemName, itemType = 'record', loading }) {
  return (
    <Modal open={open} onClose={onClose} title={`Delete ${itemType}?`} size="sm">
      <div className="flex gap-4">
        <div className="rounded-full bg-rose-100 h-12 w-12 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <div>
          <p className="text-sm text-steel-700">
            Are you sure you want to delete{' '}
            <strong className="text-steel-900">{itemName || 'this record'}</strong>? This cannot
            be undone.
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          Delete
        </Button>
      </div>
    </Modal>
  )
}
