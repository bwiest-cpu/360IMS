import { supabase } from './supabase'

// Preview FIFO cost for a given product and quantity (reads, doesn't mutate).
// Returns { avgUnitCost, totalCost, shortfall } — shortfall is qty not coverable.
export async function previewFifoCost(productId, quantity) {
  if (!productId || !quantity || quantity <= 0) {
    return { avgUnitCost: 0, totalCost: 0, shortfall: 0 }
  }
  const { data: lots, error } = await supabase
    .from('inventory_lots')
    .select('*')
    .eq('product_id', productId)
    .gt('quantity_remaining', 0)
    .order('received_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  let remaining = Number(quantity)
  let totalCost = 0
  let qtyTaken = 0

  for (const lot of lots ?? []) {
    if (remaining <= 0) break
    const take = Math.min(remaining, Number(lot.quantity_remaining))
    totalCost += take * Number(lot.unit_cost)
    qtyTaken += take
    remaining -= take
  }

  const avgUnitCost = qtyTaken > 0 ? totalCost / qtyTaken : 0
  return {
    avgUnitCost,
    totalCost,
    shortfall: remaining > 0 ? remaining : 0,
    coveredQty: qtyTaken
  }
}

// Fulfill a sales order by consuming inventory lots FIFO-style (server-side).
export async function fulfillSalesOrder(salesOrderId) {
  const { error } = await supabase.rpc('fifo_fulfill_sales_order', {
    p_sales_order_id: salesOrderId
  })
  if (error) throw error
}

// Receive a PO line item: creates inventory lot, updates stock.
export async function receivePurchaseOrderItem({
  poItemId,
  quantityReceived,
  actualUnitCost,
  locationId = null
}) {
  const { data, error } = await supabase.rpc('receive_purchase_order_item', {
    p_po_item_id: poItemId,
    p_quantity_received: quantityReceived,
    p_actual_unit_cost: actualUnitCost,
    p_location_id: locationId
  })
  if (error) throw error
  return data
}

// Apply a manual stock adjustment
export async function applyStockAdjustment({
  productId,
  quantityDelta,
  reason,
  unitCost = null,
  notes = null,
  userId = null
}) {
  const { data, error } = await supabase.rpc('apply_stock_adjustment', {
    p_product_id: productId,
    p_quantity_delta: quantityDelta,
    p_reason: reason,
    p_unit_cost: unitCost,
    p_notes: notes,
    p_user_id: userId
  })
  if (error) throw error
  return data
}

// Total inventory value by product using FIFO lot data
export async function calculateInventoryValuation() {
  const { data: lots, error } = await supabase
    .from('inventory_lots')
    .select('product_id, quantity_remaining, unit_cost, products(name, sku, category)')
    .gt('quantity_remaining', 0)

  if (error) throw error

  const byProduct = new Map()
  let grandTotal = 0

  for (const lot of lots ?? []) {
    const key = lot.product_id
    const lineValue = Number(lot.quantity_remaining) * Number(lot.unit_cost)
    grandTotal += lineValue
    if (!byProduct.has(key)) {
      byProduct.set(key, {
        product_id: key,
        name: lot.products?.name ?? '',
        sku: lot.products?.sku ?? '',
        category: lot.products?.category ?? '',
        total_quantity: 0,
        total_value: 0
      })
    }
    const entry = byProduct.get(key)
    entry.total_quantity += Number(lot.quantity_remaining)
    entry.total_value += lineValue
  }

  return { products: Array.from(byProduct.values()), grandTotal }
}
