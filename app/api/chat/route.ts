import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, forzarModelo } = body;
    
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    const consultarGemini = async () => {
      if (!geminiKey) throw new Error("Falta GEMINI_API_KEY");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (response.status === 429) throw new Error("LIMIT_GEMINI");
      const data = await response.json();
      if (!response.ok) throw new Error("ERROR_GEMINI");
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    };

    const consultarGroq = async () => {
      if (!groqKey) throw new Error("Falta GROQ_API_KEY");
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: prompt }] }),
      });
      if (response.status === 429) throw new Error("LIMIT_GROQ");
      const data = await response.json();
      if (!response.ok) throw new Error("ERROR_GROQ");
      return data.choices?.[0]?.message?.content;
    };

    // Si el frontend fuerza un modelo, solo usa ese.
    if (forzarModelo === "gemini") {
      try { return NextResponse.json({ gemini: await consultarGemini() }); } 
      catch (e: any) { return NextResponse.json({ error: e.message }, { status: 429 }); }
    }
    
    if (forzarModelo === "groq") {
      try { return NextResponse.json({ groq: await consultarGroq() }); } 
      catch (e: any) { return NextResponse.json({ error: e.message }, { status: 429 }); }
    }

    // Si no se fuerza, intenta Gemini primero. Si falla, intenta Groq.
    try {
      const res = await consultarGemini();
      return NextResponse.json({ gemini: res, modelo_usado: "Gemini" });
    } catch (e) {
      console.warn("Gemini falló, usando Groq...");
      try {
        const res = await consultarGroq();
        return NextResponse.json({ groq: res, modelo_usado: "Groq" });
      } catch (e2) {
        return NextResponse.json({ error: "Ambas IAs ocupadas" }, { status: 429 });
      }
    }

  } catch (error) {
    return NextResponse.json({ error: "Error interno en Chat API" }, { status: 500 });
  }
}