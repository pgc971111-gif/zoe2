"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function IntegracionesPage() {
  const [nombre, setNombre] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [estado, setEstado] = useState("");
  const [lista, setLista] = useState<any[]>([]);

  const cargarIntegraciones = async () => {
    const { data } = await supabase.from("integraciones").select("*").order("created_at", { ascending: false });
    if (data) setLista(data);
  };

  useEffect(() => { cargarIntegraciones(); }, []);

  const guardarYProbar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado("Probando conexión...");
    
    // PRUEBA RÁPIDA (Simulada por ahora, en Codespaces se puede verificar real)
    if (nombre.toLowerCase() === "tavily") {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey, query: "test", max_results: 1 })
        });
        if (!res.ok) throw new Error("Fallo");
      } catch (e) { setEstado("❌ Clave de Tavily inválida o error de red."); return; }
    }

    // Guardar en Supabase
    const { error } = await supabase.from("integraciones").insert({ nombre, api_key: apiKey, estado: "activa" });
    if (error) { setEstado("❌ Error guardando en BD"); } 
    else {
      setEstado("✅ Integración guardada y probada con éxito.");
      setNombre(""); setApiKey("");
      await cargarIntegraciones();
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800 }}>Integraciones y API Keys</h1>
      <p style={{ color: "var(--zoe-text-muted)", marginBottom: "1.5rem" }}>Configura tus claves de servicios externos. El sistema las usará automáticamente.</p>

      <form onSubmit={guardarYProbar} className="zoe-card" style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del servicio (Ej: Tavily)" required style={{ padding: "0.8rem", borderRadius: "0.5rem", border: "1px solid var(--zoe-border)", backgroundColor: "var(--zoe-bg)", color: "white" }} />
        <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Pega tu API Key aquí" required style={{ padding: "0.8rem", borderRadius: "0.5rem", border: "1px solid var(--zoe-border)", backgroundColor: "var(--zoe-bg)", color: "white" }} />
        <button type="submit" className="zoe-gradient-bg" style={{ padding: "0.8rem", borderRadius: "0.5rem", color: "white", fontWeight: 600, border: "none", cursor: "pointer" }}>Probar y Guardar</button>
        {estado && <p style={{ textAlign: "center", fontSize: "0.85rem", color: estado.includes("✅") ? "#10B981" : "#FCA5A5" }}>{estado}</p>}
      </form>

      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>Mis Integraciones</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {lista.map(item => (
          <div key={item.id} className="zoe-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ color: "white" }}>{item.nombre}</strong>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--zoe-text-muted)" }}>API Key: ••••••{item.api_key.slice(-4)}</p>
            </div>
            <span style={{ fontSize: "0.75rem", backgroundColor: "rgba(16,185,129,0.2)", color: "#10B981", padding: "0.2rem 0.5rem", borderRadius: "999px" }}>{item.estado}</span>
          </div>
        ))}
      </div>
    </div>
  );
}