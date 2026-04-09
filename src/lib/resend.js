// Client-side helper to send emails via the Supabase Edge Function.
// The function validates the user session and calls Resend server-side.
import { supabase } from './supabase'

export async function sendDocumentEmail({
  to,
  subject,
  html,
  fromName,
  attachmentBase64,
  attachmentFilename,
  documentType,
  documentId
}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to,
      subject,
      html,
      from_name: fromName,
      attachment_base64: attachmentBase64,
      attachment_filename: attachmentFilename,
      document_type: documentType,
      document_id: documentId
    })
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? 'Email send failed')
  return json
}

// Email body templates — branded, HTML
export function quoteEmailHtml({ quoteNumber, customerName, salespersonName, expiryDate, companyName }) {
  return `<!DOCTYPE html><html><body style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
    <div style="background: #1e3a5f; color: white; padding: 24px;">
      <h1 style="margin: 0; font-size: 22px;">${companyName}</h1>
    </div>
    <div style="padding: 24px;">
      <p>Hi ${customerName},</p>
      <p>Please find attached your quote <strong>${quoteNumber}</strong>.</p>
      ${expiryDate ? `<p>This quote is valid until <strong>${expiryDate}</strong>.</p>` : ''}
      <p>Let me know if you have any questions or would like to proceed.</p>
      <p>Thanks,<br/>${salespersonName}<br/>${companyName}</p>
    </div>
    <div style="padding: 16px 24px; background: #f1f5f9; font-size: 12px; color: #64748b; text-align: center;">
      ${companyName} — Austin, TX
    </div>
  </body></html>`
}

export function invoiceEmailHtml({ soNumber, customerName, salespersonName, companyName }) {
  return `<!DOCTYPE html><html><body style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
    <div style="background: #1e3a5f; color: white; padding: 24px;">
      <h1 style="margin: 0; font-size: 22px;">${companyName}</h1>
    </div>
    <div style="padding: 24px;">
      <p>Hi ${customerName},</p>
      <p>Please find attached invoice <strong>${soNumber}</strong>.</p>
      <p>Thank you for your business.</p>
      <p>Thanks,<br/>${salespersonName}<br/>${companyName}</p>
    </div>
    <div style="padding: 16px 24px; background: #f1f5f9; font-size: 12px; color: #64748b; text-align: center;">
      ${companyName} — Austin, TX
    </div>
  </body></html>`
}

export function purchaseOrderEmailHtml({ poNumber, supplierName, senderName, companyName }) {
  return `<!DOCTYPE html><html><body style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
    <div style="background: #1e3a5f; color: white; padding: 24px;">
      <h1 style="margin: 0; font-size: 22px;">${companyName}</h1>
    </div>
    <div style="padding: 24px;">
      <p>Hi ${supplierName},</p>
      <p>Please find attached Purchase Order <strong>${poNumber}</strong>.</p>
      <p>Please confirm receipt and provide expected ship date.</p>
      <p>Thanks,<br/>${senderName}<br/>${companyName}</p>
    </div>
    <div style="padding: 16px 24px; background: #f1f5f9; font-size: 12px; color: #64748b; text-align: center;">
      ${companyName} — Austin, TX
    </div>
  </body></html>`
}
