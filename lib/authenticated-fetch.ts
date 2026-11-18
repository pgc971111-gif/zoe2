import { getSupabaseBrowserClient } from "./supabase-browser";

export async function authenticatedPost(path: string, body: unknown): Promise<Response> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session) {
    throw new Error("Inicia sesión desde Integraciones antes de usar los proveedores.");
  }

  return fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function providerPost(path: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data.session?.access_token) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  } catch {
    // Local server-side provider keys can be used without a Supabase Auth session.
  }
  return fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" && data.error.trim()
    ? data.error
    : fallback;
}
