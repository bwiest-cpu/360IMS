// Supabase Edge Function: qbo-reconcile
// Returns fulfilled/invoiced sales orders within a date range for QBO reconciliation.
// Authenticated via Bearer <service_role_key> in Authorization header.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

interface RequestBody {
  start_date?: string
  end_date?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!token || token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — must provide service role key as Bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })

    let body: RequestBody = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    } else {
      const url = new URL(req.url)
      body = {
        start_date: url.searchParams.get('start_date') ?? undefined,
        end_date: url.searchParams.get('end_date') ?? undefined
      }
    }

    const { start_date, end_date } = body
    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters: start_date, end_date (YYYY-MM-DD)'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch sales orders with joined customer + salesperson
    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        id,
        so_number,
        invoice_date,
        fulfilled_date,
        order_date,
        status,
        payment_status,
        subtotal,
        freight_charge,
        sales_tax_amount,
        credit_card_fee_amount,
        total,
        customer:customers(company_name, contact_name, email),
        salesperson:users!sales_orders_salesperson_id_fkey(full_name, email)
      `)
      .in('status', ['fulfilled', 'invoiced'])
      .gte('invoice_date', start_date)
      .lte('invoice_date', end_date)
      .order('invoice_date', { ascending: true })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = (data ?? []).map((so: any) => ({
      so_number: so.so_number,
      customer_name: so.customer?.company_name || so.customer?.contact_name || '',
      customer_email: so.customer?.email ?? null,
      invoice_date: so.invoice_date,
      subtotal: Number(so.subtotal),
      freight_charge: Number(so.freight_charge),
      sales_tax_amount: Number(so.sales_tax_amount),
      credit_card_fee_amount: Number(so.credit_card_fee_amount),
      total: Number(so.total),
      payment_status: so.payment_status,
      status: so.status,
      salesperson_name: so.salesperson?.full_name ?? '',
      salesperson_email: so.salesperson?.email ?? ''
    }))

    return new Response(
      JSON.stringify({
        start_date,
        end_date,
        count: results.length,
        total_value: results.reduce((sum, r) => sum + r.total, 0),
        orders: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
