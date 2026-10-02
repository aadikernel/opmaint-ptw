import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, ErrorBanner, Label, TextInput } from "../components/ui";

const DEMO = [
  ["Requester", "requester@opmaint.test"], ["Area Owner", "areaowner@opmaint.test"],
  ["Safety Officer", "safety@opmaint.test"], ["Admin", "admin@opmaint.test"],
];

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email, password); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink p-4">
      <div className="w-full max-w-md bg-white">
        <div className="hazard-stripe h-3" />
        <div className="space-y-5 p-6">
          <div>
            <h1 className="text-4xl font-bold uppercase leading-none">Permit to Work</h1>
            <p className="mt-1 text-muted">Opmaint CMMS. Sign in to request, approve or close permits.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Label text="Email"><TextInput type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Label>
            <Label text="Password"><TextInput type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Label>
            <ErrorBanner error={error} />
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium text-muted">Demo accounts (password <code className="font-semibold text-ink">Ptw@12345</code>)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map(([label, mail]) => (
                <button key={mail} type="button" onClick={() => { setEmail(mail); setPassword("Ptw@12345"); }}
                  className="min-h-11 rounded-sm border-2 border-line px-2 text-left text-base hover:bg-steel">{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
