import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/change-password`
      })
      if (error) throw error
      setSent(true)
      toast.success('Password reset email sent')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-steel-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 rounded-xl bg-brand-700 text-white items-center justify-center font-bold text-2xl">
            360
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Reset Password</h1>
        </div>
        <div className="bg-white rounded-lg shadow-xl p-6">
          {sent ? (
            <div className="text-center">
              <p className="text-steel-700">
                Check your email for a password reset link.
              </p>
              <Link to="/login" className="inline-block mt-4 text-brand-700 hover:underline text-sm">
                Return to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </FormField>
              <Button type="submit" className="w-full" loading={loading}>
                Send Reset Link
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-brand-700 hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
