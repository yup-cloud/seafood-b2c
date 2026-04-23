import { type ReactNode, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./components/AdminRoute";
import { AppShell } from "./components/AppShell";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminOrderPage } from "./pages/AdminOrderPage";
import { CustomerOrderPage } from "./pages/CustomerOrderPage";
import { CustomerStatusPage } from "./pages/CustomerStatusPage";
import { HomePage } from "./pages/HomePage";

function PageTitle({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return <>{children}</>;
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<PageTitle title="오늘바다"><HomePage /></PageTitle>} />
        <Route path="/customer/order" element={<PageTitle title="주문하기 | 오늘바다"><CustomerOrderPage /></PageTitle>} />
        <Route path="/customer/status" element={<PageTitle title="내 주문 확인 | 오늘바다"><CustomerStatusPage /></PageTitle>} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <PageTitle title="운영 관리 | 오늘바다">
                <AdminDashboardPage />
              </PageTitle>
            </AdminRoute>
          }
        />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route
          path="/admin/orders/:orderId"
          element={
            <AdminRoute>
              <PageTitle title="주문 상세 | 오늘바다 운영">
                <AdminOrderPage />
              </PageTitle>
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
