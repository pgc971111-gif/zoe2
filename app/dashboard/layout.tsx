"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, STATUS_COLOR } from "../../lib/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--zoe-bg)" }}>
      
      {/* BARRA LATERAL IZQUIERDA */}
      <aside style={{ width: "260px", borderRight: "1px solid var(--zoe-border)", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem", backgroundColor: "rgba(0,0,0,0.2)" }}>
        <div style={{ paddingBottom: "1.5rem", borderBottom: "1px solid var(--zoe-border)", marginBottom: "1rem" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
            <div className="zoe-gradient-bg" style={{ width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold" }}>Z</div>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "white" }}>ZOE</span>
          </Link>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "0.2rem", overflowY: "auto" }}>
          {MODULES.map((mod) => {
            const isActive = pathname === (mod.href || `/modulo?m=${mod.slug}`);
            return (
              <Link
                key={mod.id}
                href={mod.href || `/modulo?m=${mod.slug}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.75rem 1rem", borderRadius: "0.5rem", textDecoration: "none",
                  backgroundColor: isActive ? "rgba(217, 70, 239, 0.15)" : "transparent",
                  color: isActive ? "var(--zoe-fuchsia)" : "var(--zoe-text-muted)",
                  fontWeight: isActive ? 600 : 400,
                  transition: "all 0.2s"
                }}
              >
                <span style={{ fontSize: "0.9rem" }}>{mod.name}</span>
                {mod.status === "ready" && (
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: STATUS_COLOR.ready }} title="Módulo Activo" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}