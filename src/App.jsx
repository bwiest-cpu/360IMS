import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { RequireAuth, RequireRole } from '@/components/shared/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'

import LoginPage from '@/pages/auth/LoginPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage'
import DashboardPage from '@/pages/DashboardPage'

import ProductsPage from '@/pages/products/ProductsPage'
import ProductFormPage from '@/pages/products/ProductFormPage'
import ProductDetailPage from '@/pages/products/ProductDetailPage'
import ProductImportPage from '@/pages/products/ProductImportPage'

import InventoryPage from '@/pages/inventory/InventoryPage'

import CustomersPage from '@/pages/customers/CustomersPage'
import CustomerFormPage from '@/pages/customers/CustomerFormPage'
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage'

import SuppliersPage from '@/pages/suppliers/SuppliersPage'
import SupplierFormPage from '@/pages/suppliers/SupplierFormPage'
import SupplierDetailPage from '@/pages/suppliers/SupplierDetailPage'

import PurchaseOrdersPage from '@/pages/purchase-orders/PurchaseOrdersPage'
import PurchaseOrderFormPage from '@/pages/purchase-orders/PurchaseOrderFormPage'
import PurchaseOrderDetailPage from '@/pages/purchase-orders/PurchaseOrderDetailPage'

import QuotesPage from '@/pages/quotes/QuotesPage'
import QuoteFormPage from '@/pages/quotes/QuoteFormPage'
import QuoteDetailPage from '@/pages/quotes/QuoteDetailPage'

import SalesOrdersPage from '@/pages/sales-orders/SalesOrdersPage'
import SalesOrderFormPage from '@/pages/sales-orders/SalesOrderFormPage'
import SalesOrderDetailPage from '@/pages/sales-orders/SalesOrderDetailPage'

import ReportsIndexPage from '@/pages/reports/ReportsIndexPage'
import SalesByPeriodReport from '@/pages/reports/SalesByPeriodReport'
import SalesBySalespersonReport from '@/pages/reports/SalesBySalespersonReport'
import SalesByCustomerReport from '@/pages/reports/SalesByCustomerReport'
import SalesByProductReport from '@/pages/reports/SalesByProductReport'
import CommissionPeriodReport from '@/pages/reports/CommissionPeriodReport'
import CommissionDetailReport from '@/pages/reports/CommissionDetailReport'
import {
  StockLevelsReport,
  InventoryValuationReport,
  InventoryMovementReport
} from '@/pages/reports/InventoryReports'
import {
  PnLReport,
  AccountsReceivableReport,
  AccrualVsCashReport
} from '@/pages/reports/FinancialReports'

import SettingsPage from '@/pages/settings/SettingsPage'
import CompanySettingsTab from '@/pages/settings/CompanySettingsTab'
import UsersTab from '@/pages/settings/UsersTab'
import EmailLogsTab from '@/pages/settings/EmailLogsTab'
import IntegrationsTab from '@/pages/settings/IntegrationsTab'

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const loadCompany = useSettingsStore((s) => s.load)
  const session = useAuthStore((s) => s.session)

  useEffect(() => { initialize() }, [])
  useEffect(() => { if (session) loadCompany() }, [session])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<ProductFormPage />} />
        <Route path="/products/import" element={<ProductImportPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/products/:id/edit" element={<ProductFormPage />} />

        <Route path="/inventory" element={<InventoryPage />} />

        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/new" element={<CustomerFormPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/customers/:id/edit" element={<CustomerFormPage />} />

        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/new" element={<SupplierFormPage />} />
        <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="/suppliers/:id/edit" element={<SupplierFormPage />} />

        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/purchase-orders/new" element={<PurchaseOrderFormPage />} />
        <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
        <Route path="/purchase-orders/:id/edit" element={<PurchaseOrderFormPage />} />

        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="/quotes/new" element={<QuoteFormPage />} />
        <Route path="/quotes/:id" element={<QuoteDetailPage />} />
        <Route path="/quotes/:id/edit" element={<QuoteFormPage />} />

        <Route path="/sales-orders" element={<SalesOrdersPage />} />
        <Route path="/sales-orders/new" element={<SalesOrderFormPage />} />
        <Route path="/sales-orders/:id" element={<SalesOrderDetailPage />} />
        <Route path="/sales-orders/:id/edit" element={<SalesOrderFormPage />} />

        <Route path="/reports" element={<ReportsIndexPage />} />
        <Route path="/reports/sales-by-period" element={<SalesByPeriodReport />} />
        <Route path="/reports/sales-by-salesperson" element={<SalesBySalespersonReport />} />
        <Route path="/reports/sales-by-customer" element={<SalesByCustomerReport />} />
        <Route path="/reports/sales-by-product" element={<SalesByProductReport />} />
        <Route path="/reports/commission-period" element={<CommissionPeriodReport />} />
        <Route path="/reports/commission-detail" element={<CommissionDetailReport />} />
        <Route path="/reports/stock-levels" element={<StockLevelsReport />} />
        <Route path="/reports/inventory-valuation" element={<InventoryValuationReport />} />
        <Route path="/reports/inventory-movement" element={<InventoryMovementReport />} />
        <Route path="/reports/pnl" element={<PnLReport />} />
        <Route path="/reports/accounts-receivable" element={<AccountsReceivableReport />} />
        <Route path="/reports/accrual-vs-cash" element={<AccrualVsCashReport />} />

        <Route
          path="/settings"
          element={
            <RequireRole roles={['admin']}>
              <SettingsPage />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="/settings/company" replace />} />
          <Route path="company" element={<CompanySettingsTab />} />
          <Route path="users" element={<UsersTab />} />
          <Route path="email-logs" element={<EmailLogsTab />} />
          <Route path="integrations" element={<IntegrationsTab />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
