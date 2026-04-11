import React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'

export function SearchBar({ value, onChange, placeholder = 'Search...', className }) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-steel-400 pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  )
}
