"use client";

import React, { useState } from "react";
import Link from "next/link";
import { authenticatedPost } from "../../lib/authenticated-fetch";

export default function LaboratorioIA() {
  const [prompt, setPrompt] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState<{ gemini?: string; groq?: string } | null>(null);

  const probarIA = async () => {
    if (!prompt.trim()) return;
    setCargando(true);
    setResultados(null);

    try {
      const res = await authenticatedPost("/api/chat", { prompt });
      const data = await res.json();
      setResultados(data);
    } catch (error) {
      alert("Error conectando con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.25rem" }}>
      <Link href="/inicio" style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)", textDecoration: "none" }}>
        ← Volver al panel
      </Link>

      <h1 style={{ fontSize: "2rem", fontWeight: 800, marginTop: "1rem" }}>Laboratorio de IA</h1>
      <p style={{ color: "var(--zoe-text-muted)", marginBottom: "2rem" }}>
        Comprueba que los modelos están respondiendo antes de asignarles tareas.
      </p>

      <div className="zoe-card" style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Mensaje de prueba para ZOE:</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej: Dime en una frase qué eres y cómo ayudas."
            style={{ flex: 1, padding: "0.6rem", borderRadius: "0.5rem", border: "1px solid var(--zoe-border)", backgroundColor: "var(--zoe-bg)", color: "white" }}
            onKeyDown={(e) => e.key === "Enter" && probarIA()}
          />
          <button 
            onClick={probarIA} 
            disabled={cargando || !prompt.trim()} 
            className="zoe-gradient-bg" 
            style={{ padding: "0.6rem 1.2rem", borderRadius: "0.5rem", color: "white", fontWeight: 600, border: "none", cursor: cargando ? "not-allowed" : "pointer" }}
          >
            {cargando ? "Probando..." : "Probar ambas IAs"}
          </button>
        </div>
      </div>

      {(resultados || cargando) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
          
          <div className="zoe-card" style={{ borderTop: "4px solid #4285F4" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#4285F4" }}>Google Gemini</h2>
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--zoe-text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {cargando ? "⏳ Pensando..." : resultados?.gemini || "Sin respuesta"}
            </div>
          </div>

          <div className="zoe-card" style={{ borderTop: "4px solid #F55036" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F55036" }}>Groq (Llama 3)</h2>
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--zoe-text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {cargando ? "⏳ Pensando..." : resultados?.groq || "Sin respuesta"}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
