import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'

export function ProductPicker({ value, onChange, placeholder = 'Search product...' }) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    setQuery(value?.name ?? '')
  }, [value?.id])

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    let cancel = false
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, sku, name, unit_of_measure, default_sales_price, default_cost, current_stock_quantity')
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(10)
      if (!cancel) setResults(data ?? [])
    }, 200)
    return () => { cancel = true; clearTimeout(t) }
  }, [query])

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-steel-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-steel-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onChange(r)
                setQuery(r.name)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 hover:bg-brand-50 border-b border-steel-100 last:border-0"
            >
              <div className="font-medium text-steel-900 text-sm">{r.name}</div>
              <div className="text-xs text-steel-500 flex justify-between">
                <span>{r.sku}</span>
                <span>Stock: {Number(r.current_stock_quantity).toFixed(2)} {r.unit_of_measure}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
