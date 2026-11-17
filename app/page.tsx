import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <div className="zoe-gradient-bg" style={{ width: "64px", height: "64px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 700, color: "#FFFFFF", marginBottom: "1.5rem" }}>
        Z
      </div>

      <h1 style={{ fontSize: "clamp(2.5rem, 8vw, 4.5rem)", fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
        <span className="zoe-gradient-text">ZOE</span>
      </h1>

      <p style={{ marginTop: "1rem", maxWidth: "520px", fontSize: "1.05rem", color: "var(--zoe-text-muted)", lineHeight: 1.6 }}>
        Plataforma de agentes de inteligencia artificial para generar ingresos reales.
      </p>

      <Link href="/inicio" className="zoe-gradient-bg" style={{ marginTop: "2rem", display: "inline-block", padding: "0.75rem 1.5rem", borderRadius: "0.75rem", color: "#FFFFFF", fontWeight: 600, textDecoration: "none", fontSize: "0.95rem" }}>
        Entrar al panel →
      </Link>
    </main>
  );
}