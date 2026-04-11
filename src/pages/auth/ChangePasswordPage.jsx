import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Input'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/shared/PageHeader'
import toast from 'react-hot-toast'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      if (profile?.must_change_password) {
        await supabase.from('users').update({ must_change_password: false }).eq('id', profile.id)
        await refreshProfile()
      }

      toast.success('Password updated')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="Change Password" description="Set a new password for your account." />
      <Card>
        <CardHeader>
          <CardTitle>Update password</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="New password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Confirm new password" required>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" loading={loading}>
                Update Password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
