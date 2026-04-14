// PDF generation using @react-pdf/renderer
import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer'
import { formatCurrency, formatDate } from './format'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#1e3a5f'
  },
  companyBlock: {
    flexDirection: 'column'
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1e3a5f',
    marginBottom: 4
  },
  docTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1e3a5f',
    textAlign: 'right'
  },
  docNumber: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
    marginTop: 2
  },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  colBox: {
    width: '48%'
  },
  label: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 700,
    marginBottom: 4
  },
  addrLine: {
    fontSize: 10,
    marginBottom: 2
  },
  table: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    color: '#ffffff',
    padding: 6,
    fontWeight: 700,
    fontSize: 9
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    fontSize: 9
  },
  colDesc: { width: '48%' },
  colQty: { width: '12%', textAlign: 'right' },
  colUnit: { width: '12%', textAlign: 'center' },
  colPrice: { width: '14%', textAlign: 'right' },
  colTotal: { width: '14%', textAlign: 'right' },
  totalsBox: {
    marginTop: 12,
    marginLeft: '55%'
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3
  },
  totalsLabel: { fontSize: 10, color: '#475569' },
  totalsValue: { fontSize: 10, fontWeight: 700 },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#1e3a5f'
  },
  grandTotalLabel: { fontSize: 12, fontWeight: 700, color: '#1e3a5f' },
  grandTotalValue: { fontSize: 12, fontWeight: 700, color: '#1e3a5f' },
  notes: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderLeftWidth: 3,
    borderLeftColor: '#1e3a5f'
  },
  notesLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 8
  }
})

function DocHeader({ company, title, docNumber }) {
  return (
    <View style={styles.header}>
      <View style={styles.companyBlock}>
        <Text style={styles.companyName}>{company?.company_name ?? '360 Metal Roofing Supply'}</Text>
        <Text style={styles.addrLine}>{company?.address ?? ''}</Text>
        <Text style={styles.addrLine}>
          {[company?.city, company?.state, company?.zip].filter(Boolean).join(', ')}
        </Text>
        <Text style={styles.addrLine}>{company?.phone ?? ''}</Text>
        <Text style={styles.addrLine}>{company?.email ?? 'orders@360metalroofingsupply.com'}</Text>
      </View>
      <View>
        <Text style={styles.docTitle}>{title}</Text>
        <Text style={styles.docNumber}>{docNumber}</Text>
      </View>
    </View>
  )
}

function ItemsTable({ items }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={styles.colDesc}>Description</Text>
        <Text style={styles.colQty}>Qty</Text>
        <Text style={styles.colUnit}>UOM</Text>
        <Text style={styles.colPrice}>Unit Price</Text>
        <Text style={styles.colTotal}>Total</Text>
      </View>
      {items.map((item, idx) => (
        <View key={idx} style={styles.tableRow}>
          <Text style={styles.colDesc}>
            {item.custom_description || item.product?.name || item.description || ''}
            {item.product?.sku ? `\n${item.product.sku}` : ''}
          </Text>
          <Text style={styles.colQty}>{Number(item.quantity).toFixed(2)}</Text>
          <Text style={styles.colUnit}>{item.unit_of_measure || item.product?.unit_of_measure || ''}</Text>
          <Text style={styles.colPrice}>{formatCurrency(item.unit_price ?? item.unit_cost)}</Text>
          <Text style={styles.colTotal}>
            {formatCurrency(Number(item.quantity) * Number(item.unit_price ?? item.unit_cost))}
          </Text>
        </View>
      ))}
    </View>
  )
}

function PartyBlock({ label, party }) {
  if (!party) return null
  return (
    <View style={styles.colBox}>
      <Text style={styles.label}>{label}</Text>
      {party.company_name && <Text style={styles.addrLine}>{party.company_name}</Text>}
      {party.contact_name && <Text style={styles.addrLine}>{party.contact_name}</Text>}
      {party.address && <Text style={styles.addrLine}>{party.address}</Text>}
      {(party.city || party.state || party.zip) && (
        <Text style={styles.addrLine}>
          {[party.city, party.state, party.zip].filter(Boolean).join(', ')}
        </Text>
      )}
      {party.phone && <Text style={styles.addrLine}>{party.phone}</Text>}
      {party.email && <Text style={styles.addrLine}>{party.email}</Text>}
    </View>
  )
}

