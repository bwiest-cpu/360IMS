import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Select } from '@/components/ui/Input'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { Plus, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { DEFAULT_PERMISSIONS, PERMISSION_LABELS } from '@/lib/permissions'

export default function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('full_name')
    setUsers(data ?? [])
    setLoading(false)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" /> Invite User
        </Button>
      </div>

      <Card>
        {loading ? <PageLoader /> : users.length === 0 ? <EmptyState title="No users" /> : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Commission</TH><TH>Status</TH><TH></TH>
              </tr>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium">{u.full_name}</TD>
                  <TD>{u.email}</TD>
                  <TD><Badge className="bg-brand-50 text-brand-700 capitalize">{u.role}</Badge></TD>
                  <TD>{(Number(u.commission_rate) * 100).toFixed(2)}%</TD>
                  <TD>
                    {u.is_active
                      ? <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                      : <Badge className="bg-steel-100 text-steel-600">Inactive</Badge>}
                  </TD>
                  <TD>
                    <button onClick={() => setEditing(u)} className="p-1.5 text-steel-500 hover:text-brand-700 hover:bg-brand-50 rounded">
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <EditUserModal user={editing} open={!!editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSaved={() => { setInviteOpen(false); load() }} />
    </div>
  )
}

function EditUserModal({ user, open, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name,
        role: user.role,
        commission_rate: String(user.commission_rate ?? 0.1),
        is_active: user.is_active,
        permissions: user.permissions ?? DEFAULT_PERMISSIONS[user.role] ?? {}
      })
    }
  }, [user])

  if (!user || !form) return null

  function u(k, v) { setForm((f) => ({ ...f, [k]: v })) }
  function togglePerm(key) {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase.from('users').update({
        full_name: form.full_name,
        role: form.role,
        commission_rate: Number(form.commission_rate),
        is_active: form.is_active,
        permissions: form.permissions
      }).eq('id', user.id)
      if (error) throw error
      toast.success('User updated')
      onSaved()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${user.full_name}`} size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Full Name"><Input value={form.full_name} onChange={(e) => u('full_name', e.target.value)} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Role">
            <Select value={form.role} onChange={(e) => {
              const newRole = e.target.value
              u('role', newRole)
              u('permissions', DEFAULT_PERMISSIONS[newRole] ?? {})
            }}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="salesperson">Salesperson</option>
              <option value="viewer">Viewer</option>
            </Select>
          </FormField>
          <FormField label="Commission Rate" hint="0.10 = 10%">
            <Input type="number" step="0.0001" value={form.commission_rate} onChange={(e) => u('commission_rate', e.target.value)} />
          </FormField>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_active} onChange={(e) => u('is_active', e.target.checked)}
            className="h-4 w-4 rounded border-steel-300 text-brand-700 focus:ring-brand-700" />
          <span className="text-sm text-steel-700">Active</span>
        </label>

        <div>
          <div className="text-sm font-semibold text-steel-900 mb-2">Permission Overrides</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm border border-steel-200 rounded-md p-3 max-h-80 overflow-y-auto">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 py-1">
                <input type="checkbox" checked={!!form.permissions[key]}
                  onChange={() => togglePerm(key)}
                  className="h-4 w-4 rounded border-steel-300 text-brand-700 focus:ring-brand-700" />
                <span className="text-steel-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function InviteUserModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    email: '', full_name: '', role: 'salesperson', commission_rate: '0.10'
  })
  const [saving, setSaving] = useState(false)

  function u(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleInvite() {
    if (!form.email || !form.full_name) {
      toast.error('Email and name required')
      return
    }
    setSaving(true)
    try {
      // Supabase admin invite requires service role; fallback: use password reset flow
      const tempPassword = Math.random().toString(36).slice(2) + 'Aa1!'
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: tempPassword,
        options: { emailRedirectTo: `${window.location.origin}/change-password` }
      })
      if (error) throw error
      const userId = data.user?.id
      if (!userId) throw new Error('User creation failed')
      const { error: profileErr } = await supabase.from('users').insert({
        id: userId,
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        commission_rate: Number(form.commission_rate),
        is_active: true,
        must_change_password: true
      })
      if (profileErr) throw profileErr
      // Send password reset so user can set their own password
      await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/change-password`
      })
      toast.success('User invited — reset email sent')
      onSaved()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite User"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInvite} loading={saving}>Send Invite</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Email" required><Input type="email" value={form.email} onChange={(e) => u('email', e.target.value)} /></FormField>
        <FormField label="Full Name" required><Input value={form.full_name} onChange={(e) => u('full_name', e.target.value)} /></FormField>
        <FormField label="Role">
          <Select value={form.role} onChange={(e) => u('role', e.target.value)}>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="salesperson">Salesperson</option>
            <option value="viewer">Viewer</option>
          </Select>
        </FormField>
        <FormField label="Commission Rate">
          <Input type="number" step="0.0001" value={form.commission_rate} onChange={(e) => u('commission_rate', e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
