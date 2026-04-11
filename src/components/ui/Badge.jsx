import React from 'react'
import { cn } from '@/lib/cn'
import { statusColor, formatStatus } from '@/lib/format'

export function Badge({ children, className, variant }) {
  const cls = variant ? statusColor(variant) : 'bg-steel-100 text-steel-700'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        cls,
        className
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  return <Badge variant={status}>{formatStatus(status)}</Badge>
}
