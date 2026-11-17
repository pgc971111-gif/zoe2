"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "../lib/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside style={{ width: "250px", minWidth: "250px", borderRight: "1px solid var(--zoe-border)", padding: "1.5rem 1rem", backgroundColor: "rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: "0.5rem", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ paddingBottom: "1.5rem", borderBottom: "1px solid var(--zoe-border)", marginBottom: "1rem" }}>
        <Link href="/inicio" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
          <div className="zoe-gradient-bg" style={{ width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "1.2rem" }}>Z</div>
          <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "white" }}>ZOE</span>
        </Link>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.2rem", overflowY: "auto" }}>
        {MODULES.map((mod) => {
          const isActive = pathname === (mod.href || `/modulo?m=${mod.slug}`);
          return (
            <Link key={mod.id} href={mod.href || `/modulo?m=${mod.slug}`}
              style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", textDecoration: "none", backgroundColor: isActive ? "rgba(217, 70, 239, 0.15)" : "transparent", color: isActive ? "var(--zoe-fuchsia)" : "var(--zoe-text-muted)", fontWeight: isActive ? 600 : 400, fontSize: "0.9rem", transition: "all 0.2s" }}>
              {mod.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}