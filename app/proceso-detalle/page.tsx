"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { authenticatedPost } from "../../lib/authenticated-fetch";
import Link from "next/link";

interface Tarea {
  id: number;
  titulo: string;
  instrucciones_detalladas: string;
  estado: string;
  orden: number;
  resultado: string | null;
}

function DetalleProcesoContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [objetivo, setObjetivo] = useState("");
  const [error, setError] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [ejecutandoId, setEjecutandoId] = useState<number | null>(null);
  
  // Estado para la barra de progreso por tarea
  const [taskProgress, setTaskProgress] = useState<Record<number, number>>({});

  const isRunning = useRef(false);

  const cargarDatos = useCallback(async () => {
    if (!id) return;
    try {
      const resProc = await supabase.from("procesos").select("objetivo").eq("id", id).single();
      if (resProc.data) setObjetivo(resProc.data.objetivo);

      const resTareas = await supabase.from("tareas").select("*").eq("proceso_id", id).order("orden", { ascending: true });
      if (resTareas.data) setTareas(resTareas.data);
    } catch (err) {
      setError("Error al cargar los datos.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const generarPrompt = (objetivoGral: string, tarea: Tarea, contexto: string) => {
    return `IDENTIDAD:
Eres ZOE, un agente autónomo profesional encargado de ejecutar tareas dentro de un objetivo general.

OBJETIVO GENERAL:
"${objetivoGral}"

CONTEXTO ANTERIOR:
${contexto || "Primera tarea del proyecto."}

TAREA ACTUAL:
"${tarea.titulo}"

INSTRUCCIONES:
"${tarea.instrucciones_detalladas}"

==================================================
1. REGLAS DE EJECUCIÓN
==================================================
1. Ejecuta exclusivamente la tarea asignada.
2. No repitas trabajos anteriores.
3. No inventes datos, cifras, fuentes ni resultados.
4. Distingue entre Hechos, Suposiciones e Información desconocida.
5. Si no tienes herramientas para verificar algo, declara esa limitación.

==================================================
2. FORMATO DE ENTREGA
==================================================
Devuelve el texto con esta estructura EXACTA:
A. RESULTADO: Producto final de la tarea.
B. EVIDENCIAS: Fuentes o pruebas. Si no existen, indícalo.
C. LIMITACIONES: Aspectos no verificados.
D. VALIDACIÓN: Criterios cumplidos.
E. ESTADO: Escribe SOLO una de estas tres opciones: COMPLETADA, PARCIALMENTE COMPLETADA o BLOQUEADA.`;
  };

  // Simulador de progreso (para que el usuario vea que está trabajando)
  const iniciarProgreso = (tareaId: number) => {
    setTaskProgress(prev => ({ ...prev, [tareaId]: 5 }));
    const interval = setInterval(() => {
      setTaskProgress(prev => {
        const actual = prev[tareaId] || 5;
        if (actual >= 95) return prev; // Se queda en 95% hasta que responda
        return { ...prev, [tareaId]: actual + Math.floor(Math.random() * 8) + 2 };
      });
    }, 1000);
    return interval;
  };

  const procesarResultado = async (tareaId: number, textoIA: string, intervalId: NodeJS.Timeout) => {
    clearInterval(intervalId);
    setTaskProgress(prev => ({ ...prev, [tareaId]: 100 }));

    const esCompletada = textoIA.includes("COMPLETADA") && !textoIA.includes("PARCIALMENTE") && !textoIA.includes("BLOQUEADA");
    
    if (esCompletada) {
      await supabase.from("tareas").update({ estado: "completada", resultado: textoIA }).eq("id", tareaId);
      return true;
    } else {
      await supabase.from("tareas").update({ estado: "revisar", resultado: textoIA }).eq("id", tareaId);
      setAutoMode(false); 
      setError("⚠️ El Controlador detuvo ZOE. Revisa el reporte (PARCIAL o BLOQUEADA).");
      return false; 
    }
  };

  useEffect(() => {
    if (!autoMode || isRunning.current || !id) return;
    const tareaPendiente = tareas.find(t => t.estado === "pendiente");

    if (!tareaPendiente) {
      if (autoMode) { setAutoMode(false); alert("¡Todas las tareas completadas!"); }
      return;
    }

    const ejecutarTarea = async () => {
      isRunning.current = true;
      setEjecutandoId(tareaPendiente.id);
      const intervalId = iniciarProgreso(tareaPendiente.id);

      try {
        await supabase.from("tareas").update({ estado: "en_progreso" }).eq("id", tareaPendiente.id);
        await cargarDatos();

        const tareasCompletadas = tareas.filter(t => t.estado === "completada" && t.orden < tareaPendiente.orden);
        const contextoAnterior = tareasCompletadas.map(t => `- Tarea: ${t.titulo}\n  Resultado: ${t.resultado}`).join("\n\n");
        const prompt = generarPrompt(objetivo, tareaPendiente, contextoAnterior);

        const res = await authenticatedPost("/api/chat", { prompt });
        const data = await res.json();

        if (res.status === 429) {
          clearInterval(intervalId);
          setTaskProgress(prev => ({ ...prev, [tareaPendiente.id]: 0 }));
          await supabase.from("tareas").update({ estado: "pendiente" }).eq("id", tareaPendiente.id);
          setAutoMode(false);
          setError("⚠️ Límite de tokens alcanzado.");
          isRunning.current = false;
          setEjecutandoId(null);
          await cargarDatos();
          return;
        }

        const textoIA = data.gemini || data.groq;
        if (data.error || typeof textoIA !== "string") {
          throw new Error(data.error || "La IA no devolvió un resultado de texto.");
        }
        const exito = await procesarResultado(tareaPendiente.id, textoIA, intervalId);

        if (exito) {
          setTimeout(async () => {
            await cargarDatos();
            isRunning.current = false;
            setEjecutandoId(null);
          }, 1500);
        } else {
          isRunning.current = false;
          setEjecutandoId(null);
          await cargarDatos();
        }

      } catch (err) {
        clearInterval(intervalId);
        setTaskProgress(prev => ({ ...prev, [tareaPendiente.id]: 0 }));
        await supabase.from("tareas").update({ estado: "pendiente" }).eq("id", tareaPendiente.id);
        setAutoMode(false);
        setError("Error al ejecutar tarea.");
        isRunning.current = false;
        setEjecutandoId(null);
        await cargarDatos();
      }
    };
    ejecutarTarea();
  }, [autoMode, tareas, id, objetivo, cargarDatos]);

  const ejecutarManual = async (tarea: Tarea) => {
    setEjecutandoId(tarea.id);
    const intervalId = iniciarProgreso(tarea.id);
    await supabase.from("tareas").update({ estado: "en_progreso" }).eq("id", tarea.id);
    await cargarDatos();

    const tareasCompletadas = tareas.filter(t => t.estado === "completada" && t.orden < tarea.orden);
    const contextoAnterior = tareasCompletadas.map(t => `- Tarea: ${t.titulo}\n  Resultado: ${t.resultado}`).join("\n\n");
    const prompt = generarPrompt(objetivo, tarea, contextoAnterior);
    
    const res = await authenticatedPost("/api/chat", { prompt });
    const data = await res.json();
    const textoIA = data.gemini || data.groq;

    if (res.status === 429) {
      clearInterval(intervalId);
      setTaskProgress(prev => ({ ...prev, [tarea.id]: 0 }));
      setError("Límite de tokens alcanzado.");
      await supabase.from("tareas").update({ estado: "pendiente" }).eq("id", tarea.id);
    } else if (!data.error && typeof textoIA === "string") {
      await procesarResultado(tarea.id, textoIA, intervalId);
    } else {
      clearInterval(intervalId);
      setTaskProgress(prev => ({ ...prev, [tarea.id]: 0 }));
      setError(data.error || "La IA no devolvió un resultado de texto.");
      await supabase.from("tareas").update({ estado: "pendiente" }).eq("id", tarea.id);
    }
    
    setEjecutandoId(null);
    await cargarDatos();
  };

  if (cargando) return <p style={{ color: "white", padding: "2rem" }}>Cargando tareas...</p>;
  if (!id) return <p style={{ color: "white", padding: "2rem" }}>No se ha seleccionado un proyecto válido.</p>;

  const completadas = tareas.filter(t => t.estado === "completada").length;
  const total = tareas.length;
  const progresoGlobal = total === 0 ? 0 : Math.round((completadas / total) * 100);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.25rem" }}>
      <Link href="/procesos" style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)", textDecoration: "none" }}>
        ← Volver a Procesos
      </Link>

      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "1rem" }}>Ejecución Autónoma</h1>
      <p style={{ color: "var(--zoe-fuchsia)", fontWeight: 600, marginBottom: "1rem" }}>🎯 {objetivo}</p>

      {/* PANEL DE CONTROL */}
      <div className="zoe-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", border: autoMode ? "1px solid #10B981" : "1px solid var(--zoe-border)" }}>
        <div>
          <strong style={{ color: autoMode ? "#10B981" : "var(--zoe-text)" }}>🤖 Modo Automático</strong>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--zoe-text-muted)" }}>ZOE ejecutará y auditará cada paso.</p>
        </div>
        <button 
          onClick={() => setAutoMode(!autoMode)}
          style={{ padding: "0.5rem 1.5rem", borderRadius: "999px", border: "none", cursor: "pointer", fontWeight: 700, backgroundColor: autoMode ? "#10B981" : "rgba(255,255,255,0.1)", color: autoMode ? "white" : "var(--zoe-text-muted)", transition: "all 0.3s" }}
        >
          {autoMode ? "ENCENDIDO" : "APAGADO"}
        </button>
      </div>

      {error && <div style={{ padding: "1rem", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid #EF4444", color: "#FCA5A5", borderRadius: "0.5rem", marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}

      {/* PROGRESO GLOBAL */}
      <div className="zoe-card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "var(--zoe-text)" }}>
          <strong>Progreso del Proyecto</strong>
          <span>{completadas} de {total} tareas ({progresoGlobal}%)</span>
        </div>
        <div style={{ width: "100%", height: "12px", backgroundColor: "var(--zoe-bg)", borderRadius: "999px", overflow: "hidden", border: "1px solid var(--zoe-border)" }}>
          <div style={{ width: `${progresoGlobal}%`, height: "100%", backgroundColor: progresoGlobal === 100 ? "#10B981" : "var(--zoe-fuchsia)", transition: "width 0.3s" }} />
        </div>
      </div>

      {/* LISTA DE TAREAS TIPO CHECKLIST */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {tareas.map((t) => {
          const p = taskProgress[t.id] || 0;
          const isRunningTask = t.estado === "en_progreso";

          return (
            <div key={t.id} className="zoe-card" style={{ padding: "1rem", borderLeft: `4px solid ${t.estado === "completada" ? "#10B981" : (t.estado === "revisar" ? "#F59E0B" : (isRunningTask ? "#3B82F6" : "var(--zoe-border)"))}` }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: t.estado === "completada" ? "var(--zoe-text-muted)" : "var(--zoe-text)" }}>
                    {t.estado === "completada" ? "✅" : (isRunningTask ? "⏳" : "⚪")} 
                    <span style={{ textDecoration: t.estado === "completada" ? "line-through" : "none" }}>{t.orden}. {t.titulo}</span>
                  </h3>
                </div>
                
                {/* BOTONES DE ACCIÓN */}
                {t.estado !== "completada" && (
                  <button 
                    onClick={() => ejecutarManual(t)}
                    disabled={ejecutandoId === t.id || autoMode}
                    style={{ padding: "0.4rem 1rem", borderRadius: "0.5rem", border: "none", cursor: (ejecutandoId === t.id || autoMode) ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.8rem", backgroundColor: t.estado === "revisar" ? "#F59E0B" : "rgba(217, 70, 239, 0.2)", color: t.estado === "revisar" ? "white" : "var(--zoe-fuchsia)", opacity: (ejecutandoId === t.id || autoMode) ? 0.5 : 1 }}
                  >
                    {ejecutandoId === t.id ? "..." : (t.estado === "revisar" ? "Reintentar" : "Ejecutar")}
                  </button>
                )}
              </div>

              {/* BARRA DE PROGRESO POR TAREA (Solo visible si se está ejecutando) */}
              {isRunningTask && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#3B82F6", marginBottom: "0.2rem" }}>
                    <span>Procesando con IA...</span>
                    <span>{p}%</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "var(--zoe-bg)", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ width: `${p}%`, height: "100%", backgroundColor: "#3B82F6", transition: "width 0.5s" }} />
                  </div>
                </div>
              )}

              {/* RESULTADO OCULTO (Solo se ve si el usuario lo pide) */}
              {t.resultado && (
                <details style={{ marginTop: "0.75rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.75rem", color: "var(--zoe-fuchsia)", fontWeight: 600, userSelect: "none" }}>
                    📄 Ver reporte detallado
                  </summary>
                  <div style={{ marginTop: "0.5rem", padding: "1rem", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: "0.5rem", borderLeft: `3px solid ${t.estado === "revisar" ? "#F59E0B" : "var(--zoe-fuchsia)"}`, fontSize: "0.8rem", whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "monospace" }}>
                    {t.resultado}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DetalleProceso() {
  return (
    <Suspense fallback={<div style={{ color: "white", padding: "2rem" }}>Cargando...</div>}>
      <DetalleProcesoContent />
    </Suspense>
  );
}
