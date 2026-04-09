import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase, logActivity } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/Spinner'
import { ConfirmDelete } from '@/components/shared/ConfirmDelete'
import { usePermissions } from '@/hooks/usePermissions'
import toast from 'react-hot-toast'

export default function SuppliersPage() {
  const { can, isAdmin } = usePermissions()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('company_name')
    setRows(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    if (!query) return rows
    const q = query.toLowerCase()
    return rows.filter((r) =>
      (r.company_name ?? '').toLowerCase().includes(q) ||
      (r.contact_name ?? '').toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q)
    )
  }, [rows, query])

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', toDelete.id)
      if (error) throw error
      await logActivity('deleted', 'supplier', toDelete.id, toDelete.company_name)
      toast.success('Supplier deleted')
      setToDelete(null)
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Manage supplier records and purchase history."
        actions={
          can('suppliers_create') && (
            <Link to="/suppliers/new"><Button><Plus className="h-4 w-4" /> New Supplier</Button></Link>
          )
        }
      />

      <Card className="mb-4">
        <CardBody>
          <SearchBar value={query} onChange={setQuery} placeholder="Search suppliers..." />
        </CardBody>
      </Card>

      <Card>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState
            title="No suppliers yet"
            description="Add your first supplier to start creating purchase orders."
            action={can('suppliers_create') && (
              <Link to="/suppliers/new"><Button><Plus className="h-4 w-4" /> New Supplier</Button></Link>
            )}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Company</TH><TH>Contact</TH><TH>Email</TH><TH>Phone</TH><TH></TH>
              </tr>
            </THead>
            <TBody>
              {filtered.map((c) => (
                <TR key={c.id} clickable onClick={() => navigate(`/suppliers/${c.id}`)}>
                  <TD className="font-medium">{c.company_name}</TD>
                  <TD>{c.contact_name || '—'}</TD>
                  <TD>{c.email || '—'}</TD>
                  <TD>{c.phone || '—'}</TD>
                  <TD onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      {can('suppliers_edit') && (
                        <button onClick={() => navigate(`/suppliers/${c.id}/edit`)}
                          className="p-1.5 text-steel-500 hover:text-brand-700 hover:bg-brand-50 rounded">
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setToDelete(c)}
                          className="p-1.5 text-steel-500 hover:text-rose-600 hover:bg-rose-50 rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ConfirmDelete
        open={!!toDelete}
        itemName={toDelete?.company_name}
        itemType="supplier"
        loading={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
