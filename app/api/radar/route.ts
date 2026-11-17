import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const { objetivo } = await request.json();
    
    const tavilyKey = process.env.TAVILY_API_KEY;
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    let resultadosBusqueda = "";
    let fuenteUsada = "";

    if (tavilyKey) {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: tavilyKey, query: `ideas de negocios digitales ${objetivo}`, max_results: 3 }),
        });
        const data = await res.json();
        if (res.ok && data.results && data.results.length > 0) {
          resultadosBusqueda = data.results.map((r: any) => `- ${r.title}: ${r.content}`).join("\n");
          fuenteUsada = "Tavily";
        }
      } catch (e) { console.error("Fallo Tavily"); }
    }

    if (!resultadosBusqueda && firecrawlKey) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: { "Authorization": `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: `nichos digitales rentables ${objetivo}`, limit: 3 }),
        });
        const data = await res.json();
        if (res.ok && data.data && data.data.length > 0) {
          resultadosBusqueda = data.data.map((r: any) => `- ${r.title}: ${r.description || ""}`).join("\n");
          fuenteUsada = "Firecrawl";
        }
      } catch (e) { console.error("Fallo Firecrawl"); }
    }

    if (!resultadosBusqueda) {
      return NextResponse.json({ success: false, error: "Las APIs de búsqueda fallaron." }, { status: 200 });
    }

    // PROMPT ESTRICTO: SOLO DIGITAL
    const promptRadar = `Eres RADAR. Objetivo: "${objetivo}". Resultados: ${resultadosBusqueda}.
    REGLA ESTRICTA: Las ideas DEBEN ser 100% digitales (infoproductos, SaaS, servicios remotos, dropshipping). PROHIBIDO recomendar negocios físicos o locales.
    Devuelve ÚNICAMENTE este JSON: 
    { "ideas": [ { "titulo": "Nombre", "descripcion": "Detalle digital", "precio_estimado": "$10-$30", "competencia": "Media", "fuente": "${fuenteUsada}" } ] }`;

    let respuestaTexto = "";
    let iaUsada = "Gemini";

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: promptRadar }] }] }) });
      const data = await res.json();
      if (res.ok && data.candidates) respuestaTexto = data.candidates[0].content.parts[0].text;
    } catch (e) { console.error("Fallo Gemini"); }

    if (!respuestaTexto && groqKey) {
      iaUsada = "Groq";
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: promptRadar }] }) });
        const data = await res.json();
        if (res.ok && data.choices) respuestaTexto = data.choices[0].message.content;
      } catch (e) { console.error("Fallo Groq"); }
    }

    if (!respuestaTexto) return NextResponse.json({ success: false, error: "IAs fallaron." }, { status: 200 });

    const inicio = respuestaTexto.indexOf('{');
    const fin = respuestaTexto.lastIndexOf('}');
    const jsonLimpio = respuestaTexto.substring(inicio, fin + 1);
    const dataJSON = JSON.parse(jsonLimpio);

    if (dataJSON.ideas && dataJSON.ideas.length > 0) {
      const ideasAInsertar = dataJSON.ideas.map((idea: any) => ({
        titulo: idea.titulo, descripcion: idea.descripcion, precio_estimado: idea.precio_estimado, competencia: idea.competencia, fuente: `${idea.fuente} (IA: ${iaUsada})`, estado: "pendiente"
      }));
      await supabase.from("oportunidades").insert(ideasAInsertar);
    }

    return NextResponse.json({ success: true, ideas: dataJSON.ideas, ia_usada: iaUsada });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Error interno: " + error.message }, { status: 200 });
  }
}