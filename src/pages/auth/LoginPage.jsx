import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Enter email and password')
      return
    }
    setLoading(true)
    try {
      await signIn(email, password)
      const profile = useAuthStore.getState().profile
      if (profile?.must_change_password) {
        navigate('/change-password', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      toast.error(err.message ?? 'Sign in failed')
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
          <h1 className="mt-4 text-2xl font-bold text-white">360IMS</h1>
          <p className="text-steel-400 text-sm mt-1">360 Metal Roofing Supply</p>
        </div>
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-lg font-semibold text-steel-900 mb-4">Sign in</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Email" required>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@360metalroofingsupply.com"
              />
            </FormField>
            <FormField label="Password" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <Button type="submit" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/reset-password" className="text-sm text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
