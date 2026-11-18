import { NextResponse } from "next/server";
import { getIntegrationSecret, secretErrorMessage } from "../../../lib/integration-secrets-server";

type ModelName = "gemini" | "groq";

async function generateWithGemini(apiKey: string, prompt: string) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 429 ? "LIMIT_GEMINI" : `ERROR_GEMINI_${response.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) throw new Error("EMPTY_GEMINI");
  return text;
}

async function generateWithGroq(apiKey: string, prompt: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: prompt }] }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 429 ? "LIMIT_GROQ" : `ERROR_GROQ_${response.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("EMPTY_GROQ");
  return text;
}

function providerError(error: unknown) {
  if (error instanceof Error && error.message.startsWith("LIMIT_")) {
    return { message: `${error.message.includes("GEMINI") ? "Gemini" : "Groq"} alcanzó su límite de uso.`, status: 429 };
  }
  if (error instanceof Error && error.message.startsWith("ERROR_GEMINI_")) {
    return { message: `Gemini respondió con error HTTP ${error.message.replace("ERROR_GEMINI_", "")}.`, status: 502 };
  }
  if (error instanceof Error && error.message.startsWith("ERROR_GROQ_")) {
    return { message: `Groq respondió con error HTTP ${error.message.replace("ERROR_GROQ_", "")}.`, status: 502 };
  }
  if (error instanceof Error && (error.message === "EMPTY_GEMINI" || error.message === "EMPTY_GROQ")) {
    return { message: `${error.message.includes("GEMINI") ? "Gemini" : "Groq"} respondió sin contenido.`, status: 502 };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return { message: "Se agotó el tiempo de espera al consultar el proveedor de IA.", status: 504 };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { message: "Se agotó el tiempo de espera al consultar el proveedor de IA.", status: 504 };
  }
  return { message: "No se pudo conectar con el proveedor de IA.", status: 502 };
}

function providerName(model: ModelName) {
  return model === "gemini" ? "Gemini" : "Groq";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const requestedModel = body?.forzarModelo;

    if (!prompt) return NextResponse.json({ error: "Escribe una instrucción." }, { status: 400 });
    if (prompt.length > 20000) return NextResponse.json({ error: "La instrucción supera el límite permitido." }, { status: 413 });
    if (requestedModel && requestedModel !== "gemini" && requestedModel !== "groq") {
      return NextResponse.json({ error: "El modelo solicitado no está permitido." }, { status: 400 });
    }

    const models: ModelName[] = requestedModel ? [requestedModel] : ["gemini", "groq"];
    const failures: unknown[] = [];

    for (const model of models) {
      const secret = await getIntegrationSecret(request, model);
      if (!secret.ok) {
        continue;
      }

      try {
        const text = model === "gemini"
          ? await generateWithGemini(secret.value, prompt)
          : await generateWithGroq(secret.value, prompt);
        return NextResponse.json({ [model]: text, modelo_usado: model === "gemini" ? "Gemini" : "Groq" });
      } catch (error) {
        failures.push({ model, error });
        if (requestedModel) {
          const result = providerError(error);
          return NextResponse.json({ error: result.message }, { status: result.status });
        }
      }
    }

    if (failures.length === 0) {
      return NextResponse.json({ error: "Configura GEMINI_API_KEY o GROQ_API_KEY en .env." }, { status: 503 });
    }

    const lastFailure = failures[failures.length - 1] as { model: ModelName; error: unknown };
    const result = providerError(lastFailure.error);
    const detail = `${providerName(lastFailure.model)}: ${result.message}`;
    return NextResponse.json({ error: detail }, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Error interno en Chat API." }, { status: 500 });
  }
}
