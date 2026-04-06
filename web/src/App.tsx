import { Navigate, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./components/AdminRoute";
import { AppShell } from "./components/AppShell";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { CustomerHalfOrderPage } from "./pages/CustomerHalfOrderPage";
import { AdminOrderPage } from "./pages/AdminOrderPage";
import { CustomerOrderPage } from "./pages/CustomerOrderPage";
import { CustomerStatusPage } from "./pages/CustomerStatusPage";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/customer/order" element={<CustomerOrderPage />} />
        <Route path="/customer/half-order" element={<CustomerHalfOrderPage />} />
        <Route path="/customer/status" element={<CustomerStatusPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/orders/:orderId"
          element={
            <AdminRoute>
              <AdminOrderPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
