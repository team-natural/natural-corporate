// fetch wrapper for the islands: JSON in, the server-kit envelope out. Every island reloads the
// page after a successful write — admin screens show committed state, not optimistic state
// (PRD-04 §4-4).

export interface ApiFailure {
  status: number;
  message: string;
  errors: Record<string, string[] | undefined>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

export async function callApi<T = unknown>(path: string, init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = { method: "GET" }): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: init.method,
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const json = (await response.json().catch(() => null)) as { data?: T; message?: string; errors?: Record<string, string[] | undefined> } | null;
    if (response.ok) return { ok: true, data: json?.data as T };
    // Session gone: the login screen is the only useful place to be.
    if (response.status === 401) window.location.replace("/");
    return { ok: false, error: { status: response.status, message: json?.message ?? "エラーが発生しました。", errors: json?.errors ?? {} } };
  } catch {
    return { ok: false, error: { status: 0, message: "サーバーに接続できません。", errors: {} } };
  }
}

export function reload(): void {
  window.location.reload();
}
