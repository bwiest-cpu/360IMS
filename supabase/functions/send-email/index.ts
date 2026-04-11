// Supabase Edge Function: send-email
// Sends branded emails via Resend API and logs to email_logs.
// Called from the frontend with user's JWT; validates user is authenticated.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

interface SendEmailRequest {
  to: string
  subject: string
  html: string
  from_name?: string
  attachment_base64?: string
  attachment_filename?: string
  document_type: 'quote' | 'sales_order' | 'purchase_order'
  document_id: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization') ?? ''
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const fromAddress = Deno.env.get('RESEND_FROM_ADDRESS') ?? 'orders@360metalroofingsupply.com'

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    })
    const { data: userData } = await userClient.auth.getUser()
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const userId = userData.user.id

    const body: SendEmailRequest = await req.json()
    const {
      to,
      subject,
      html,
      from_name,
      attachment_base64,
      attachment_filename,
      document_type,
      document_id
    } = body

    if (!to || !subject || !html || !document_type || !document_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const displayName = from_name ? `${from_name} | 360 Metal Roofing Supply` : '360 Metal Roofing Supply'

    const payload: Record<string, unknown> = {
      from: `${displayName} <${fromAddress}>`,
      to: [to],
      subject,
      html
    }
    if (attachment_base64 && attachment_filename) {
      payload.attachments = [{ filename: attachment_filename, content: attachment_base64 }]
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    const resendJson = await resendResp.json()

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })

    if (!resendResp.ok) {
      await adminClient.from('email_logs').insert({
        document_type,
        document_id,
        sent_by: userId,
        sent_to: to,
        subject,
        status: 'failed',
        error_message: resendJson?.message ?? 'Unknown Resend error'
      })
      return new Response(
        JSON.stringify({ error: resendJson?.message ?? 'Email send failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await adminClient.from('email_logs').insert({
      document_type,
      document_id,
      sent_by: userId,
      sent_to: to,
      subject,
      resend_message_id: resendJson?.id ?? null,
      status: 'sent'
    })

    return new Response(
      JSON.stringify({ ok: true, id: resendJson?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
