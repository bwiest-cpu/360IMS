import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { formatDateTime } from '@/lib/format'

export default function EmailLogsTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('email_logs')
      .select('*, sender:users!email_logs_sent_by_fkey(full_name)')
      .order('sent_at', { ascending: false })
      .limit(200)
    setLogs(data ?? [])
    setLoading(false)
  }

  return (
    <Card>
      {loading ? <PageLoader /> : logs.length === 0 ? (
        <EmptyState title="No emails sent yet" description="Email activity will appear here." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Sent</TH>
              <TH>Type</TH>
              <TH>To</TH>
              <TH>Subject</TH>
              <TH>Sent By</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {logs.map((l) => (
              <TR key={l.id}>
                <TD>{formatDateTime(l.sent_at)}</TD>
                <TD className="capitalize">{l.document_type.replace('_', ' ')}</TD>
                <TD>{l.sent_to}</TD>
                <TD className="max-w-xs truncate">{l.subject}</TD>
                <TD>{l.sender?.full_name ?? '—'}</TD>
                <TD>
                  {l.status === 'sent'
                    ? <Badge className="bg-emerald-100 text-emerald-800">Sent</Badge>
                    : <Badge className="bg-rose-100 text-rose-800">Failed</Badge>}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  )
}
