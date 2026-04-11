import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Select } from '@/components/ui/Input'
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/Table'
import { parseCsv } from '@/lib/csv'
import toast from 'react-hot-toast'

const FIELDS = [
  { key: 'sku', label: 'SKU*' },
  { key: 'name', label: 'Name*' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'unit_of_measure', label: 'Unit of Measure*' },
  { key: 'default_sales_price', label: 'Sales Price' },
  { key: 'default_cost', label: 'Default Cost' },
  { key: 'reorder_point', label: 'Reorder Point' }
]

export default function ProductImportPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [importing, setImporting] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = await parseCsv(file)
      if (parsed.length === 0) {
        toast.error('CSV is empty')
        return
      }
      const hdrs = Object.keys(parsed[0])
      setHeaders(hdrs)
      setRows(parsed)
      // Auto-guess mapping by header name
      const auto = {}
      for (const field of FIELDS) {
        const match = hdrs.find((h) => h.toLowerCase().replace(/[_\s]/g, '') ===
          field.key.replace(/_/g, ''))
        if (match) auto[field.key] = match
      }
      setMapping(auto)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleImport() {
    if (!mapping.sku || !mapping.name || !mapping.unit_of_measure) {
      toast.error('Map SKU, Name, and Unit of Measure columns')
      return
    }
    setImporting(true)
    try {
      const payloads = rows.map((r) => {
        const p = { created_by: profile?.id, is_active: true }
        for (const field of FIELDS) {
          const col = mapping[field.key]
          if (!col) continue
          const val = r[col]
          if (['default_sales_price', 'default_cost', 'reorder_point'].includes(field.key)) {
            p[field.key] = Number(val || 0)
          } else {
            p[field.key] = val || null
          }
        }
        return p
      })

      const { error } = await supabase.from('products').upsert(payloads, { onConflict: 'sku' })
      if (error) throw error
      toast.success(`Imported ${payloads.length} products`)
      navigate('/products')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Import Products" description="Upload a CSV and map columns to product fields." />

      <Card className="mb-4">
        <CardHeader><CardTitle>Step 1: Upload CSV</CardTitle></CardHeader>
        <CardBody>
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm text-steel-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-700 file:text-white hover:file:bg-brand-800"
          />
          <p className="text-xs text-steel-500 mt-2">
            Expected columns: sku, name, description, category, unit_of_measure, default_sales_price, default_cost, reorder_point
          </p>
        </CardBody>
      </Card>

      {headers.length > 0 && (
        <>
          <Card className="mb-4">
            <CardHeader><CardTitle>Step 2: Map Columns</CardTitle></CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FIELDS.map((field) => (
                  <FormField key={field.key} label={field.label}>
                    <Select
                      value={mapping[field.key] ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                    >
                      <option value="">— Skip —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </FormField>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle>Step 3: Preview ({rows.length} rows)</CardTitle></CardHeader>
            <CardBody className="p-0">
              <Table>
                <THead>
                  <tr>
                    {FIELDS.map((f) => <TH key={f.key}>{f.label}</TH>)}
                  </tr>
                </THead>
                <TBody>
                  {rows.slice(0, 10).map((r, i) => (
                    <TR key={i}>
                      {FIELDS.map((f) => <TD key={f.key}>{r[mapping[f.key]] ?? '—'}</TD>)}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/products')}>Cancel</Button>
            <Button onClick={handleImport} loading={importing}>
              <Upload className="h-4 w-4" /> Import {rows.length} Products
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
