import React from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'

export default function IntegrationsTab() {
  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader><CardTitle>Resend Email</CardTitle></CardHeader>
        <CardBody className="text-sm text-steel-700 space-y-2">
          <p>
            Outbound email is sent via Resend from{' '}
            <code className="bg-steel-100 px-1 rounded">orders@360metalroofingsupply.com</code>.
            The API key is configured as a Supabase Edge Function secret:
          </p>
          <pre className="bg-steel-900 text-steel-100 p-3 rounded text-xs overflow-x-auto">
{`supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set RESEND_FROM_ADDRESS=orders@360metalroofingsupply.com`}
          </pre>
          <p className="text-xs text-steel-500">
            DNS: Add the SPF and DKIM TXT records from resend.com to your GoDaddy DNS for
            360metalroofingsupply.com. See README for exact records.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>QuickBooks Online Reconciliation</CardTitle></CardHeader>
        <CardBody className="text-sm text-steel-700 space-y-2">
          <p>
            QBO reconciliation is exposed as a Supabase Edge Function at{' '}
            <code className="bg-steel-100 px-1 rounded">/functions/v1/qbo-reconcile</code>.
            Pass your service role key as a Bearer token.
          </p>
          <pre className="bg-steel-900 text-steel-100 p-3 rounded text-xs overflow-x-auto">
{`curl -X POST \\
  "$SUPABASE_URL/functions/v1/qbo-reconcile" \\
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"start_date":"2026-04-01","end_date":"2026-04-30"}'`}
          </pre>
        </CardBody>
      </Card>
    </div>
  )
}
