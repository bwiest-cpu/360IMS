import React from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-steel-200 bg-white shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('px-5 pt-5 pb-3 border-b border-steel-100', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3 className={cn('text-base font-semibold text-steel-900', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p className={cn('text-sm text-steel-500 mt-0.5', className)} {...props}>
      {children}
    </p>
  )
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div
      className={cn('px-5 py-3 border-t border-steel-100 bg-steel-50/50 rounded-b-lg', className)}
      {...props}
    >
      {children}
    </div>
  )
}
