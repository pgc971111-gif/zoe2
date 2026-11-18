type Provider = "tavily" | "firecrawl" | "gemini" | "groq" | "facebook" | "tiktok" | "instagram" | "youtube";
type SecretResult = { ok: true; value: string } | { ok: false; reason: "missing" };

const ENV_KEYS: Partial<Record<Provider, string>> = {
  tavily: "TAVILY_API_KEY",
  firecrawl: "FIRECRAWL_API_KEY",
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
};

/** Provider credentials are server-only environment variables; this path never calls Supabase. */
export async function getIntegrationSecret(
  _request: Request,
  provider: Provider,
  credential = "api_key",
): Promise<SecretResult> {
  if (credential !== "api_key") return { ok: false, reason: "missing" };
  const envName = ENV_KEYS[provider];
  const value = envName ? process.env[envName]?.trim() : "";
  if (!value || value === "fc-TU_CLAVE_AQUI") return { ok: false, reason: "missing" };
  return { ok: true, value };
}

export function secretErrorMessage(_reason: "missing") {
  return "Falta configurar la clave del proveedor en el archivo .env del servidor.";
}
