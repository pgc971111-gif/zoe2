import { MODULES } from "../../lib/navigation";

export default function InicioPage() {
  // Calculamos el progreso real basado en los módulos listos
  const modulosListos = MODULES.filter((m) => m.status === "ready").length;
  const totalModulos = MODULES.length;
  const porcentajeAvance = Math.round((modulosListos / totalModulos) * 100);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh" }}>
      
      <div className="zoe-card" style={{ width: "100%", padding: "4rem 2rem", textAlign: "center", background: "linear-gradient(135deg, #181226 0%, #0B0714 100%)" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "white", marginBottom: "0.5rem" }}>Estado de ZOE</h1>
        <p style={{ color: "var(--zoe-text-muted)", marginBottom: "3rem" }}>Plataforma de Agentes Autónomos</p>

        {/* GRÁFICO CIRCULAR GIGANTE */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ 
            width: "200px", height: "200px", borderRadius: "50%", 
            background: `conic-gradient(var(--zoe-fuchsia) ${porcentajeAvance}%, rgba(255,255,255,0.05) 0)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px rgba(217, 70, 239, 0.2)"
          }}>
            <div style={{ width: "160px", height: "160px", borderRadius: "50%", backgroundColor: "#151020", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "3.5rem", fontWeight: 800, color: "white" }}>{porcentajeAvance}%</span>
              <span style={{ fontSize: "0.85rem", color: "var(--zoe-text-muted)" }}>Desarrollado</span>
            </div>
          </div>
          
          <div style={{ marginTop: "2rem", display: "flex", gap: "2rem" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#10B981" }}>{modulosListos}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--zoe-text-muted)" }}>Módulos Listos</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#3B82F6" }}>{totalModulos - modulosListos}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--zoe-text-muted)" }}>En Desarrollo</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}