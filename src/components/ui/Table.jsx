import React from 'react'
import { cn } from '@/lib/cn'

export function Table({ className, children }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  )
}

export function THead({ children, className }) {
  return (
    <thead className={cn('bg-steel-50 border-b border-steel-200', className)}>{children}</thead>
  )
}

export function TH({ children, className, align = 'left' }) {
  return (
    <th
      className={cn(
        'px-4 py-3 font-medium text-steel-600 text-xs uppercase tracking-wide',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </th>
  )
}

export function TBody({ children, className }) {
  return <tbody className={cn('divide-y divide-steel-100', className)}>{children}</tbody>
}

export function TR({ children, className, onClick, clickable }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'bg-white',
        clickable && 'cursor-pointer hover:bg-steel-50',
        className
      )}
    >
      {children}
    </tr>
  )
}

export function TD({ children, className, align = 'left' }) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-steel-700',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </td>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-steel-100 h-16 w-16 flex items-center justify-center mb-4">
        <svg className="h-8 w-8 text-steel-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-steel-900">{title}</h3>
      {description && <p className="text-sm text-steel-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
