import { ClipboardCheck, LayoutDashboard, LogOut, Plus, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABEL } from "../lib/format";

const link = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-sm px-3 font-display text-lg font-semibold uppercase tracking-wide ${isActive ? "bg-hazard text-ink" : "text-white hover:bg-white/10"}`;

export function AppShell() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const canCreate = user.role === "REQUESTER" || user.role === "ADMIN";
  const canApprove = user.role !== "REQUESTER";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
          <div className="font-display text-2xl font-bold uppercase leading-none tracking-wide">
            Opmaint <span className="text-hazard">PTW</span>
          </div>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Main">
            <NavLink to="/" end className={link}><LayoutDashboard size={18} /> Permits</NavLink>
            {canCreate && <NavLink to="/permits/new" className={link}><Plus size={18} /> New permit</NavLink>}
            {canApprove && <NavLink to="/approvals" className={link}><ClipboardCheck size={18} /> Approvals</NavLink>}
            {user.role === "ADMIN" && <NavLink to="/admin" className={link}><Settings size={18} /> Admin</NavLink>}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-base font-medium">{user.name}</div>
              <div className="text-sm text-white/70">{ROLE_LABEL[user.role]}</div>
            </div>
            <button onClick={logout} className="grid size-11 place-items-center rounded-sm hover:bg-white/10" aria-label="Log out"><LogOut size={20} /></button>
          </div>
        </div>
        <div className="hazard-stripe h-2" />
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5"><Outlet /></main>
    </div>
  );
}