export function QuotePdf({ quote, customer, salesperson, items, company }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <DocHeader company={company} title="SALES QUOTE" docNumber={quote.quote_number} />

        <View style={styles.twoCol}>
          <PartyBlock label="Bill To" party={customer} />
          <View style={styles.colBox}>
            <Text style={styles.label}>Quote Details</Text>
            <Text style={styles.addrLine}>Date: {formatDate(quote.quote_date)}</Text>
            {quote.expiry_date && <Text style={styles.addrLine}>Expires: {formatDate(quote.expiry_date)}</Text>}
            {salesperson && (
              <>
                <Text style={styles.addrLine}>Salesperson: {salesperson.full_name}</Text>
                <Text style={styles.addrLine}>{salesperson.email}</Text>
              </>
            )}
          </View>
        </View>

        <ItemsTable items={items ?? []} />

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrency(quote.subtotal)}</Text>
          </View>
          {Number(quote.freight_charge) > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Freight</Text>
              <Text style={styles.totalsValue}>{formatCurrency(quote.freight_charge)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              Sales Tax ({(Number(quote.sales_tax_rate) * 100).toFixed(3)}%)
            </Text>
            <Text style={styles.totalsValue}>{formatCurrency(quote.sales_tax_amount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(quote.total)}</Text>
          </View>
        </View>

        {quote.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text>{quote.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Thank you for your business. This quote is valid until{' '}
          {quote.expiry_date ? formatDate(quote.expiry_date) : '30 days from date above'}.
        </Text>
      </Page>
    </Document>
  )
}

export function SalesOrderPdf({ order, customer, salesperson, items, company }) {
  const title = order.status === 'draft' ? 'SALES ORDER' : 'INVOICE'
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <DocHeader company={company} title={title} docNumber={order.so_number} />

        <View style={styles.twoCol}>
          <PartyBlock label="Bill To" party={customer} />
          <View style={styles.colBox}>
            <Text style={styles.label}>Order Details</Text>
            <Text style={styles.addrLine}>Order Date: {formatDate(order.order_date)}</Text>
            {order.invoice_date && <Text style={styles.addrLine}>Invoice Date: {formatDate(order.invoice_date)}</Text>}
            {order.fulfilled_date && <Text style={styles.addrLine}>Fulfilled: {formatDate(order.fulfilled_date)}</Text>}
            <Text style={styles.addrLine}>Payment: {String(order.payment_status).toUpperCase()}</Text>
            {salesperson && (
              <>
                <Text style={styles.addrLine}>Salesperson: {salesperson.full_name}</Text>
                <Text style={styles.addrLine}>{salesperson.email}</Text>
              </>
            )}
          </View>
        </View>

        <ItemsTable items={items ?? []} />

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrency(order.subtotal)}</Text>
          </View>
          {Number(order.freight_charge) > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Freight</Text>
              <Text style={styles.totalsValue}>{formatCurrency(order.freight_charge)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              Sales Tax ({(Number(order.sales_tax_rate) * 100).toFixed(3)}%)
            </Text>
            <Text style={styles.totalsValue}>{formatCurrency(order.sales_tax_amount)}</Text>
          </View>
          {Number(order.credit_card_fee_amount) > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                CC Fee ({(Number(order.credit_card_fee_rate) * 100).toFixed(2)}%)
              </Text>
              <Text style={styles.totalsValue}>{formatCurrency(order.credit_card_fee_amount)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(order.total)}</Text>
          </View>
        </View>

        {order.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text>{order.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Remit payment to: {company?.company_name ?? '360 Metal Roofing Supply'} — {company?.email ?? 'orders@360metalroofingsupply.com'}
        </Text>
      </Page>
    </Document>
  )
}

export function PurchaseOrderPdf({ po, supplier, items, company }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <DocHeader company={company} title="PURCHASE ORDER" docNumber={po.po_number} />

        <View style={styles.twoCol}>
          <PartyBlock label="Supplier" party={supplier} />
          <View style={styles.colBox}>
            <Text style={styles.label}>PO Details</Text>
            <Text style={styles.addrLine}>Order Date: {formatDate(po.order_date)}</Text>
            {po.expected_date && <Text style={styles.addrLine}>Expected: {formatDate(po.expected_date)}</Text>}
            <Text style={styles.addrLine}>Status: {String(po.status).toUpperCase()}</Text>
          </View>
        </View>

        <ItemsTable
          items={(items ?? []).map((i) => ({ ...i, unit_price: i.unit_cost }))}
        />

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrency(po.subtotal)}</Text>
          </View>
          {Number(po.freight_cost) > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Freight</Text>
              <Text style={styles.totalsValue}>{formatCurrency(po.freight_cost)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(po.total)}</Text>
          </View>
        </View>

        {po.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text>{po.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Please confirm receipt of this purchase order and provide expected ship date.
        </Text>
      </Page>
    </Document>
  )
}

export async function pdfToBlob(pdfDoc) {
  return await pdf(pdfDoc).toBlob()
}

export async function pdfToBase64(pdfDoc) {
  const blob = await pdf(pdfDoc).toBlob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
