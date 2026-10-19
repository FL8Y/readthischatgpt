/**
 * API client with base-URL failover, one-shot token refresh and GET coalescing.
 * Behaviour modelled on what the reference app's client does (observed constants: retry statuses 502/503/504,
 * 12 s timeout). Written from scratch; fetch and token storage are injected so it is testable.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) { super(message); this.status = status; this.body = body; }
}

export interface Tokens { access: string; refresh: string }
export interface TokenStore { get(): Promise<Tokens | null>; set(t: Tokens): Promise<void>; clear(): Promise<void> }
export interface ClientOptions {
  bases: string[];
  fetch: typeof fetch;
  tokens: TokenStore;
  refreshPath?: string;
  retryStatuses?: number[];
  timeoutMs?: number;
}
export interface RequestOptions { method?: string; body?: unknown; headers?: Record<string, string>; accessToken?: string }

export function createClient(o: ClientOptions) {
  const bases = o.bases.filter(Boolean).map((b) => b.replace(/\/+$/, ""));
  if (bases.length === 0) throw new Error("No API base URL configured");
  const retry = new Set(o.retryStatuses ?? [502, 503, 504]);
  const refreshPath = o.refreshPath ?? "/auth/token/refresh/";
  const timeoutMs = o.timeoutMs ?? 12_000;

  const singleFlight = <T>(fn: () => Promise<T>) => {
    let p: Promise<T> | null = null;
    return () => (p ??= fn().finally(() => { p = null; }));
  };

  async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try { return await o.fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(timer); }
  }

  const refresh = singleFlight(async () => {
    const cur = await o.tokens.get();
    if (!cur) throw new ApiError(401, "Not signed in", null);
    for (const b of bases) {
      try {
        const r = await fetchWithTimeout(b + refreshPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: cur.refresh }) });
        if (r.ok) { const j = (await r.json()) as Tokens; await o.tokens.set(j); return j; }
        if (r.status === 401) break;
      } catch { /* try next base */ }
    }
    await o.tokens.clear();
    throw new ApiError(401, "Session expired", null);
  });

  async function once(path: string, opts: RequestOptions, token: string | undefined) {
    let attempts = 0;
    for (const b of bases) {
      attempts++;
      const headers: Record<string, string> = { "Content-Type": "application/json", ...opts.headers };
      if (token) headers.Authorization = `Bearer ${token}`;
      try {
        const r = await fetchWithTimeout(b + path, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
        if (retry.has(r.status)) continue;          // gateway-type error: try the next base
        return { r, attempts };
      } catch { /* network error: try the next base */ }
    }
    throw new Error(`Network error calling ${path} (${attempts} attempts)`);
  }

  async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    let token = opts.accessToken ?? (await o.tokens.get())?.access;
    let { r } = await once(path, opts, token);
    if (r.status === 401 && !opts.accessToken) {      // refresh once, then repeat
      token = (await refresh()).access;
      ({ r } = await once(path, opts, token));
    }
    const text = await r.text();
    const body = text ? safeJson(text) : null;
    if (!r.ok) throw new ApiError(r.status, extractMessage(body) ?? r.statusText ?? `HTTP ${r.status}`, body);
    return body as T;
  }

  const inflight = new Map<string, Promise<unknown>>();
  /** Identical GETs issued at the same time share one network call. */
  function get<T = unknown>(path: string, headers: Record<string, string> = {}): Promise<T> {
    const key = path + JSON.stringify(headers);
    const hit = inflight.get(key) as Promise<T> | undefined;
    if (hit) return hit;
    const p = request<T>(path, { headers }).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  return { request, get, post: <T>(p: string, body?: unknown) => request<T>(p, { method: "POST", body }) };
}

const safeJson = (t: string) => { try { return JSON.parse(t); } catch { return t; } };
function extractMessage(b: unknown): string | null {
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    for (const k of ["detail", "message", "error"]) if (typeof o[k] === "string") return o[k] as string;
  }
  return typeof b === "string" && b ? b.slice(0, 200) : null;
}
