import { Navigate, Route, Routes } from "react-router-dom";
import { ReactElement } from "react";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { PermitFormPage } from "./pages/PermitFormPage";
import { PermitDetailPage } from "./pages/PermitDetailPage";
import { AdminPage } from "./pages/AdminPage";
import type { Role } from "./lib/types";

function Protected({ children, roles }: { children: ReactElement; roles?: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center font-display text-2xl">Loading…</div>;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected>{user ? <AppShell /> : <Navigate to="/login" />}</Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="permits/new" element={<Protected roles={["REQUESTER", "ADMIN"]}><PermitFormPage /></Protected>} />
        <Route path="permits/:id/edit" element={<Protected roles={["REQUESTER", "ADMIN"]}><PermitFormPage /></Protected>} />
        <Route path="permits/:id" element={<PermitDetailPage />} />
        <Route path="approvals" element={<Protected roles={["AREA_OWNER", "SAFETY_OFFICER", "ADMIN"]}><ApprovalsPage /></Protected>} />
        <Route path="admin" element={<Protected roles={["ADMIN"]}><AdminPage /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
