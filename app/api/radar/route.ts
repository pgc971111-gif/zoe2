import { NextResponse } from "next/server";
import { getIntegrationSecret, secretErrorMessage } from "../../../lib/integration-secrets-server";

type SearchItem = {
  title?: string;
  content?: string;
  description?: string;
  markdown?: string;
  url?: string;
};

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function providerStatus(provider: string, status: number) {
  if (status === 401) return `${provider}: la clave fue rechazada (HTTP 401).`;
  if (status === 402 || status === 432 || status === 433 || status === 434) {
    return `${provider}: la cuenta o el límite del plan rechazó la solicitud (HTTP ${status}).`;
  }
  if (status === 403) return `${provider}: acceso denegado (HTTP 403).`;
  if (status === 404) return `${provider}: no encontró el endpoint de búsqueda (HTTP 404).`;
  if (status === 429) return `${provider}: límite de solicitudes alcanzado (HTTP 429).`;
  return `${provider}: respondió con error HTTP ${status}.`;
}

function providerNetworkError(provider: string, error: unknown) {
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return `${provider}: se agotó el tiempo de espera.`;
  }
  return `${provider}: no se pudo conectar.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const objetivo = typeof body?.objetivo === "string" ? body.objetivo.trim() : "";

    if (!objetivo) {
      return NextResponse.json(
        { success: false, error: "Escribe un objetivo antes de investigar." },
        { status: 400 },
      );
    }

    const [tavilySecret, firecrawlSecret, geminiSecret, groqSecret] = await Promise.all([
      getIntegrationSecret(request, "tavily"),
      getIntegrationSecret(request, "firecrawl"),
      getIntegrationSecret(request, "gemini"),
      getIntegrationSecret(request, "groq"),
    ]);
    const tavilyKey = tavilySecret.ok ? tavilySecret.value : undefined;
    const firecrawlKey = firecrawlSecret.ok ? firecrawlSecret.value : undefined;
    const geminiKey = geminiSecret.ok ? geminiSecret.value : undefined;
    const groqKey = groqSecret.ok ? groqSecret.value : undefined;

    if (!tavilyKey && !firecrawlKey) {
      return NextResponse.json(
        { success: false, error: "Configura TAVILY_API_KEY o una clave válida FIRECRAWL_API_KEY en .env." },
        { status: 503 },
      );
    }
    const fallosBusqueda: string[] = [];
    let resultadosBusqueda = "";
    let fuenteUsada = "";

    if (tavilyKey) {
      try {
        const response = await fetchWithTimeout("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tavilyKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `ideas de negocios digitales ${objetivo}`,
            search_depth: "basic",
            max_results: 3,
          }),
        });
        const data = await readJson(response);

        if (!response.ok) {
          fallosBusqueda.push(providerStatus("Tavily", response.status));
        } else if (Array.isArray(data?.results) && data.results.length > 0) {
          resultadosBusqueda = data.results
            .map((result: SearchItem) => `- ${result.title || "Resultado"}: ${result.content || result.url || ""}`)
            .join("\n");
          fuenteUsada = "Tavily";
        } else {
          fallosBusqueda.push("Tavily respondió, pero no devolvió resultados.");
        }
      } catch (error) {
        fallosBusqueda.push(providerNetworkError("Tavily", error));
      }
    }

    if (!resultadosBusqueda && firecrawlKey) {
      try {
        const response = await fetchWithTimeout("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `nichos digitales rentables ${objetivo}`,
            limit: 3,
            sources: [{ type: "web" }],
          }),
        });
        const data = await readJson(response);

        if (!response.ok) {
          fallosBusqueda.push(providerStatus("Firecrawl", response.status));
        } else if (Array.isArray(data?.data?.web) && data.data.web.length > 0) {
          resultadosBusqueda = data.data.web
            .map((result: SearchItem) => `- ${result.title || "Resultado"}: ${result.description || result.markdown || result.url || ""}`)
            .join("\n");
          fuenteUsada = "Firecrawl";
        } else {
          fallosBusqueda.push("Firecrawl respondió, pero no devolvió resultados web.");
        }
      } catch (error) {
        fallosBusqueda.push(providerNetworkError("Firecrawl", error));
      }
    }

    if (!resultadosBusqueda) {
      return NextResponse.json(
        {
          success: false,
          error: fallosBusqueda.length
            ? `No se pudieron obtener resultados. ${fallosBusqueda.join(" ")}`
            : "No se encontraron resultados de búsqueda.",
        },
        { status: 502 },
      );
    }

    const promptRadar = `Eres RADAR. Objetivo: "${objetivo}". Resultados: ${resultadosBusqueda}.
    REGLA ESTRICTA: Las ideas DEBEN ser 100% digitales (infoproductos, SaaS, servicios remotos, dropshipping). PROHIBIDO recomendar negocios físicos o locales.
    Devuelve ÚNICAMENTE este JSON:
    { "ideas": [ { "titulo": "Nombre", "descripcion": "Detalle digital", "precio_estimado": "$10-$30", "competencia": "Media", "fuente": "${fuenteUsada}" } ] }`;

    let respuestaTexto = "";
    let iaUsada = "Gemini";
    const fallosIA: string[] = [];

    if (geminiKey) {
      try {
        const response = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptRadar }] }] }),
        });
        const data = await readJson(response);
        if (response.ok) respuestaTexto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!response.ok) fallosIA.push(providerStatus("Gemini", response.status));
        else if (!respuestaTexto) fallosIA.push("Gemini respondió sin contenido.");
      } catch (error) {
        fallosIA.push(providerNetworkError("Gemini", error));
      }
    }

    if (!respuestaTexto && groqKey) {
      iaUsada = "Groq";
      try {
        const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [{ role: "user", content: promptRadar }],
          }),
        });
        const data = await readJson(response);
        if (response.ok) respuestaTexto = data?.choices?.[0]?.message?.content || "";
        if (!response.ok) fallosIA.push(providerStatus("Groq", response.status));
        else if (!respuestaTexto) fallosIA.push("Groq respondió sin contenido.");
      } catch (error) {
        fallosIA.push(providerNetworkError("Groq", error));
      }
    }

    if (!respuestaTexto) {
      return NextResponse.json(
        {
          success: false,
          error: fallosIA.length
            ? `La búsqueda sí respondió, pero falló el análisis. ${fallosIA.join(" ")}`
            : "La búsqueda sí encontró resultados, pero falta GEMINI_API_KEY o GROQ_API_KEY en .env para analizarlos.",
        },
        { status: 502 },
      );
    }

    const inicio = respuestaTexto.indexOf("{");
    const fin = respuestaTexto.lastIndexOf("}");
    if (inicio === -1 || fin < inicio) {
      return NextResponse.json(
        { success: false, error: "El modelo de análisis no devolvió el JSON esperado." },
        { status: 502 },
      );
    }

    const dataJSON = JSON.parse(respuestaTexto.substring(inicio, fin + 1));
    if (!Array.isArray(dataJSON.ideas)) {
      return NextResponse.json(
        { success: false, error: "El modelo de análisis devolvió un formato de ideas inválido." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, ideas: dataJSON.ideas, ia_usada: iaUsada });
  } catch {
    return NextResponse.json(
      { success: false, error: "Error interno al investigar el objetivo." },
      { status: 500 },
    );
  }
}
