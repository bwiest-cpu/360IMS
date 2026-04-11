import { supabase } from './supabase'

// Create a commission record for a sales order (only when marked paid).
// Calls the server-side function which handles COGS calculation and de-duping.
export async function createCommissionForSalesOrder(salesOrderId) {
  const { data, error } = await supabase.rpc('create_commission_for_so', {
    p_sales_order_id: salesOrderId
  })
  if (error) throw error
  return data
}

// Returns the commission period for a given payment date: first of next month.
export function commissionPeriodFor(paymentDate) {
  const d = paymentDate ? new Date(paymentDate) : new Date()
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 2 // month is 0-indexed; next month
  const normalizedYear = month > 12 ? year + 1 : year
  const normalizedMonth = month > 12 ? 1 : month
  return `${normalizedYear}-${String(normalizedMonth).padStart(2, '0')}`
}

export function calculateNetProfit({
  subtotal,
  cogs,
  freight,
  tax,
  ccFee
}) {
  return Number(subtotal) - Number(cogs) - Number(freight) - Number(tax) - Number(ccFee)
}

export function calculateCommission({ netProfit, commissionRate }) {
  return Number(netProfit) * Number(commissionRate)
}

// Fetch commission records for a period (optionally scoped to one salesperson)
export async function getCommissionRecords({ period = null, salespersonId = null } = {}) {
  let q = supabase
    .from('commission_records')
    .select(`
      *,
      salesperson:users!commission_records_salesperson_id_fkey(full_name, email, commission_rate),
      sales_order:sales_orders(so_number, customer_id, customer:customers(company_name, contact_name))
    `)
    .order('invoice_date', { ascending: false })

  if (period) q = q.eq('commission_period', period)
  if (salespersonId) q = q.eq('salesperson_id', salespersonId)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
