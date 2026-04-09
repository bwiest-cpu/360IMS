import { format, parseISO, formatDistanceToNow } from 'date-fns'

export function formatCurrency(value, opts = {}) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.decimals ?? 2,
    maximumFractionDigits: opts.decimals ?? 2
  }).format(n)
}

export function formatNumber(value, decimals = 2) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(n)
}

export function formatPercent(value, decimals = 2) {
  const n = Number(value ?? 0) * 100
  return `${n.toFixed(decimals)}%`
}

export function formatDate(value) {
  if (!value) return ''
  try {
    const d = typeof value === 'string' ? parseISO(value) : value
    return format(d, 'MMM d, yyyy')
  } catch {
    return String(value)
  }
}

export function formatDateTime(value) {
  if (!value) return ''
  try {
    const d = typeof value === 'string' ? parseISO(value) : value
    return format(d, 'MMM d, yyyy h:mm a')
  } catch {
    return String(value)
  }
}

export function formatDateInput(value) {
  if (!value) return ''
  try {
    const d = typeof value === 'string' ? parseISO(value) : value
    return format(d, 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

export function formatRelative(value) {
  if (!value) return ''
  try {
    const d = typeof value === 'string' ? parseISO(value) : value
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return ''
  }
}

export function statusColor(status) {
  const map = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-800',
    accepted: 'bg-emerald-100 text-emerald-800',
    declined: 'bg-rose-100 text-rose-800',
    expired: 'bg-amber-100 text-amber-800',
    converted: 'bg-violet-100 text-violet-800',
    confirmed: 'bg-blue-100 text-blue-800',
    invoiced: 'bg-indigo-100 text-indigo-800',
    fulfilled: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-rose-100 text-rose-800',
    partially_received: 'bg-amber-100 text-amber-800',
    received: 'bg-emerald-100 text-emerald-800',
    unpaid: 'bg-rose-100 text-rose-800',
    partial: 'bg-amber-100 text-amber-800',
    paid: 'bg-emerald-100 text-emerald-800'
  }
  return map[status] ?? 'bg-slate-100 text-slate-700'
}

export function formatStatus(status) {
  if (!status) return ''
  return String(status)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
