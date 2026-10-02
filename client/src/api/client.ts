const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api";
const TOKEN_KEY = "ptw_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface ErrorDetail { path: string; message: string }
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: ErrorDetail[]) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event("ptw:logout"));
    }
    throw new ApiError(res.status, data?.error?.message ?? `Request failed (${res.status})`, Array.isArray(data?.error?.details) ? data.error.details : undefined);
  }
  return data as T;
}
