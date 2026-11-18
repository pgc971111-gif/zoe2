"use client";

const providers = [
  ["TAVILY_API_KEY", "Búsqueda web primaria"],
  ["FIRECRAWL_API_KEY", "Búsqueda web alternativa"],
  ["GEMINI_API_KEY", "Análisis y planificación primaria"],
  ["GROQ_API_KEY", "Análisis y planificación alternativa"],
];

export default function IntegracionesPage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800 }}>Integraciones</h1>
      <section className="zoe-card">
        <h2 style={{ marginTop: 0 }}>Claves de proveedores</h2>
        <p style={{ color: "var(--zoe-text-muted)" }}>
          RADAR y ZOE leen estas claves directamente desde el archivo <code>.env</code> del servidor. No necesitas crear usuario ni iniciar sesión, y las claves no se guardan en Supabase.
        </p>
        <ul style={{ lineHeight: 2 }}>
          {providers.map(([key, label]) => <li key={key}><code>{key}</code> — {label}</li>)}
        </ul>
        <p style={{ color: "var(--zoe-text-muted)" }}>
          Edita <code>.env</code> en la carpeta del proyecto y reinicia el servidor para aplicar cambios. No compartas ese archivo ni lo subas a GitHub.
        </p>
        <p style={{ color: "var(--zoe-text-muted)", marginBottom: 0 }}>
          Supabase permanece conectado para guardar oportunidades y procesos; este módulo no consulta Vault para obtener claves de proveedores.
        </p>
      </section>
    </main>
  );
}
