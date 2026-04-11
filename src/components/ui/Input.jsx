import React from 'react'
import { cn } from '@/lib/cn'

export const Input = React.forwardRef(function Input({ className, error, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'block w-full rounded-md border border-steel-300 bg-white px-3 py-2 text-sm text-steel-900 placeholder:text-steel-400 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 disabled:bg-steel-50 disabled:text-steel-500',
        error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
        className
      )}
      {...props}
    />
  )
})

export const Textarea = React.forwardRef(function Textarea({ className, error, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'block w-full rounded-md border border-steel-300 bg-white px-3 py-2 text-sm text-steel-900 placeholder:text-steel-400 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700',
        error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
        className
      )}
      {...props}
    />
  )
})

export const Select = React.forwardRef(function Select({ className, error, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'block w-full rounded-md border border-steel-300 bg-white px-3 py-2 text-sm text-steel-900 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700',
        error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
})

export function Label({ htmlFor, children, required, className }) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-sm font-medium text-steel-700 mb-1', className)}>
      {children}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  )
}

export function FormField({ label, required, error, children, hint }) {
  return (
    <div className="space-y-1">
      {label && <Label required={required}>{label}</Label>}
      {children}
      {hint && !error && <p className="text-xs text-steel-500">{hint}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
