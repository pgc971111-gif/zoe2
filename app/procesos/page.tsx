"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

interface Proceso {
  id: number;
  created_at: string;
  objetivo: string;
  estado: string;
  resultado: string | null;
  viabilidad: number;
  probabilidad_exito: number;
  justificacion: string;
}

interface Escenario {
  inversion_total: number;
  viabilidad: { valor: number; explicacion: string };
  probabilidad_exito: { valor: number; explicacion: string };
  herramientas: string[];
  desglose: { item: string; costo: number }[];
}

interface AnalisisData {
  investigado_por: string;
  escenario_cero: Escenario;
  escenario_maximo: Escenario;
  tiempo_primer_cliente: string;
  tareas: { titulo: string; instrucciones_detalladas: string; orden: number }[];
  conclusion: string;
  siguiente_paso: string;
}

export default function ProcesosPage() {
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [tabActiva, setTabActiva] = useState<Record<number, 'cero' | 'maximo'>>({});
  const [generandoId, setGenerandoId] = useState<number | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [mensajeEstado, setMensajeEstado] = useState("");

  const cargarProcesos = async () => {
    const { data } = await supabase.from("procesos").select("*").order("created_at", { ascending: false });
    if (data) setProcesos(data);
  };

  useEffect(() => { cargarProcesos(); }, []);

  const generarPlanProfundo = async (p: Proceso) => {
    setGenerandoId(p.id);
    setProgreso(10);
    setMensajeEstado("ZOE está analizando escenarios de inversión...");

    try {
      const maxInversion = 50;
      const prompt = `Eres ZOE. Objetivo: "${p.objetivo}". 
      Genera un plan de ejecución comparando dos escenarios.
      JSON requerido: { "escenario_cero": { "inversion_total": 0, "viabilidad": { "valor": 80, "explicacion": "..." }, "probabilidad_exito": { "valor": 60, "explicacion": "..." }, "herramientas": ["..."], "desglose": [ {"item": "...", "costo": 0} ] }, "escenario_maximo": { "inversion_total": 50, "viabilidad": { "valor": 90, "explicacion": "..." }, "probabilidad_exito": { "valor": 85, "explicacion": "..." }, "herramientas": ["..."], "desglose": [ {"item": "...", "costo": 10} ] }, "tiempo_primer_cliente": "2 semanas", "tareas": [ { "titulo": "Tarea 1", "instrucciones_detalladas": "...", "orden": 1 } ], "conclusion": "...", "siguiente_paso": "..." }`;
      
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      setProgreso(50);
      setMensajeEstado("Calculando herramientas y tareas...");

      const data = await res.json();
      const texto = data.gemini || data.groq;
      if (!texto) throw new Error("IA falló");

      const inicio = texto.indexOf('{'); const fin = texto.lastIndexOf('}');
      const dataJSON = JSON.parse(texto.substring(inicio, fin + 1));
      dataJSON.investigado_por = data.modelo_usado || "ZOE IA";

      setProgreso(80);
      setMensajeEstado("Guardando tareas en la base de datos...");

      // Actualizar proceso con el JSON del plan
      await supabase.from("procesos").update({ 
        estado: "planificado", 
        resultado: JSON.stringify(dataJSON) 
      }).eq("id", p.id);

      // Insertar tareas
      if (dataJSON.tareas) {
        for (const t of dataJSON.tareas) {
          await supabase.from("tareas").insert({ 
            proceso_id: p.id, 
            titulo: t.titulo, 
            instrucciones_detalladas: t.instrucciones_detalladas, 
            estado: 'pendiente', 
            orden: t.orden 
          });
        }
      }

      await cargarProcesos();
      setProgreso(100);
      setTimeout(() => { setGenerandoId(null); setProgreso(0); setMensajeEstado(""); }, 1000);

    } catch (err) {
      alert("Error generando el plan. Intenta de nuevo.");
      setGenerandoId(null); setProgreso(0); setMensajeEstado("");
    }
  };

  const getColor = (val: number) => val >= 60 ? "#10B981" : (val >= 40 ? "#F59E0B" : "#EF4444");

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "white" }}>ZOE: Procesos</h1>
      <p style={{ color: "var(--zoe-text-muted)", marginBottom: "1.5rem" }}>Aquí se gestionan las ideas seleccionadas y se generan los planes de ejecución.</p>

      {procesos.length === 0 ? <p style={{ color: "var(--zoe-text-muted)" }}>No hay procesos. Ve a Oportunidades para buscar ideas.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {procesos.map((p) => {
            let data: AnalisisData | null = null;
            try { data = p.resultado ? JSON.parse(p.resultado) : null; } catch (e) { data = null; }

            const tab = tabActiva[p.id] || 'cero';
            const escenario = data ? (tab === 'cero' ? data.escenario_cero : data.escenario_maximo) : null;

            return (
              <div key={p.id} className="zoe-card" style={{ padding: "1.5rem", borderTop: "4px solid var(--zoe-fuchsia)" }}>
                
                {/* CABECERA CON DATOS HEREDADOS DE OPORTUNIDADES */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: "1.25rem", margin: 0, color: "white" }}>🎯 {p.objetivo}</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)", marginTop: "0.3rem", fontStyle: "italic" }}>"{p.justificacion}"</p>
                  </div>
                  {data && (
                    <Link href={`/proceso-detalle?id=${p.id}`} style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", borderRadius: "0.5rem", border: "1px solid #10B981", color: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.1)", textDecoration: "none", fontWeight: 600 }}>📋 Gestionar Tareas</Link>
                  )}
                </div>

                {/* MOSTRAR DATOS HEREDADOS (Siempre visibles) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                  <div style={{ backgroundColor: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "1rem", border: "1px solid var(--zoe-border)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)", marginBottom: "0.5rem" }}>📊 Viabilidad (Inicial)</div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: getColor(p.viabilidad) }}>{p.viabilidad}%</div>
                  </div>
                  <div style={{ backgroundColor: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "1rem", border: "1px solid var(--zoe-border)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)", marginBottom: "0.5rem" }}>🎯 Éxito (Inicial)</div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: getColor(p.probabilidad_exito) }}>{p.probabilidad_exito}%</div>
                  </div>
                </div>

                {/* SI NO HAY PLAN, MOSTRAR BOTÓN */}
                {!data && generandoId !== p.id && (
                  <button onClick={() => generarPlanProfundo(p)} className="zoe-gradient-bg" style={{ width: "100%", padding: "0.8rem", borderRadius: "0.5rem", color: "white", fontWeight: 600, border: "none", cursor: "pointer" }}>
                    ⚙️ Generar Plan de Tareas y Escenarios
                  </button>
                )}

                {/* BARRA DE PROGRESO SI ESTÁ GENERANDO */}
                {generandoId === p.id && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem", color: "#3B82F6" }}>
                      <span>{mensajeEstado}</span>
                      <span>{progreso}%</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", backgroundColor: "var(--zoe-bg)", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${progreso}%`, height: "100%", backgroundColor: "#3B82F6", transition: "width 0.3s" }} />
                    </div>
                  </div>
                )}

                {/* SI HAY PLAN, MOSTRAR ESCENARIOS (Cero vs Máximo) */}
                {data && escenario && (
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", backgroundColor: "rgba(0,0,0,0.2)", padding: "0.3rem", borderRadius: "0.75rem", width: "fit-content" }}>
                      <button onClick={() => setTabActiva({...tabActiva, [p.id]: 'cero'})} style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", backgroundColor: tab === 'cero' ? "#10B981" : "transparent", color: tab === 'cero' ? "white" : "var(--zoe-text-muted)" }}>🌱 Inversión Cero</button>
                      <button onClick={() => setTabActiva({...tabActiva, [p.id]: 'maximo'})} style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", backgroundColor: tab === 'maximo' ? "var(--zoe-fuchsia)" : "transparent", color: tab === 'maximo' ? "white" : "var(--zoe-text-muted)" }}>💎 Inversión Máxima</button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "1rem", border: "1px solid var(--zoe-border)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)", marginBottom: "0.5rem" }}>📊 Viabilidad del Plan</div>
                        <div style={{ fontSize: "2rem", fontWeight: 800, color: getColor(escenario.viabilidad.valor) }}>{escenario.viabilidad.valor}%</div>
                      </div>
                      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "1rem", border: "1px solid var(--zoe-border)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)", marginBottom: "0.5rem" }}>🎯 Éxito del Plan</div>
                        <div style={{ fontSize: "2rem", fontWeight: 800, color: getColor(escenario.probabilidad_exito.valor) }}>{escenario.probabilidad_exito.valor}%</div>
                      </div>
                      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "1rem", border: "1px solid var(--zoe-border)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)", marginBottom: "0.5rem" }}>💰 Inversión</div>
                        <div style={{ fontSize: "2rem", fontWeight: 800, color: escenario.inversion_total === 0 ? "#10B981" : "#F59E0B" }}>${escenario.inversion_total}</div>
                      </div>
                    </div>

                    <details>
                      <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "var(--zoe-fuchsia)", fontWeight: 600 }}>Ver conclusión y desglose</summary>
                      <p style={{ fontSize: "0.9rem", color: "var(--zoe-text)", fontStyle: "italic", marginTop: "1rem" }}>"{data.conclusion}"</p>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}