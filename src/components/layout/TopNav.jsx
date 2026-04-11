import React, { useState, useRef, useEffect } from 'react'
import { Menu, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { formatStatus } from '@/lib/format'

export function TopNav({ onMenuClick }) {
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-steel-200 h-14 flex items-center gap-3 px-4 md:px-6">
      <button
        className="md:hidden p-1.5 rounded-md hover:bg-steel-100"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-steel-700" />
      </button>

      <div className="flex-1" />

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-steel-100"
        >
          <div className="h-8 w-8 rounded-full bg-brand-700 text-white flex items-center justify-center text-sm font-semibold">
            {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-steel-900">{profile?.full_name ?? 'User'}</span>
            <span className="text-xs text-steel-500">{formatStatus(profile?.role)}</span>
          </div>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 rounded-md border border-steel-200 bg-white shadow-lg py-1">
            <div className="px-4 py-2 border-b border-steel-100">
              <div className="text-sm font-medium text-steel-900 truncate">
                {profile?.full_name}
              </div>
              <div className="text-xs text-steel-500 truncate">{profile?.email}</div>
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/change-password') }}
              className="w-full text-left px-4 py-2 text-sm text-steel-700 hover:bg-steel-50 flex items-center gap-2"
            >
              <User className="h-4 w-4" /> Change Password
            </button>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
