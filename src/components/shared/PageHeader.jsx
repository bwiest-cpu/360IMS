import React from 'react'
import { cn } from '@/lib/cn'

export function PageHeader({ title, description, actions, className }) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6',
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-bold text-steel-900">{title}</h1>
        {description && <p className="text-sm text-steel-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
