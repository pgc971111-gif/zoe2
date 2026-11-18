"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { providerPost, readApiError } from "../../lib/authenticated-fetch";
import { useRouter } from "next/navigation";

interface IdeaRadar {
  titulo: string;
  descripcion: string;
  precio_estimado: string;
  competencia: string;
  fuente: string;
  viabilidad?: number;
  prob_exito?: number;
  justificacion_zoe?: string;
  ia_zoe?: string;
}

interface OportunidadGuardada extends IdeaRadar {
  id: number;
  sesion_id: string;
  created_at: string;
  probabilidad_exito?: number;
  analisis_zoe?: string;
}

interface AnalisisZoe {
  analisis: {
    titulo: string;
    viabilidad: number;
    prob_exito: number;
    justificacion_zoe: string;
  }[];
}

export default function OportunidadesPage() {
  const [objetivo, setObjetivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [estadoIA, setEstadoIA] = useState("");
  const [error, setError] = useState("");
  
  const [resultadosActuales, setResultadosActuales] = useState<IdeaRadar[]>([]);
  const [historial, setHistorial] = useState<Record<string, OportunidadGuardada[]>>({});
  const router = useRouter();

  const cargarHistorial = async () => {
    const { data } = await supabase.from("oportunidades").select("*").order("created_at", { ascending: false });
    if (data) {
      const agrupado: Record<string, OportunidadGuardada[]> = {};
      data.forEach((op: OportunidadGuardada) => {
        if (!agrupado[op.sesion_id]) agrupado[op.sesion_id] = [];
        agrupado[op.sesion_id].push(op);
      });
      setHistorial(agrupado);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  const extraerJSON = (texto: string | undefined) => {
    if (!texto) throw new Error("Sin texto");
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}');
    if (inicio === -1 || fin === -1) throw new Error("No es JSON");
    return JSON.parse(texto.substring(inicio, fin + 1));
  };

  const buscarYAnalizar = async () => {
    if (!objetivo.trim()) return;
    setCargando(true); setError(""); setResultadosActuales([]); setEstadoIA("RADAR está buscando en internet...");

    try {
      const resRadar = await providerPost("/api/radar", { objetivo });
      if (!resRadar.ok) throw new Error(await readApiError(resRadar, `No se pudo investigar (HTTP ${resRadar.status}).`));
      const dataRadar = await resRadar.json();
      
      if (!dataRadar.success) throw new Error(dataRadar.error || "RADAR no encontró ideas.");
      
      const ideasCrudas = dataRadar.ideas;
      
      setEstadoIA("ZOE está analizando viabilidad y probabilidad de éxito...");
      const promptZOE = `Eres ZOE. RADAR encontró: ${JSON.stringify(ideasCrudas)}
      Asigna viabilidad (0-100), probabilidad de éxito (0-100) y justificación breve para cada idea.
      Devuelve ÚNICAMENTE este JSON: { "analisis": [ { "titulo": "Título original", "viabilidad": 85, "prob_exito": 70, "justificacion_zoe": "..." } ] }`;

      let dataAnalisis: AnalisisZoe | null = null;
      let iaZoeUsada = "Gemini";
      let intentos = 0;

      while (intentos < 3 && !dataAnalisis) {
        intentos++;
        setEstadoIA(`ZOE analizando (Intento ${intentos}): Solicitando a Gemini...`);
        
        try {
          const res = await providerPost("/api/chat", { prompt: promptZOE, forzarModelo: "gemini" });
          if (!res.ok) {
            const message = await readApiError(res, `Gemini no pudo analizar (HTTP ${res.status}).`);
            if (res.status === 401 || res.status === 503) throw new Error(message);
            throw new Error(message);
          }
          const data = await res.json();
          if (res.status === 200 && data.gemini) {
            dataAnalisis = extraerJSON(data.gemini) as AnalisisZoe;
            break;
          }
        } catch (e) {
          if (e instanceof Error && (e.message.includes("Supabase") || e.message.includes("sesión") || e.message.includes("Inicia sesión"))) throw e;
          console.error("Fallo Gemini", e);
        }

        setEstadoIA(`Gemini ocupado. Solicitando a Groq...`);
        try {
          const res = await providerPost("/api/chat", { prompt: promptZOE, forzarModelo: "groq" });
          if (!res.ok) {
            const message = await readApiError(res, `Groq no pudo analizar (HTTP ${res.status}).`);
            if (res.status === 401 || res.status === 503) throw new Error(message);
            throw new Error(message);
          }
          const data = await res.json();
          if (res.status === 200 && data.groq) {
            dataAnalisis = extraerJSON(data.groq) as AnalisisZoe;
            iaZoeUsada = "Groq";
            break;
          }
        } catch (e) {
          if (e instanceof Error && (e.message.includes("Supabase") || e.message.includes("sesión") || e.message.includes("Inicia sesión"))) throw e;
          console.error("Fallo Groq", e);
        }

        if (!dataAnalisis && intentos < 3) {
          setEstadoIA(`Ambas IAs ocupadas. Esperando 15s... (Intento ${intentos}/3)`);
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }

      if (!dataAnalisis || !dataAnalisis.analisis) {
        throw new Error("Las IAs están saturadas. No se pudo analizar. Intenta más tarde.");
      }

      const sesionId = Date.now().toString();
      const analisisResultados = dataAnalisis.analisis;
      const ideasCompletas = ideasCrudas.map((idea: any) => {
        const analisis = analisisResultados.find((a: any) => a.titulo === idea.titulo);
        return {
          ...idea,
          viabilidad: analisis?.viabilidad || 0,
          prob_exito: analisis?.prob_exito || 0,
          justificacion_zoe: analisis?.justificacion_zoe || "N/A",
          ia_zoe: iaZoeUsada
        };
      });

      // Guardamos todas las ideas con su análisis en Supabase
      for (const idea of ideasCompletas) {
        await supabase.from("oportunidades").insert({
          sesion_id: sesionId,
          titulo: idea.titulo,
          descripcion: idea.descripcion,
          precio_estimado: idea.precio_estimado,
          competencia: idea.competencia, 
          viabilidad: idea.viabilidad,
          probabilidad_exito: idea.prob_exito,
          analisis_zoe: idea.justificacion_zoe
        });
      }

      setResultadosActuales(ideasCompletas);
      setObjetivo("");
      await cargarHistorial();
      setEstadoIA("");

    } catch (err: any) {
      setError(err.message || "Error conectando.");
      setEstadoIA("");
    } finally {
      setCargando(false);
    }
  };

  const moverAProcesos = async (op: any) => {
    const datosProceso = {
      objetivo: op.titulo, 
      estado: "sin_planificar",
      viabilidad: op.viabilidad || 0,
      probabilidad_exito: op.prob_exito ?? op.probabilidad_exito ?? 0,
      justificacion: op.justificacion_zoe || "N/A",
      resultado: null 
    };

    const { data: pData, error: pError } = await supabase.from("procesos").insert(datosProceso).select().single();
    
    if (!pError && pData) {
      if (op.id) await supabase.from("oportunidades").delete().eq("id", op.id);
      router.push(`/procesos`); 
    }
  };

  const getColor = (val: number) => val >= 60 ? "#10B981" : (val >= 40 ? "#F59E0B" : "#EF4444");

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "white" }}>RADAR: Oportunidades</h1>
      <p style={{ color: "var(--zoe-text-muted)", marginBottom: "1.5rem" }}>RADAR busca, ZOE analiza. Todo el historial se guarda automáticamente.</p>

      <div className="zoe-card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Ej: Ganar 100 dólares en 30 días" style={{ flex: 1, padding: "0.8rem", borderRadius: "0.5rem", border: "1px solid var(--zoe-border)", backgroundColor: "var(--zoe-bg)", color: "white" }} disabled={cargando} />
          <button onClick={buscarYAnalizar} disabled={cargando} className="zoe-gradient-bg" style={{ padding: "0.8rem 1.5rem", borderRadius: "0.5rem", color: "white", fontWeight: 600, border: "none", cursor: cargando ? "not-allowed" : "pointer" }}>
            {cargando ? "Procesando..." : "🔍 Investigar"}
          </button>
        </div>
        {estadoIA && <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#3B82F6" }}>⏳ {estadoIA}</div>}
        {error && <p style={{ color: "#FCA5A5", marginTop: "0.5rem" }}>{error}</p>}
      </div>

      {resultadosActuales.length > 0 && (
        <div style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem", color: "#10B981" }}>Resultados de la búsqueda actual</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            {resultadosActuales.map((op, i) => (
              <div key={i} className="zoe-card" style={{ borderTop: "3px solid #10B981" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "white" }}>{op.titulo}</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--zoe-text-muted)", marginBottom: "1rem" }}>{op.descripcion}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                  <div style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "0.5rem", borderRadius: "0.5rem", textAlign: "center" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--zoe-text-muted)" }}>📊 Viabilidad</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: getColor(op.viabilidad || 0) }}>{op.viabilidad}%</div>
                  </div>
                  <div style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "0.5rem", borderRadius: "0.5rem", textAlign: "center" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--zoe-text-muted)" }}>🎯 Éxito</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: getColor(op.prob_exito || 0) }}>{op.prob_exito}%</div>
                  </div>
                </div>
                <div style={{ fontSize: "0.8rem", marginBottom: "1rem", color: "var(--zoe-text-muted)", fontStyle: "italic" }}>&ldquo;{op.justificacion_zoe}&rdquo;</div>
                <button onClick={() => moverAProcesos(op)} className="zoe-gradient-bg" style={{ width: "100%", padding: "0.6rem", borderRadius: "0.5rem", color: "white", fontWeight: 600, border: "none", cursor: "pointer" }}>Seleccionar para Planificar →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem", color: "white" }}>Historial de Búsquedas</h2>
      {Object.keys(historial).length === 0 ? <p style={{ color: "var(--zoe-text-muted)" }}>No hay investigaciones previas.</p> : 
        Object.entries(historial).map(([sesionId, ideas]) => (
          <div key={sesionId} style={{ marginBottom: "2.5rem" }}>
            <p style={{ fontSize: "0.85rem", color: "#3B82F6", fontWeight: 600, marginBottom: "0.8rem", backgroundColor: "rgba(59, 130, 246, 0.1)", display: "inline-block", padding: "0.2rem 0.6rem", borderRadius: "0.3rem" }}>
              Búsqueda: {new Date(ideas[0].created_at).toLocaleString()}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
              {ideas.map(op => (
                <div key={op.id} className="zoe-card" style={{ borderTop: "2px solid #3B82F6" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "white" }}>{op.titulo}</h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--zoe-text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>{op.descripcion}</p>
                  
                  {/* INFORMACIÓN COMPLETA EN EL HISTORIAL */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                    <div style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "0.5rem", borderRadius: "0.5rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--zoe-text-muted)" }}>📊 Viabilidad</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: getColor(op.viabilidad || 0) }}>{op.viabilidad}%</div>
                    </div>
                    <div style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "0.5rem", borderRadius: "0.5rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--zoe-text-muted)" }}>🎯 Éxito</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: getColor(op.prob_exito ?? op.probabilidad_exito ?? 0) }}>{op.prob_exito ?? op.probabilidad_exito ?? 0}%</div>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", color: "var(--zoe-text-muted)" }}>
                    <span>💰 {op.precio_estimado}</span> 
                    <span>⚔️ {op.competencia}</span>
                  </div>

                  <div style={{ fontSize: "0.8rem", marginBottom: "1rem", color: "var(--zoe-text)", fontStyle: "italic", backgroundColor: "rgba(0,0,0,0.2)", padding: "0.5rem", borderRadius: "0.5rem" }}>
                    &ldquo;{op.justificacion_zoe || op.analisis_zoe}&rdquo;
                  </div>

                  <button onClick={() => moverAProcesos(op)} style={{ marginTop: "auto", width: "100%", padding: "0.6rem", borderRadius: "0.5rem", backgroundColor: "transparent", color: "#3B82F6", border: "1px solid #3B82F6", cursor: "pointer", fontWeight: 600 }}>
                    Seleccionar para Planificar →
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
