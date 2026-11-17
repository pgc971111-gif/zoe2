export type ModuleStatus = "pending" | "in-progress" | "ready";

export interface ZoeModule {
  id: string;
  slug: string;
  name: string;
  description: string;
  phase: number;
  status: ModuleStatus;
  href?: string;
}

export const MODULES: ZoeModule[] = [
  { id: "inicio", slug: "inicio", name: "Inicio", description: "Panel general de ZOE.", phase: 1, status: "ready", href: "/inicio" },
  { id: "oportunidades", slug: "oportunidades", name: "Oportunidades", description: "Investigación de nichos y viabilidad de ideas (RADAR).", phase: 2, status: "ready", href: "/oportunidades" },
  { id: "procesos", slug: "procesos", name: "Procesos", description: "Motor central de agentes y ejecución de tareas.", phase: 1, status: "ready", href: "/procesos" },
  { id: "habilidades", slug: "habilidades", name: "Habilidades", description: "Capacidades verificadas y herramientas de FACTORY.", phase: 2, status: "pending" },
  { id: "trabajos", slug: "trabajos", name: "Trabajos", description: "Proyectos en ejecución y entregas.", phase: 3, status: "pending" },
  { id: "finanzas", slug: "finanzas", name: "Finanzas", description: "Ingresos, gastos y balance.", phase: 3, status: "pending" },
  { id: "integraciones", slug: "integraciones", name: "Integraciones", description: "Conexiones con APIs y servicios externos (API Keys).", phase: 3, status: "ready", href: "/integraciones" },
  { id: "explorador", slug: "explorador", name: "Explorador Web", description: "Navegador autónomo y control de sesiones.", phase: 4, status: "pending" },
  { id: "automatizaciones", slug: "automatizaciones", name: "Automatizaciones", description: "Tareas en segundo plano 24/7.", phase: 4, status: "pending" },
  { id: "historial", slug: "historial", name: "Historial", description: "Registro de toda la actividad.", phase: 4, status: "pending" },
  { id: "seguridad", slug: "seguridad", name: "Seguridad", description: "Permisos, auditoría y control de riesgos.", phase: 5, status: "pending" },
  { id: "configuracion", slug: "configuracion", name: "Configuración", description: "Ajustes generales de la plataforma.", phase: 5, status: "pending" },
];

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  pending: "Pendiente",
  "in-progress": "En proceso",
  ready: "Listo",
};

export const STATUS_COLOR: Record<ModuleStatus, string> = {
  pending: "#7E7099",
  "in-progress": "#D946EF",
  ready: "#10B981",
};