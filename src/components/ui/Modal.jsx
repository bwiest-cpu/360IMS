import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl'
  }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div
        className={cn(
          'relative w-full bg-white rounded-t-2xl sm:rounded-lg shadow-2xl max-h-[92vh] flex flex-col',
          sizeClass
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-steel-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-steel-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-steel-400 hover:text-steel-700 rounded-md p-1 hover:bg-steel-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-5 border-t border-steel-200 bg-steel-50 rounded-b-lg flex-shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
