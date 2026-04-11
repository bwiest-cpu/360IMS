import React, { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export function EmailModal({
  open,
  onClose,
  defaultTo,
  defaultSubject,
  defaultBody,
  onSend,
  sending
}) {
  const [to, setTo] = useState(defaultTo ?? '')
  const [subject, setSubject] = useState(defaultSubject ?? '')
  const [body, setBody] = useState(defaultBody ?? '')

  React.useEffect(() => {
    if (open) {
      setTo(defaultTo ?? '')
      setSubject(defaultSubject ?? '')
      setBody(defaultBody ?? '')
    }
  }, [open, defaultTo, defaultSubject, defaultBody])

  async function submit() {
    if (!to) {
      toast.error('Recipient email required')
      return
    }
    try {
      await onSend({ to, subject, body })
      toast.success('Email sent')
      onClose()
    } catch (e) {
      toast.error(e.message ?? 'Failed to send')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Email"
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={sending}>
            Send Email
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="To" required>
          <Input value={to} onChange={(e) => setTo(e.target.value)} type="email" />
        </FormField>
        <FormField label="Subject" required>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </FormField>
        <FormField label="Message" hint="Plain text preview; PDF will be attached.">
          <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
