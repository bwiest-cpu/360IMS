import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Download, Upload, Edit2, Trash2 } from 'lucide-react'
import { supabase, logActivity } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Select } from '@/components/ui/Input'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { ConfirmDelete } from '@/components/shared/ConfirmDelete'
import { formatCurrency, formatNumber } from '@/lib/format'
import { exportToCsv } from '@/lib/csv'
import { usePermissions } from '@/hooks/usePermissions'
import toast from 'react-hot-toast'
import { CATEGORIES, UNITS } from './constants'

export default function ProductsPage() {
  const { can, isAdmin } = usePermissions()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [activeFilter, setActiveFilter] = useState('active')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })
    if (error) toast.error(error.message)
    setProducts(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (query) {
        const q = query.toLowerCase()
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.sku.toLowerCase().includes(q) &&
          !(p.category ?? '').toLowerCase().includes(q)
        ) return false
      }
      if (category && p.category !== category) return false
      if (activeFilter === 'active' && !p.is_active) return false
      if (activeFilter === 'inactive' && p.is_active) return false
      if (lowStockOnly && Number(p.current_stock_quantity) > Number(p.reorder_point)) return false
      return true
    })
  }, [products, query, category, activeFilter, lowStockOnly])

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('products').delete().eq('id', toDelete.id)
      if (error) throw error
      await logActivity('deleted', 'product', toDelete.id, toDelete.name)
      toast.success('Product deleted')
      setToDelete(null)
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  function handleExport() {
    exportToCsv('products.csv', filtered, [
      { header: 'SKU', accessor: 'sku' },
      { header: 'Name', accessor: 'name' },
      { header: 'Description', accessor: 'description' },
      { header: 'Category', accessor: 'category' },
      { header: 'UOM', accessor: 'unit_of_measure' },
      { header: 'Sales Price', accessor: 'default_sales_price' },
      { header: 'Default Cost', accessor: 'default_cost' },
      { header: 'Stock', accessor: 'current_stock_quantity' },
      { header: 'Reorder Point', accessor: 'reorder_point' },
      { header: 'Active', accessor: (r) => (r.is_active ? 'Y' : 'N') }
    ])
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your product catalog."
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {can('products_manage') && (
              <Button variant="outline" onClick={() => navigate('/products/import')}>
                <Upload className="h-4 w-4" /> Import
              </Button>
            )}
            {can('products_manage') && (
              <Link to="/products/new">
                <Button><Plus className="h-4 w-4" /> New Product</Button>
              </Link>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col sm:flex-row gap-3">
          <SearchBar value={query} onChange={setQuery} placeholder="Search SKU, name, category..." className="flex-1" />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-40">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="sm:w-36">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </Select>
          <Button variant={lowStockOnly ? 'primary' : 'outline'} onClick={() => setLowStockOnly((v) => !v)}>
            Low Stock
          </Button>
        </CardBody>
      </Card>

      <Card>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState
            title="No products"
            description="Create a product to start tracking inventory."
            action={can('products_manage') && (
              <Link to="/products/new"><Button><Plus className="h-4 w-4" /> New Product</Button></Link>
            )}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>SKU</TH>
                <TH>Name</TH>
                <TH>Category</TH>
                <TH align="right">Stock</TH>
                <TH align="right">Price</TH>
                <TH>Status</TH>
                <TH></TH>
              </tr>
            </THead>
            <TBody>
              {filtered.map((p) => {
                const low = Number(p.current_stock_quantity) <= Number(p.reorder_point)
                return (
                  <TR key={p.id} clickable onClick={() => navigate(`/products/${p.id}`)}>
                    <TD className="font-mono text-xs">{p.sku}</TD>
                    <TD className="font-medium">{p.name}</TD>
                    <TD>{p.category ?? '—'}</TD>
                    <TD align="right">
                      <span className={low ? 'text-rose-600 font-semibold' : ''}>
                        {formatNumber(p.current_stock_quantity)}
                      </span>{' '}
                      <span className="text-xs text-steel-400">{p.unit_of_measure}</span>
                    </TD>
                    <TD align="right">{formatCurrency(p.default_sales_price)}</TD>
                    <TD>
                      {p.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                      ) : (
                        <Badge className="bg-steel-100 text-steel-600">Inactive</Badge>
                      )}
                    </TD>
                    <TD onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {can('products_manage') && (
                          <button
                            onClick={() => navigate(`/products/${p.id}/edit`)}
                            className="p-1.5 text-steel-500 hover:text-brand-700 hover:bg-brand-50 rounded"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setToDelete(p)}
                            className="p-1.5 text-steel-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <ConfirmDelete
        open={!!toDelete}
        itemName={toDelete?.name}
        itemType="product"
        loading={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
