"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";

/* ─────────────────────────────────────────────────
   TYPES & CONSTANTS
───────────────────────────────────────────────── */
type Theme = "dark" | "light";
type Lang = "en" | "es";

const T = {
  en: {
    brand: "SERP HAWK CRM",
    showcase: "Product Showcase",
    startTour: "Start Tour",
    launchCRM: "Launch CRM",
    guidedTour: "Guided Tour",
    sectionOf: (step: number, total: number) => `Section ${step} of ${total}`,
    heroLabel: "SERP Hawk — CRM Platform",
    heroTitle: "The Intelligent CRM Built for Growth.",
    heroSub: "From discovering prospects to closing deals, automating workflows, and retaining customers — your entire customer lifecycle, automated and connected.",
    startGuidedTour: "Start Guided Tour",
    crmModules: "CRM Modules",
    automated: "Automated",
    currencies: "Currencies",
    module: "Module",
    journeyLabel: "Complete Journey",
    journeyTitle: "One customer. Fifteen automated steps. Zero manual work.",
    modulesLabel: "All Modules",
    modulesTitle: "21 modules. One platform.",
    impactLabel: "Business Impact",
    impactTitle: "Results your team will feel immediately.",
    impactSub: "SERP HAWK CRM replaces your spreadsheets, email threads, reminder notes and disconnected tools with a single, automated system that works around the clock.",
    ctaTitle: "Ready to see it in action?",
    ctaSub: "The SERP HAWK CRM is live and ready for your team. Login to experience the full platform — or book a personal demo on WhatsApp.",
    bookDemo: "Book a Demo",
    platformOverview: "Platform Overview",
    switchToWhite: "Switch to White Mode",
    switchToBlack: "Switch to Black Mode",
    footer: "© 2026 SERP HAWK · Intelligent CRM Platform",
    impactItems: [
      ["80%", "Reduction in manual work"],
      ["3×", "Faster lead response time"],
      ["100%", "Follow-up consistency"],
      ["360°", "Complete customer visibility"],
      ["2×", "Sales team productivity"],
      ["Zero", "Leads falling through the cracks"],
    ] as [string, string][],
    sections: [
      { title: "Lead Management — Capture, Qualify, Convert.", sub: "Every lead from every source — website forms, manual entry, or Radar Analysis — enters a structured, automated qualification pipeline. No spreadsheets. No missed opportunities." },
      { title: "Sales Pipeline — Every Deal. Every Stage. In Motion.", sub: "A visual kanban pipeline that tracks deals from first contact to closed won. Stage changes trigger automatic actions — tasks, notifications, invoices — without manual work." },
      { title: "Radar Analysis — Find Your Next Client Before They Find You.", sub: "Discover high-potential prospects by location, market size, team size, or services. The CRM maps your target area, identifies top businesses, and adds them to your pipeline in one click." },
      { title: "AI Email Agent — Personalized Outreach at Scale.", sub: "The AI agent studies each lead's profile, conversation history, and stage — then drafts a precise, personalized email in seconds. Your team reviews. The CRM sends, tracks, and follows up." },
      { title: "Automation Engine — Your CRM Works While You Sleep.", sub: "Define once. Run forever. Trigger-based workflows execute automatically across your entire operation — from assigning new leads to onboarding won customers — without a single manual step." },
      { title: "Communication Hub — Every Message. One Timeline.", sub: "Email, WhatsApp, and internal notes — all unified in a single chronological thread per client. Every conversation is automatically recorded, tagged, and made visible to your entire team." },
      { title: "Analytics — Real Intelligence. Not Just Numbers.", sub: "Live dashboards that show lead growth, conversion rates, pipeline velocity, team performance, and revenue — updated in real time. Data-driven decisions for every level of your business." },
      { title: "Client 360° — One Profile. Complete Picture.", sub: "Every client record connects deals, messages, tasks, documents, invoices, and support cases in a single view. Anyone on your team can pick up any client conversation — immediately, completely." },
    ] as { title: string; sub: string }[],
    journeySteps: [
      ["01", "Prospect Discovered", "Radar Analysis"],
      ["02", "Lead Added to CRM", "Auto-intake"],
      ["03", "Data Enriched", "Profile built"],
      ["04", "Lead Qualified", "Scoring applied"],
      ["05", "Owner Assigned", "Auto-routing"],
      ["06", "Follow-up Created", "Task automation"],
      ["07", "Communication Started", "Email + WhatsApp"],
      ["08", "Opportunity Created", "Pipeline entry"],
      ["09", "Proposal Sent", "AI-generated"],
      ["10", "Deal Won", "Conversion event"],
      ["11", "Customer Onboarded", "Status updated"],
      ["12", "Invoice Generated", "INR or MXN"],
      ["13", "Support Case Opened", "Issue tracked"],
      ["14", "Resolution Applied", "Knowledge base"],
      ["15", "Analytics Updated", "Business intelligence"],
    ] as [string, string, string][],
    modules: [
      ["Lead Management", "Capture, qualify & track every lead through a structured lifecycle with automated routing."],
      ["Contact Management", "Rich contact profiles linked to companies, leads, deals and communication history."],
      ["Client Management", "360° customer view — deals, history, communications, tasks and documents."],
      ["Sales Pipeline", "Visual kanban pipeline with deal probability, value and automated stage actions."],
      ["Radar Analysis", "Discover high-potential prospects by location, market size, team size and services."],
      ["Communication Hub", "Email, WhatsApp and internal notes — unified in one threaded timeline per client."],
      ["Automation Engine", "Trigger-based workflows that run automatically on any CRM event."],
      ["Tasks & Follow-ups", "Smart task management with deadlines, priorities and auto-reminders."],
      ["Support Cases", "Full case lifecycle — issue creation, assignment, resolution and customer history."],
      ["Proposals", "Create, send and track professional proposals with e-signature capability."],
      ["Projects", "Track deliverables, milestones and team workloads across all client projects."],
      ["Documents", "Centralized file management linked to clients, deals and support cases."],
      ["Billing & Invoices", "Generate formal invoices for SERP Hawk in INR or DaPros in MXN."],
      ["Product Catalog", "Service catalog with dual-currency pricing in MXN and INR."],
      ["Meetings", "Schedule, track and record all client and internal meetings."],
      ["Notifications", "Real-time smart alerts for every task, lead, deal and system event."],
      ["Reports & Rankings", "Team performance analytics, lead sources, conversion and KPI dashboards."],
      ["AI Email Agent", "AI-powered email drafting, personalization, sequencing and follow-up automation."],
      ["Sales Manager View", "Executive-level revenue, pipeline, team and forecasting dashboards."],
      ["Team Management", "Org structure, roles, permissions and individual performance tracking."],
      ["Orders", "Order management linked to clients, products, catalog and billing."],
    ] as [string, string][],
    platformItems: [
      ["21 CRM Modules", "Complete, connected, ready to use"],
      ["Dual Currency", "INR for SERP Hawk · MXN for DaPros"],
      ["WhatsApp Integration", "Messages linked to client profiles"],
      ["AI Email Agent", "Drafts and sends personalized outreach"],
      ["Radar Analysis", "Prospect discovery and market intelligence"],
      ["Automation Engine", "Trigger-based workflows, zero manual work"],
    ] as [string, string][],
    tickerItems: ["Lead Management", "Sales Pipeline", "Radar Analysis", "AI Email Agent", "Automation Engine", "Communication Hub", "Client 360°", "Analytics", "Invoice Generation", "Support Cases", "Team Management"],
  },
  es: {
    brand: "SERP HAWK CRM",
    showcase: "Demostración del Producto",
    startTour: "Iniciar Tour",
    launchCRM: "Abrir CRM",
    guidedTour: "Tour Guiado",
    sectionOf: (step: number, total: number) => `Sección ${step} de ${total}`,
    heroLabel: "SERP Hawk — Plataforma CRM",
    heroTitle: "El CRM Inteligente Construido para Crecer.",
    heroSub: "Desde descubrir prospectos hasta cerrar tratos, automatizar flujos de trabajo y retener clientes — todo el ciclo de vida de sus clientes, automatizado y conectado.",
    startGuidedTour: "Iniciar Tour Guiado",
    crmModules: "Módulos CRM",
    automated: "Automatizado",
    currencies: "Monedas",
    module: "Módulo",
    journeyLabel: "Recorrido Completo",
    journeyTitle: "Un cliente. Quince pasos automatizados. Cero trabajo manual.",
    modulesLabel: "Todos los Módulos",
    modulesTitle: "21 módulos. Una plataforma.",
    impactLabel: "Impacto en el Negocio",
    impactTitle: "Resultados que su equipo sentirá de inmediato.",
    impactSub: "SERP HAWK CRM reemplaza sus hojas de cálculo, hilos de correo, notas recordatorias y herramientas desconectadas con un sistema único y automatizado que funciona las 24 horas.",
    ctaTitle: "¿Listo para verlo en acción?",
    ctaSub: "El CRM SERP HAWK está activo y listo para su equipo. Inicie sesión para experimentar la plataforma completa — o reserve una demo personal por WhatsApp.",
    bookDemo: "Reservar Demo",
    platformOverview: "Resumen de la Plataforma",
    switchToWhite: "Cambiar a Modo Blanco",
    switchToBlack: "Cambiar a Modo Negro",
    footer: "© 2026 SERP HAWK · Plataforma CRM Inteligente",
    impactItems: [
      ["80%", "Reducción en trabajo manual"],
      ["3×", "Respuesta más rápida a leads"],
      ["100%", "Consistencia en seguimiento"],
      ["360°", "Visibilidad total del cliente"],
      ["2×", "Productividad del equipo de ventas"],
      ["Cero", "Leads perdidos sin atender"],
    ] as [string, string][],
    sections: [
      { title: "Gestión de Leads — Capturar, Calificar, Convertir.", sub: "Cada lead de cada fuente — formularios web, entrada manual o Análisis Radar — ingresa a un pipeline de calificación estructurado y automatizado. Sin hojas de cálculo. Sin oportunidades perdidas." },
      { title: "Pipeline de Ventas — Cada Trato. Cada Etapa. En Movimiento.", sub: "Un pipeline visual kanban que rastrea tratos desde el primer contacto hasta el cierre. Los cambios de etapa activan acciones automáticas — tareas, notificaciones, facturas — sin trabajo manual." },
      { title: "Análisis Radar — Encuentre a su Próximo Cliente Antes que la Competencia.", sub: "Descubra prospectos de alto potencial por ubicación, tamaño de mercado, equipo o servicios. El CRM mapea su área objetivo, identifica los mejores negocios y los agrega a su pipeline con un clic." },
      { title: "Agente de Email con IA — Alcance Personalizado a Escala.", sub: "El agente de IA estudia el perfil de cada lead, el historial de conversaciones y la etapa — luego redacta un correo personalizado en segundos. Su equipo revisa. El CRM envía, rastrea y hace seguimiento." },
      { title: "Motor de Automatización — Su CRM Trabaja Mientras Usted Descansa.", sub: "Defínalo una vez. Ejecútelo para siempre. Los flujos de trabajo basados en disparadores se ejecutan automáticamente en toda su operación — desde asignar nuevos leads hasta incorporar clientes ganados." },
      { title: "Centro de Comunicación — Cada Mensaje. Una Línea de Tiempo.", sub: "Email, WhatsApp y notas internas — todo unificado en un hilo cronológico por cliente. Cada conversación se registra, etiqueta y hace visible para todo su equipo automáticamente." },
      { title: "Analíticas — Inteligencia Real. No Solo Números.", sub: "Paneles en vivo que muestran crecimiento de leads, tasas de conversión, velocidad del pipeline, rendimiento del equipo e ingresos — actualizados en tiempo real. Decisiones basadas en datos para todos los niveles." },
      { title: "Cliente 360° — Un Perfil. Imagen Completa.", sub: "Cada registro de cliente conecta tratos, mensajes, tareas, documentos, facturas y casos de soporte en una sola vista. Cualquier miembro del equipo puede retomar cualquier conversación — de inmediato y completamente." },
    ] as { title: string; sub: string }[],
    journeySteps: [
      ["01", "Prospecto Descubierto", "Análisis Radar"],
      ["02", "Lead Agregado", "Ingreso automático"],
      ["03", "Datos Enriquecidos", "Perfil construido"],
      ["04", "Lead Calificado", "Puntuación aplicada"],
      ["05", "Propietario Asignado", "Enrutamiento auto"],
      ["06", "Seguimiento Creado", "Automatización de tareas"],
      ["07", "Comunicación Iniciada", "Email + WhatsApp"],
      ["08", "Oportunidad Creada", "Entrada al pipeline"],
      ["09", "Propuesta Enviada", "Generada por IA"],
      ["10", "Trato Ganado", "Evento de conversión"],
      ["11", "Cliente Incorporado", "Estado actualizado"],
      ["12", "Factura Generada", "INR o MXN"],
      ["13", "Caso de Soporte", "Problema rastreado"],
      ["14", "Resolución Aplicada", "Base de conocimiento"],
      ["15", "Analíticas Actualizadas", "Inteligencia de negocio"],
    ] as [string, string, string][],
    modules: [
      ["Gestión de Leads", "Captura, califica y rastrea cada lead con enrutamiento automatizado."],
      ["Gestión de Contactos", "Perfiles ricos vinculados a empresas, leads, tratos e historial."],
      ["Gestión de Clientes", "Vista 360° del cliente — tratos, historial, comunicaciones y tareas."],
      ["Pipeline de Ventas", "Pipeline kanban visual con probabilidad, valor y acciones de etapa."],
      ["Análisis Radar", "Descubra prospectos por ubicación, tamaño de mercado y servicios."],
      ["Centro de Comunicación", "Email, WhatsApp y notas internas — unificados por cliente."],
      ["Motor de Automatización", "Flujos de trabajo basados en disparadores automáticos."],
      ["Tareas y Seguimientos", "Gestión inteligente con plazos, prioridades y recordatorios."],
      ["Casos de Soporte", "Ciclo completo de casos — creación, asignación y resolución."],
      ["Propuestas", "Cree, envíe y rastree propuestas profesionales con firma electrónica."],
      ["Proyectos", "Rastree entregables, hitos y cargas de trabajo de todos los clientes."],
      ["Documentos", "Gestión centralizada de archivos vinculados a clientes y casos."],
      ["Facturación", "Facturas formales para SERP Hawk en INR o DaPros en MXN."],
      ["Catálogo de Productos", "Catálogo de servicios con precios en doble moneda MXN e INR."],
      ["Reuniones", "Programe, rastree y registre todas las reuniones con clientes."],
      ["Notificaciones", "Alertas inteligentes en tiempo real para tareas, leads y tratos."],
      ["Reportes y Rankings", "Analíticas de rendimiento del equipo, fuentes de leads y KPIs."],
      ["Agente de Email IA", "Redacción, personalización y automatización de seguimientos."],
      ["Vista de Gerente", "Paneles ejecutivos de ingresos, pipeline y pronósticos."],
      ["Gestión de Equipo", "Estructura org, roles, permisos y seguimiento de rendimiento."],
      ["Órdenes", "Gestión de órdenes vinculada a clientes, productos y facturación."],
    ] as [string, string][],
    platformItems: [
      ["21 Módulos CRM", "Completos, conectados, listos para usar"],
      ["Doble Moneda", "INR para SERP Hawk · MXN para DaPros"],
      ["Integración WhatsApp", "Mensajes vinculados a perfiles de clientes"],
      ["Agente de Email IA", "Redacta y envía mensajes personalizados"],
      ["Análisis Radar", "Descubrimiento de prospectos e inteligencia"],
      ["Motor de Automatización", "Flujos automáticos, cero trabajo manual"],
    ] as [string, string][],
    tickerItems: ["Gestión de Leads", "Pipeline de Ventas", "Análisis Radar", "Agente de Email IA", "Motor de Automatización", "Centro de Comunicación", "Cliente 360°", "Analíticas", "Generación de Facturas", "Casos de Soporte", "Gestión de Equipo"],
  },
} as const;

function useInView(rootMargin = "0px") {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [rootMargin]);
  return { ref, inView };
}

/* ─────────────────────────────────────────────────
   BROWSER MOCKUP SHELL
───────────────────────────────────────────────── */
function BrowserShell({ children, theme, label = "crm.serphawk.com", height = 480 }: {
  children: React.ReactNode; theme: Theme; label?: string; height?: number;
}) {
  const bg = theme === "dark" ? "#0f0f0f" : "#f0f0f0";
  const bar = theme === "dark" ? "#1a1a1a" : "#e0e0e0";
  const dot1 = "#ef4444"; const dot2 = "#f59e0b"; const dot3 = "#22c55e";
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${theme === "dark" ? "#222" : "#ddd"}`, background: bg, boxShadow: theme === "dark" ? "0 40px 80px rgba(0,0,0,0.6)" : "0 40px 80px rgba(0,0,0,0.12)" }}>
      <div style={{ background: bar, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: dot1 }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: dot2 }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: dot3 }} />
        <div style={{ flex: 1, margin: "0 12px", background: theme === "dark" ? "#111" : "#fff", borderRadius: 6, padding: "4px 12px", fontSize: 11, color: theme === "dark" ? "#555" : "#999", fontFamily: "monospace" }}>{label}</div>
      </div>
      <div style={{ height, overflow: "hidden", position: "relative" }}>{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MOCKUP: LEAD MANAGEMENT
───────────────────────────────────────────────── */
function LeadMockup({ theme, active }: { theme: Theme; active: boolean }) {
  const [step, setStep] = useState(0);
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#aaa";
  const card = theme === "dark" ? "#161616" : "#fafafa";
  const border = theme === "dark" ? "#222" : "#eee";
  const accent = theme === "dark" ? "#fff" : "#000";

  useEffect(() => {
    if (!active) return;
    const timers = [
      setTimeout(() => setStep(1), 400),
      setTimeout(() => setStep(2), 1200),
      setTimeout(() => setStep(3), 2000),
      setTimeout(() => setStep(4), 2800),
      setTimeout(() => setStep(5), 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);

  const leads = [
    { name: "Rahul Mehta", company: "TechNova Pvt Ltd", status: "New", src: "Website" },
    { name: "Ana García", company: "DaPros MX", status: "Contacted", src: "Radar" },
    { name: "James Wilson", company: "GlobalMart Inc", status: "Qualified", src: "Referral" },
    { name: "Priya Sharma", company: "StartupXYZ", status: "Proposal", src: "Website" },
  ];

  const statusColors: Record<string, string> = {
    New: "#3b82f6", Contacted: "#f59e0b", Qualified: "#22c55e", Proposal: "#a855f7"
  };

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "Inter, sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 180, borderRight: `1px solid ${border}`, padding: 16, background: card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Navigation</div>
        {["Dashboard", "Leads", "Contacts", "Clients", "Pipeline", "Tasks", "Billing", "Reports"].map((item, i) => (
          <div key={i} style={{ padding: "7px 10px", borderRadius: 6, marginBottom: 2, fontSize: 12, fontWeight: item === "Leads" ? 700 : 400, color: item === "Leads" ? fg : muted, background: item === "Leads" ? (theme === "dark" ? "#222" : "#ebebeb") : "transparent", cursor: "pointer" }}>{item}</div>
        ))}
      </div>
      {/* Main */}
      <div style={{ flex: 1, padding: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: fg }}>Lead Management</div>
            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>148 leads this month</div>
          </div>
          <div style={{ padding: "7px 16px", borderRadius: 6, background: accent, color: theme === "dark" ? "#000" : "#fff", fontSize: 11, fontWeight: 700, transition: "all 0.3s", transform: step >= 1 ? "scale(1)" : "scale(0.9)", opacity: step >= 1 ? 1 : 0 }}>+ New Lead</div>
        </div>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[{ l: "Total Leads", v: "148" }, { l: "Qualified", v: "42" }, { l: "Converted", v: "18" }, { l: "This Week", v: "+23" }].map((s, i) => (
            <div key={i} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: card, opacity: step >= 2 ? 1 : 0, transition: `opacity 0.4s ${i * 0.1}s` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: fg }}>{s.v}</div>
              <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* Table */}
        <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", padding: "8px 14px", background: card, borderBottom: `1px solid ${border}`, fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>Name</span><span>Company</span><span>Status</span><span>Source</span>
          </div>
          {leads.map((lead, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", padding: "10px 14px", borderBottom: i < leads.length - 1 ? `1px solid ${border}` : "none", fontSize: 12, alignItems: "center", opacity: step >= 3 ? 1 : 0, transform: step >= 3 ? "translateX(0)" : "translateX(-20px)", transition: `all 0.4s ${0.2 + i * 0.1}s` }}>
              <span style={{ fontWeight: 600, color: fg }}>{lead.name}</span>
              <span style={{ color: muted }}>{lead.company}</span>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: `${statusColors[lead.status]}22`, color: statusColors[lead.status], display: "inline-block" }}>{lead.status}</span>
              <span style={{ color: muted, fontSize: 11 }}>{lead.src}</span>
            </div>
          ))}
        </div>
        {/* New lead highlight */}
        {step >= 4 && (
          <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 8, border: `2px solid ${accent}`, background: theme === "dark" ? "#111" : "#f8f8f8", animation: "slideUp 0.5s ease-out", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: fg }}>🔔 New lead assigned — Vijay Kumar, Bengaluru</div>
              <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Source: Radar Analysis · Auto-assigned to Priya S.</div>
            </div>
            <div style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, background: accent, color: theme === "dark" ? "#000" : "#fff", fontWeight: 700 }}>View</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MOCKUP: SALES PIPELINE
───────────────────────────────────────────────── */
function PipelineMockup({ theme, active }: { theme: Theme; active: boolean }) {
  const [dealStage, setDealStage] = useState(0);
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#aaa";
  const card = theme === "dark" ? "#161616" : "#fafafa";
  const border = theme === "dark" ? "#222" : "#eee";
  const accent = theme === "dark" ? "#fff" : "#000";

  useEffect(() => {
    if (!active) return;
    const t1 = setTimeout(() => setDealStage(1), 1000);
    const t2 = setTimeout(() => setDealStage(2), 2500);
    const t3 = setTimeout(() => setDealStage(3), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  const stages = ["New Lead", "Contacted", "Qualified", "Proposal", "Won"];
  const stageColors = ["#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#22c55e"];

  return (
    <div style={{ height: "100%", padding: 20, fontFamily: "Inter, sans-serif", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: fg }}>Sales Pipeline</div>
        <div style={{ fontSize: 11, color: muted }}>₹4.6L total pipeline value</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, height: "calc(100% - 60px)", alignItems: "start" }}>
        {stages.map((stage, si) => (
          <div key={si} style={{ borderRadius: 8, background: card, border: `1px solid ${border}`, overflow: "hidden" }}>
            <div style={{ padding: "8px 10px", borderBottom: `2px solid ${stageColors[si]}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: stageColors[si] }}>{stage}</span>
              <span style={{ fontSize: 10, color: muted }}>{si === 0 ? 8 : si === 1 ? 5 : si === 2 ? 4 : si === 3 ? 2 : 1}</span>
            </div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Static cards */}
              {si === 0 && [{ n: "TechNova", v: "₹45K" }, { n: "WebCo", v: "₹22K" }].map((c, ci) => (
                <div key={ci} style={{ padding: "8px 10px", borderRadius: 6, background: theme === "dark" ? "#1a1a1a" : "#f0f0f0", border: `1px solid ${border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: fg, marginBottom: 2 }}>{c.n}</div>
                  <div style={{ fontSize: 10, color: stageColors[si] }}>{c.v}</div>
                </div>
              ))}
              {si === 2 && [{ n: "StartupXYZ", v: "₹28K" }].map((c, ci) => (
                <div key={ci} style={{ padding: "8px 10px", borderRadius: 6, background: theme === "dark" ? "#1a1a1a" : "#f0f0f0", border: `1px solid ${border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: fg, marginBottom: 2 }}>{c.n}</div>
                  <div style={{ fontSize: 10, color: stageColors[si] }}>{c.v}</div>
                </div>
              ))}
              {si === 4 && dealStage >= 3 && (
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#22c55e22", border: `1px solid #22c55e`, animation: "slideUp 0.5s ease-out" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", marginBottom: 2 }}>GlobalMart Inc</div>
                  <div style={{ fontSize: 10, color: "#22c55e" }}>₹1,20,000 ✓ WON</div>
                </div>
              )}
              {/* Animated moving card */}
              {si === 1 && dealStage === 0 && (
                <div style={{ padding: "8px 10px", borderRadius: 6, background: theme === "dark" ? "#1a1a1a" : "#f0f0f0", border: `1px solid ${border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: fg, marginBottom: 2 }}>GlobalMart</div>
                  <div style={{ fontSize: 10, color: stageColors[si] }}>₹1,20,000</div>
                </div>
              )}
              {si === 2 && dealStage === 1 && (
                <div style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${accent}`, background: theme === "dark" ? "#1a1a1a" : "#f0f0f0", animation: "slideUp 0.4s ease-out" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: fg, marginBottom: 2 }}>GlobalMart</div>
                  <div style={{ fontSize: 10, color: stageColors[si] }}>₹1,20,000</div>
                  <div style={{ fontSize: 9, color: "#22c55e", marginTop: 2 }}>↑ Moved to Qualified</div>
                </div>
              )}
              {si === 3 && dealStage === 2 && (
                <div style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${accent}`, background: theme === "dark" ? "#1a1a1a" : "#f0f0f0", animation: "slideUp 0.4s ease-out" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: fg, marginBottom: 2 }}>GlobalMart</div>
                  <div style={{ fontSize: 10, color: stageColors[si] }}>₹1,20,000</div>
                  <div style={{ fontSize: 9, color: "#22c55e", marginTop: 2 }}>↑ Moved to Proposal</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {dealStage >= 3 && (
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, padding: "10px 16px", borderRadius: 8, background: "#22c55e", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", animation: "slideUp 0.5s ease-out" }}>
          <span>Deal Won — GlobalMart Inc · ₹1,20,000</span>
          <span style={{ fontSize: 10, opacity: 0.8 }}>Auto: Invoice generated · Onboarding task created</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MOCKUP: AI EMAIL AGENT
───────────────────────────────────────────────── */
function EmailAgentMockup({ theme, active }: { theme: Theme; active: boolean }) {
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState(0);
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#aaa";
  const card = theme === "dark" ? "#161616" : "#fafafa";
  const border = theme === "dark" ? "#222" : "#eee";
  const accent = theme === "dark" ? "#fff" : "#000";

  const emailBody = `Hi Rahul,

Thank you for your interest in SERP Hawk's SEO services.

Based on your website audit, I've identified 3 key areas where we can significantly improve your organic search visibility:

1. Technical SEO — 14 critical errors found
2. Content gaps — 8 high-volume keywords not targeted
3. Backlink profile — Opportunity for 40+ quality links

I'd love to schedule a 30-minute call to walk you through our findings.

Are you available this Thursday or Friday?

Best regards,
Priya S.
SERP Hawk`;

  useEffect(() => {
    if (!active) return;
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 1500);
    const t3 = setTimeout(() => setPhase(3), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  useEffect(() => {
    if (phase < 3) { setTyped(0); return; }
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped(i);
      if (i >= emailBody.length) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div style={{ height: "100%", fontFamily: "Inter, sans-serif", display: "flex" }}>
      {/* Left panel — email list */}
      <div style={{ width: 220, borderRight: `1px solid ${border}`, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>AI Email Agent</div>
          <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Drafts, sequences, follow-ups</div>
        </div>
        {[
          { to: "Rahul M.", subj: "SEO Audit Results", tag: "Drafting...", active: true },
          { to: "Ana García", subj: "Follow-up — Day 3", tag: "Scheduled", active: false },
          { to: "James W.", subj: "Proposal Follow-up", tag: "Sent", active: false },
        ].map((e, i) => (
          <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, background: e.active ? (theme === "dark" ? "#1a1a1a" : "#f0f0f0") : "transparent", opacity: phase >= 1 ? 1 : 0, transition: `opacity 0.3s ${i * 0.1}s` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: fg }}>{e.to}</div>
              <div style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: e.tag === "Drafting..." ? "#3b82f622" : e.tag === "Scheduled" ? "#f59e0b22" : "#22c55e22", color: e.tag === "Drafting..." ? "#3b82f6" : e.tag === "Scheduled" ? "#f59e0b" : "#22c55e", fontWeight: 700 }}>{e.tag}</div>
            </div>
            <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{e.subj}</div>
          </div>
        ))}
        {phase >= 2 && (
          <div style={{ padding: "10px 14px", animation: "slideUp 0.4s ease-out" }}>
            <div style={{ fontSize: 10, color: muted, marginBottom: 8 }}>AI Suggestions</div>
            <div style={{ fontSize: 10, color: fg, padding: "6px 8px", borderRadius: 6, border: `1px solid ${border}`, marginBottom: 4, cursor: "pointer" }}>Best time to send: Thu 10am</div>
            <div style={{ fontSize: 10, color: fg, padding: "6px 8px", borderRadius: 6, border: `1px solid ${border}`, cursor: "pointer" }}>Subject A/B test ready</div>
          </div>
        )}
      </div>
      {/* Right panel — compose */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: theme === "dark" ? "#000" : "#fff" }}>AI</div>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: fg }}>AI-Drafted Email</div><div style={{ fontSize: 10, color: muted }}>Powered by lead profile + conversation history</div></div>
        </div>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${border}`, fontSize: 12 }}>
          <div style={{ marginBottom: 6 }}><span style={{ color: muted }}>To: </span><span style={{ color: fg, fontWeight: 600 }}>rahul.mehta@technova.in</span></div>
          <div><span style={{ color: muted }}>Subject: </span><span style={{ color: fg, fontWeight: 600 }}>SEO Audit Results — TechNova Pvt Ltd</span></div>
        </div>
        <div style={{ flex: 1, padding: 16, fontSize: 12, lineHeight: 1.7, color: fg, whiteSpace: "pre-wrap", fontFamily: "Inter, sans-serif", overflow: "hidden" }}>
          {emailBody.slice(0, typed)}
          {typed < emailBody.length && phase >= 3 && <span style={{ borderRight: `2px solid ${accent}`, animation: "blink 0.8s step-end infinite" }}>&nbsp;</span>}
        </div>
        {typed >= emailBody.length && (
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${border}`, display: "flex", gap: 8, animation: "slideUp 0.3s ease-out" }}>
            <div style={{ padding: "7px 16px", borderRadius: 6, background: accent, color: theme === "dark" ? "#000" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Send Now</div>
            <div style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${border}`, color: fg, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Schedule for Thu 10am</div>
            <div style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${border}`, color: muted, fontSize: 11, cursor: "pointer" }}>Edit Draft</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MOCKUP: AUTOMATION ENGINE
───────────────────────────────────────────────── */
function AutomationMockup({ theme, active }: { theme: Theme; active: boolean }) {
  const [step, setStep] = useState(-1);
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#aaa";
  const border = theme === "dark" ? "#222" : "#eee";
  const accent = theme === "dark" ? "#fff" : "#000";

  useEffect(() => {
    if (!active) return;
    const timers = [0, 800, 1600, 2400, 3200].map((d, i) => setTimeout(() => setStep(i), d));
    return () => timers.forEach(clearTimeout);
  }, [active]);

  const nodes = [
    { label: "TRIGGER", sub: "New Lead Created", desc: "Via Website Form / Radar", color: "#3b82f6" },
    { label: "CONDITION", sub: "Lead Source = Radar", desc: "Match filter applied", color: "#f59e0b" },
    { label: "ACTION 1", sub: "Assign Owner", desc: "Auto-route to Sales Rep", color: "#a855f7" },
    { label: "ACTION 2", sub: "Create Follow-up Task", desc: "Due in 24 hours", color: "#ec4899" },
    { label: "RESULT", sub: "Lead Active", desc: "Sequence started", color: "#22c55e" },
  ];

  return (
    <div style={{ height: "100%", padding: 24, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: fg }}>Automation: New Lead from Radar</div>
        <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Runs automatically when triggered · Last run: 2 minutes ago</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
        {nodes.map((node, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, border: `2px solid ${step >= i ? node.color : border}`, background: step >= i ? `${node.color}11` : "transparent", minWidth: 130, transition: "all 0.5s ease", opacity: step >= i ? 1 : 0.3, transform: step >= i ? "translateY(0)" : "translateY(8px)" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: node.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{node.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 2 }}>{node.sub}</div>
              <div style={{ fontSize: 10, color: muted }}>{node.desc}</div>
              {step >= i && <div style={{ marginTop: 6, width: "100%", height: 2, borderRadius: 1, background: node.color, animation: "expandWidth 0.5s ease-out" }} />}
            </div>
            {i < nodes.length - 1 && (
              <div style={{ display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0 }}>
                <div style={{ width: 30, height: 2, background: step > i ? accent : border, transition: "background 0.5s" }} />
                <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: `7px solid ${step > i ? accent : border}`, transition: "border-color 0.5s" }} />
              </div>
            )}
          </div>
        ))}
      </div>
      {step >= 4 && (
        <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 8, border: `1px solid #22c55e`, background: "#22c55e11", animation: "slideUp 0.4s ease-out" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>Automation executed successfully</div>
          <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Owner: Priya S. · Task created · Notification sent · Sequence active</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MOCKUP: RADAR ANALYSIS
───────────────────────────────────────────────── */
function RadarMockup({ theme, active }: { theme: Theme; active: boolean }) {
  const [pinsVisible, setPinsVisible] = useState(0);
  const [selected, setSelected] = useState(false);
  const [added, setAdded] = useState(false);
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#aaa";
  const card = theme === "dark" ? "#161616" : "#fafafa";
  const border = theme === "dark" ? "#222" : "#eee";
  const accent = theme === "dark" ? "#fff" : "#000";

  useEffect(() => {
    if (!active) return;
    const timers = [0, 400, 800, 1200, 1600].map((d, i) => setTimeout(() => setPinsVisible(i + 1), d));
    const t6 = setTimeout(() => setSelected(true), 2400);
    const t7 = setTimeout(() => setAdded(true), 3600);
    return () => { timers.forEach(clearTimeout); clearTimeout(t6); clearTimeout(t7); };
  }, [active]);

  const pins = [
    { x: 42, y: 38, name: "TechNova", market: "₹50L+", dist: "1.2km", team: 45 },
    { x: 63, y: 52, name: "DesignCo", market: "₹12L+", dist: "3.1km", team: 12 },
    { x: 28, y: 60, name: "StartupXY", market: "₹8L+", dist: "4.5km", team: 8 },
    { x: 71, y: 32, name: "GlobalPro", market: "₹32L+", dist: "2.8km", team: 28 },
    { x: 55, y: 70, name: "WebAgency", market: "₹18L+", dist: "3.9km", team: 15 },
  ];

  return (
    <div style={{ height: "100%", display: "flex", fontFamily: "Inter, sans-serif" }}>
      {/* Map area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Grid background */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} 1px, transparent 1px), linear-gradient(90deg, ${theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} 1px, transparent 1px)`, backgroundSize: "30px 30px" }} />
        {/* Radar rings */}
        <div style={{ position: "absolute", left: "42%", top: "38%", transform: "translate(-50%,-50%)" }}>
          {[80, 130, 180].map((r, i) => <div key={i} style={{ position: "absolute", width: r, height: r, borderRadius: "50%", border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, left: -r / 2, top: -r / 2 }} />)}
        </div>
        {/* Pins */}
        {pins.map((pin, i) => i < pinsVisible && (
          <div key={i} style={{ position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -100%)", animation: "dropPin 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
            <div style={{ padding: "3px 8px", borderRadius: 4, background: selected && i === 0 ? accent : (theme === "dark" ? "#1a1a1a" : "#f0f0f0"), border: `1px solid ${selected && i === 0 ? accent : border}`, fontSize: 10, fontWeight: 700, color: selected && i === 0 ? (theme === "dark" ? "#000" : "#fff") : fg, marginBottom: 2, whiteSpace: "nowrap", transition: "all 0.3s" }}>{pin.name}</div>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: selected && i === 0 ? accent : (theme === "dark" ? "#444" : "#bbb"), margin: "0 auto", transition: "background 0.3s" }} />
          </div>
        ))}
        <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 10, color: muted }}>Bengaluru • 5km radius</div>
      </div>
      {/* Right panel */}
      <div style={{ width: 220, borderLeft: `1px solid ${border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: fg }}>Top Prospects</div>
          <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Sorted by market size</div>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {pins.map((pin, i) => i < pinsVisible && (
            <div key={i} onClick={() => setSelected(true)} style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, cursor: "pointer", background: selected && i === 0 ? (theme === "dark" ? "#1a1a1a" : "#f0f0f0") : "transparent", transition: "background 0.3s", animation: `fadeIn 0.3s ease-out` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: fg }}>{pin.name}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: fg }}>#{i + 1}</div>
              </div>
              <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{pin.market} · {pin.dist} · {pin.team} staff</div>
            </div>
          ))}
        </div>
        {selected && !added && (
          <div style={{ padding: 12, borderTop: `1px solid ${border}`, animation: "slideUp 0.3s ease-out" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: fg, marginBottom: 8 }}>TechNova Pvt Ltd</div>
            <button onClick={() => setAdded(true)} style={{ width: "100%", padding: "8px", borderRadius: 6, background: accent, color: theme === "dark" ? "#000" : "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>+ Add to CRM</button>
          </div>
        )}
        {added && (
          <div style={{ padding: 12, borderTop: `1px solid #22c55e`, background: "#22c55e11", animation: "slideUp 0.3s ease-out" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>Added to CRM</div>
            <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Tagged: Radar Analysis · Bengaluru</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MOCKUP: ANALYTICS DASHBOARD
───────────────────────────────────────────────── */
function AnalyticsMockup({ theme, active }: { theme: Theme; active: boolean }) {
  const [bars, setBars] = useState(false);
  const [count, setCount] = useState(0);
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#aaa";
  const card = theme === "dark" ? "#161616" : "#fafafa";
  const border = theme === "dark" ? "#222" : "#eee";
  const accent = theme === "dark" ? "#fff" : "#000";

  useEffect(() => {
    if (!active) return;
    setTimeout(() => setBars(true), 400);
    let c = 0;
    const interval = setInterval(() => {
      c += 3;
      setCount(Math.min(c, 148));
      if (c >= 148) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [active]);

  const barData = [
    { label: "Jan", h: 45 }, { label: "Feb", h: 60 }, { label: "Mar", h: 52 },
    { label: "Apr", h: 78 }, { label: "May", h: 90 }, { label: "Jun", h: 100 },
  ];

  return (
    <div style={{ height: "100%", padding: 16, fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: fg }}>Analytics Overview</div>
        <div style={{ fontSize: 10, color: muted }}>Last 6 months</div>
      </div>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Total Leads", value: count, suffix: "" },
          { label: "Converted", value: Math.floor(count * 0.3), suffix: "" },
          { label: "Revenue", value: Math.floor(count * 0.2), suffix: "K" },
          { label: "Tasks Done", value: Math.floor(count * 2.1), suffix: "" },
        ].map((k, i) => (
          <div key={i} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: card }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: fg }}>{k.value}{k.suffix}</div>
            <div style={{ fontSize: 9, color: muted, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>
      {/* Chart */}
      <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 14, background: card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: fg, marginBottom: 12 }}>Lead Growth</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {barData.map((b, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: accent, height: bars ? `${b.h}%` : "0%", transition: `height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.1}s`, opacity: bars ? 1 : 0 }} />
              <div style={{ fontSize: 9, color: muted }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Pipeline */}
      <div style={{ marginTop: 10 }}>
        {[{ stage: "Won", pct: 18, color: "#22c55e" }, { stage: "Active", pct: 42, color: accent }, { stage: "Lost", pct: 12, color: "#ef4444" }].map((s, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}><span style={{ color: fg }}>{s.stage}</span><span style={{ color: muted }}>{s.pct}%</span></div>
            <div style={{ height: 4, background: border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: bars ? `${s.pct}%` : "0%", background: s.color, borderRadius: 2, transition: `width 1s ease-out ${0.5 + i * 0.2}s` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MOCKUP: COMMUNICATION HUB
───────────────────────────────────────────────── */
function CommunicationMockup({ theme, active }: { theme: Theme; active: boolean }) {
  const [msgStep, setMsgStep] = useState(0);
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#aaa";
  const card = theme === "dark" ? "#161616" : "#fafafa";
  const border = theme === "dark" ? "#222" : "#eee";
  const accent = theme === "dark" ? "#fff" : "#000";

  useEffect(() => {
    if (!active) return;
    const timers = [300, 1200, 2200, 3200, 4000].map((d, i) => setTimeout(() => setMsgStep(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, [active]);

  const msgs = [
    { from: "GlobalMart", text: "Hi, we're interested in your SEO packages. Can you share pricing?", type: "in", channel: "WhatsApp" },
    { from: "CRM System", text: "New message from GlobalMart Inc · Auto-linked to client profile · Priya S. notified", type: "system" },
    { from: "Priya S.", text: "Hi! Absolutely. We have packages starting at ₹15,000/month. Let me share our detailed deck.", type: "out" },
    { from: "GlobalMart", text: "That sounds great. Can we schedule a demo call this week?", type: "in", channel: "WhatsApp" },
    { from: "Priya S.", text: "Of course! I've just sent a calendar link. Looking forward to it.", type: "out" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", fontFamily: "Inter, sans-serif" }}>
      {/* Contact list */}
      <div style={{ width: 190, borderRight: `1px solid ${border}` }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: fg }}>All Conversations</div>
        </div>
        {["GlobalMart Inc", "TechNova Pvt Ltd", "StartupXYZ"].map((name, i) => (
          <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, background: i === 0 ? (theme === "dark" ? "#1a1a1a" : "#f0f0f0") : "transparent" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: theme === "dark" ? "#000" : "#fff", flexShrink: 0 }}>{name[0]}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: fg }}>{name}</div>
                <div style={{ fontSize: 9, color: i === 0 && msgStep >= 1 ? "#22c55e" : muted }}>{i === 0 ? (msgStep >= 1 ? "Active now" : "2 days ago") : "1 week ago"}</div>
              </div>
              {i === 0 && msgStep >= 1 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", marginLeft: "auto" }} />}
            </div>
          </div>
        ))}
      </div>
      {/* Thread */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: fg }}>GlobalMart Inc</div><div style={{ fontSize: 10, color: muted }}>3 active deals · ₹2.4L pipeline</div></div>
          <div style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: "#22c55e22", color: "#22c55e", fontWeight: 700 }}>Enterprise Client</div>
        </div>
        <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
          {msgs.slice(0, msgStep).map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.type === "out" ? "flex-end" : msg.type === "system" ? "center" : "flex-start", animation: "slideUp 0.3s ease-out" }}>
              {msg.type === "system" ? (
                <div style={{ padding: "4px 12px", borderRadius: 20, background: theme === "dark" ? "#1a1a1a" : "#f0f0f0", border: `1px solid ${border}`, fontSize: 9, color: muted, maxWidth: "80%", textAlign: "center" }}>{msg.text}</div>
              ) : (
                <div style={{ maxWidth: "70%" }}>
                  {msg.channel && <div style={{ fontSize: 9, color: muted, marginBottom: 3 }}>via {msg.channel}</div>}
                  <div style={{ padding: "8px 12px", borderRadius: msg.type === "out" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.type === "out" ? accent : (theme === "dark" ? "#1a1a1a" : "#f0f0f0"), border: `1px solid ${border}` }}>
                    <div style={{ fontSize: 11, color: msg.type === "out" ? (theme === "dark" ? "#000" : "#fff") : fg, lineHeight: 1.5 }}>{msg.text}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 12px", borderTop: `1px solid ${border}`, display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 11, color: muted }}>Reply...</div>
          <div style={{ padding: "7px 12px", borderRadius: 6, background: accent, color: theme === "dark" ? "#000" : "#fff", fontSize: 10, fontWeight: 700 }}>Send</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MOCKUP: CLIENT 360°
───────────────────────────────────────────────── */
function ClientMockup({ theme, active }: { theme: Theme; active: boolean }) {
  const [phase, setPhase] = useState(0);
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#aaa";
  const card = theme === "dark" ? "#161616" : "#fafafa";
  const border = theme === "dark" ? "#222" : "#eee";
  const accent = theme === "dark" ? "#fff" : "#000";

  useEffect(() => {
    if (!active) return;
    [300, 700, 1100, 1500, 1900, 2300].map((d, i) => setTimeout(() => setPhase(i + 1), d));
  }, [active]);

  return (
    <div style={{ height: "100%", display: "flex", fontFamily: "Inter, sans-serif" }}>
      {/* Profile left */}
      <div style={{ width: 200, borderRight: `1px solid ${border}`, padding: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: theme === "dark" ? "#000" : "#fff", margin: "0 auto 10px" }}>G</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: fg }}>GlobalMart Inc</div>
          <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Enterprise · Bangalore</div>
          <div style={{ marginTop: 8, display: "inline-block", padding: "3px 10px", borderRadius: 20, background: "#22c55e22", border: "1px solid #22c55e", fontSize: 10, fontWeight: 700, color: "#22c55e" }}>Active Client</div>
        </div>
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12, fontSize: 11 }}>
          {[["Revenue", "₹1.2L ARR"], ["Since", "Jan 2025"], ["Owner", "Priya S."], ["Source", "Radar"]].map(([k, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, opacity: phase >= i + 1 ? 1 : 0, transition: `opacity 0.3s ${i * 0.1}s` }}>
              <span style={{ color: muted }}>{k}</span>
              <span style={{ color: fg, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Right detail */}
      <div style={{ flex: 1, padding: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {[["3", "Active Deals", "₹2.4L"], ["47", "Messages", "All channels"], ["12", "Tasks", "3 overdue"]].map(([v, l, sub], i) => (
            <div key={i} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: card, opacity: phase >= 2 ? 1 : 0, transition: `opacity 0.3s ${i * 0.1}s` }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: fg }}>{v}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: fg, marginTop: 2 }}>{l}</div>
              <div style={{ fontSize: 9, color: muted }}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden", opacity: phase >= 3 ? 1 : 0, transition: "opacity 0.5s" }}>
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${border}`, fontSize: 11, fontWeight: 700, color: fg }}>Activity Timeline</div>
          {[
            { time: "2h ago", text: "Message received via WhatsApp", type: "msg" },
            { time: "1 day ago", text: "Proposal sent — SEO Package Premium", type: "deal" },
            { time: "3 days ago", text: "Task completed: Follow-up call", type: "task" },
            { time: "1 week ago", text: "Invoice paid — ₹45,000", type: "billing" },
          ].map((a, i) => (
            <div key={i} style={{ padding: "8px 12px", borderBottom: i < 3 ? `1px solid ${border}` : "none", display: "flex", gap: 10, alignItems: "center", fontSize: 11, opacity: phase >= 4 ? 1 : 0, transition: `opacity 0.3s ${i * 0.1}s` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
              <span style={{ color: fg, flex: 1 }}>{a.text}</span>
              <span style={{ color: muted, fontSize: 10 }}>{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   SECTION COMPONENT
───────────────────────────────────────────────── */
function ShowcaseSection({ theme, title, subtitle, mockup, reverse = false, index, moduleLabel }: {
  theme: Theme; title: string; subtitle: string; mockup: (active: boolean) => React.ReactNode; reverse?: boolean; index: number; moduleLabel?: string;
}) {
  const { ref, inView } = useInView("-100px");
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#999";
  const border = theme === "dark" ? "#111" : "#eee";

  return (
    <div ref={ref} style={{ borderTop: `1px solid ${border}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        {/* Copy */}
        <div style={{ order: reverse ? 2 : 1, opacity: inView ? 1 : 0, transform: inView ? "translateX(0)" : reverse ? "translateX(40px)" : "translateX(-40px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>{moduleLabel} {String(index).padStart(2, "0")}</div>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 900, color: fg, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 20 }}>{title}</h2>
          <p style={{ fontSize: 16, color: muted, lineHeight: 1.7, maxWidth: 380 }}>{subtitle}</p>
        </div>
        {/* Mockup */}
        <div style={{ order: reverse ? 1 : 2, opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s" }}>
          <BrowserShell theme={theme}>{mockup(inView)}</BrowserShell>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────── */
export default function DemoShowcase() {
  const { t, language, setLanguage } = useLanguage();
  const [theme, setTheme] = useState<Theme>("dark");
  const lang = (language as Lang) || "en";
  const tx = T[lang];
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourPaused, setTourPaused] = useState(false);
  const tourRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sections = ["hero", "leads", "pipeline", "radar", "email-agent", "automation", "communication", "analytics", "client360", "journey", "modules", "impact"];

  const bg = theme === "dark" ? "#000" : "#fff";
  const fg = theme === "dark" ? "#fff" : "#000";
  const muted = theme === "dark" ? "#555" : "#999";
  const border = theme === "dark" ? "#111" : "#f0f0f0";
  const card = theme === "dark" ? "#0a0a0a" : "#f8f8f8";

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!tourActive || tourPaused) return;
    if (tourStep >= sections.length) { setTourActive(false); setTourStep(0); return; }
    scrollTo(sections[tourStep]);
    tourRef.current = setTimeout(() => setTourStep(s => s + 1), 5000);
    return () => { if (tourRef.current) clearTimeout(tourRef.current); };
  }, [tourActive, tourStep, tourPaused, scrollTo]);

  const { ref: heroRef, inView: heroIn } = useInView();
  const { ref: modulesRef, inView: modulesIn } = useInView("-100px");
  const { ref: journeyRef, inView: journeyIn } = useInView("-100px");
  const { ref: impactRef, inView: impactIn } = useInView("-100px");

  return (
    <div style={{ background: bg, color: fg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes dropPin { 0% { opacity:0; transform:translate(-50%,-60%) scale(0.7); } 60% { transform:translate(-50%,-110%) scale(1.1); } 100% { opacity:1; transform:translate(-50%,-100%) scale(1); } }
        @keyframes expandWidth { from { width:0; } to { width:100%; } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ticker { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        @keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
        @keyframes nudgeRight { 0%,100%{transform:translateX(0);} 50%{transform:translateX(4px);} }
      `}</style>

      {/* ── STICKY HEADER ── */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: bg === "#000" ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.03em", color: fg }}>{t("demo_showcase.brand")}</div>
            <div style={{ fontSize: 11, color: muted }}>{t("demo_showcase.showcase")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => { setTourStep(0); setTourActive(true); setTourPaused(false); }}
              style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: fg, fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em" }}>
              {t("demo_showcase.start_tour")}
            </button>
            {/* Language toggle */}
            <button onClick={() => setLanguage(lang === "en" ? "es" : "en")}
              style={{ width: 60, height: 28, borderRadius: 14, border: `1px solid ${border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", padding: "0 4px", position: "relative", transition: "all 0.3s" }}>
              <div style={{ position: "absolute", left: lang === "en" ? 4 : 34, width: 18, height: 18, borderRadius: "50%", background: fg, transition: "left 0.3s cubic-bezier(0.34,1.56,0.64,1)" }} />
              <span style={{ position: "absolute", left: lang === "en" ? 26 : 6, fontSize: 8, fontWeight: 800, color: fg, letterSpacing: "0.03em" }}>{lang === "en" ? "ES" : "EN"}</span>
            </button>
            {/* Theme toggle */}
            <button onClick={() => setTheme(t2 => t2 === "dark" ? "light" : "dark")}
              style={{ width: 60, height: 28, borderRadius: 14, border: `1px solid ${border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", padding: "0 4px", position: "relative", transition: "all 0.3s" }}>
              <div style={{ position: "absolute", left: theme === "dark" ? 4 : 34, width: 18, height: 18, borderRadius: "50%", background: fg, transition: "left 0.3s cubic-bezier(0.34,1.56,0.64,1)" }} />
              <span style={{ position: "absolute", left: theme === "dark" ? 26 : 8, fontSize: 9, fontWeight: 800, color: fg, letterSpacing: "0.04em" }}>{theme === "dark" ? "W" : "B"}</span>
            </button>
            <a href="/login" style={{ padding: "6px 14px", borderRadius: 6, background: fg, color: bg, fontSize: 11, fontWeight: 700, textDecoration: "none", letterSpacing: "-0.01em" }}>{t("demo_showcase.launch_crm")}</a>
          </div>
        </div>
      </header>

      {/* ── TOUR BAR ── */}
      {tourActive && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: bg, border: `1px solid ${fg}`, borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: `0 20px 60px ${fg === "#fff" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.4)"}`, minWidth: 360 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{t("demo_showcase.guided_tour")}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>{t("demo_showcase.section_of")} {tourStep + 1} {t("demo_showcase.of")} {sections.length}</div>
            <div style={{ marginTop: 6, height: 2, background: border, borderRadius: 1 }}>
              <div style={{ height: "100%", width: `${(tourStep / sections.length) * 100}%`, background: fg, borderRadius: 1, transition: "width 0.5s" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["‹", () => setTourStep(s => Math.max(0, s - 1))], [tourPaused ? "▶" : "⏸", () => setTourPaused(p => !p)], ["›", () => setTourStep(s => Math.min(sections.length - 1, s + 1))], ["✕", () => { setTourActive(false); setTourStep(0); }]].map(([label, fn], i) => (
              <button key={i} onClick={fn as () => void} style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: fg, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>{label as string}</button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════ */}
      <section id="hero" ref={heroRef} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 56 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 32px 40px" }}>
          <div style={{ marginBottom: 24, opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>{t("demo_showcase.hero_label")}</div>
          </div>
          <h1 style={{ fontSize: "clamp(48px, 7vw, 96px)", fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.04em", maxWidth: 900, marginBottom: 32, color: fg, opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(30px)", transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.1s" }}>
            {t("demo_showcase.hero_title")}
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
            <div style={{ opacity: heroIn ? 1 : 0, transition: "all 0.8s 0.3s" }}>
              <p style={{ fontSize: 18, color: muted, lineHeight: 1.7, marginBottom: 36, maxWidth: 440 }}>
                {t("demo_showcase.hero_sub")}
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => { setTourStep(0); setTourActive(true); }} style={{ padding: "12px 28px", borderRadius: 8, background: fg, color: bg, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", letterSpacing: "-0.02em" }}>{t("demo_showcase.start_guided_tour")}</button>
                <a href="/login" style={{ padding: "12px 28px", borderRadius: 8, background: "transparent", color: fg, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${border}`, textDecoration: "none", letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {t("demo_showcase.launch_crm")} <span style={{ animation: "nudgeRight 1.5s ease-in-out infinite" }}>→</span>
                </a>
              </div>
              <div style={{ marginTop: 48, display: "flex", gap: 32 }}>
                {([["21", t("demo_showcase.crm_modules")], ["100%", t("demo_showcase.automated")], ["2", t("demo_showcase.currencies")]] as [string,string][]).map(([v, l], i) => (
                  <div key={i}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: fg, letterSpacing: "-0.04em" }}>{v}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Hero mockup */}
            <div style={{ opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(40px)", transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.2s" }}>
              <AnalyticsMockup theme={theme} active={heroIn} />
            </div>
          </div>
        </div>
        {/* Ticker */}
        <div style={{ borderTop: `1px solid ${border}`, overflow: "hidden", marginTop: 40 }}>
          <div style={{ display: "flex", gap: 48, padding: "12px 0", animation: "ticker 25s linear infinite", width: "max-content" }}>
            {[...Array(3)].flatMap(() => tx.tickerItems).map((ti, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 600, color: muted, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{ti}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SHOWCASE SECTIONS
      ═══════════════════════════════════════════════════ */}
      <ShowcaseSection theme={theme} index={1} moduleLabel={t("demo_showcase.module")}
        title={t("demo_showcase.section_1_title")} subtitle={t("demo_showcase.section_1_sub")}
        mockup={(active) => <LeadMockup theme={theme} active={active} />}
      />

      <ShowcaseSection theme={theme} index={2} reverse moduleLabel={t("demo_showcase.module")}
        title={t("demo_showcase.section_2_title")} subtitle={t("demo_showcase.section_2_sub")}
        mockup={(active) => <PipelineMockup theme={theme} active={active} />}
      />

      <ShowcaseSection theme={theme} index={3} moduleLabel={t("demo_showcase.module")}
        title={t("demo_showcase.section_3_title")} subtitle={t("demo_showcase.section_3_sub")}
        mockup={(active) => <RadarMockup theme={theme} active={active} />}
      />

      <ShowcaseSection theme={theme} index={4} reverse moduleLabel={t("demo_showcase.module")}
        title={t("demo_showcase.section_4_title")} subtitle={t("demo_showcase.section_4_sub")}
        mockup={(active) => <EmailAgentMockup theme={theme} active={active} />}
      />

      <ShowcaseSection theme={theme} index={5} moduleLabel={t("demo_showcase.module")}
        title={t("demo_showcase.section_5_title")} subtitle={t("demo_showcase.section_5_sub")}
        mockup={(active) => <AutomationMockup theme={theme} active={active} />}
      />

      <ShowcaseSection theme={theme} index={6} reverse moduleLabel={t("demo_showcase.module")}
        title={t("demo_showcase.section_6_title")} subtitle={t("demo_showcase.section_6_sub")}
        mockup={(active) => <CommunicationMockup theme={theme} active={active} />}
      />

      <ShowcaseSection theme={theme} index={7} moduleLabel={t("demo_showcase.module")}
        title={t("demo_showcase.section_7_title")} subtitle={t("demo_showcase.section_7_sub")}
        mockup={(active) => <AnalyticsMockup theme={theme} active={active} />}
      />

      <ShowcaseSection theme={theme} index={8} reverse moduleLabel={t("demo_showcase.module")}
        title={t("demo_showcase.section_8_title")} subtitle={t("demo_showcase.section_8_sub")}
        mockup={(active) => <ClientMockup theme={theme} active={active} />}
      />

      {/* ═══════════════════════════════════════════════════
          CUSTOMER JOURNEY
      ═══════════════════════════════════════════════════ */}
      <div ref={journeyRef} id="journey" style={{ borderTop: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 32px" }}>
          <div style={{ marginBottom: 64, opacity: journeyIn ? 1 : 0, transform: journeyIn ? "translateY(0)" : "translateY(30px)", transition: "all 0.8s" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>{t("demo_showcase.journey_label")}</div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 56px)", fontWeight: 900, color: fg, letterSpacing: "-0.03em", lineHeight: 1.1, maxWidth: 700 }}>
              {t("demo_showcase.journey_title")}
            </h2>
          </div>
          <div style={{ overflowX: "auto", paddingBottom: 24 }}>
            <div style={{ display: "flex", gap: 0, width: "max-content" }}>
              {tx.journeySteps.map(([step, title, sub], i) => (
                <div key={i} style={{ display: "flex", alignItems: "stretch" }}>
                  <div style={{ padding: "20px 20px", opacity: journeyIn ? 1 : 0, transform: journeyIn ? "translateY(0)" : "translateY(20px)", transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: muted, marginBottom: 8 }}>{step}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: fg, marginBottom: 4, whiteSpace: "nowrap" }}>{title}</div>
                    <div style={{ fontSize: 10, color: muted, whiteSpace: "nowrap" }}>{sub}</div>
                    <div style={{ marginTop: 12, width: "100%", height: 2, background: border, borderRadius: 1 }}>
                      {journeyIn && <div style={{ height: "100%", background: fg, borderRadius: 1, animation: `expandWidth 0.4s ease-out ${0.5 + i * 0.05}s both` }} />}
                    </div>
                  </div>
                  {i < 14 && <div style={{ width: 1, background: border, alignSelf: "center", height: 40, marginTop: -10 }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MODULE GRID
      ═══════════════════════════════════════════════════ */}
      <div ref={modulesRef} id="modules" style={{ borderTop: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 32px" }}>
          <div style={{ marginBottom: 64, opacity: modulesIn ? 1 : 0, transition: "opacity 0.8s" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>{t("demo_showcase.modules_label")}</div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 56px)", fontWeight: 900, color: fg, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {t("demo_showcase.modules_title")}
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1, border: `1px solid ${border}` }}>
            {tx.modules.map(([name, desc], i) => (
              <div key={i} style={{ padding: "24px 28px", border: `1px solid ${border}`, background: bg, cursor: "default", transition: "background 0.2s", opacity: modulesIn ? 1 : 0, transition2: `opacity 0.5s ${i * 0.03}s` as never } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = card; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = bg; }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: fg, marginBottom: 6, letterSpacing: "-0.02em" }}>{name}</div>
                <div style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          BUSINESS IMPACT
      ═══════════════════════════════════════════════════ */}
      <div ref={impactRef} id="impact" style={{ borderTop: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
            <div style={{ opacity: impactIn ? 1 : 0, transform: impactIn ? "translateX(0)" : "translateX(-30px)", transition: "all 0.8s" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>{t("demo_showcase.impact_label")}</div>
              <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 900, color: fg, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 24 }}>
                {t("demo_showcase.impact_title")}
              </h2>
              <p style={{ fontSize: 16, color: muted, lineHeight: 1.7 }}>
                {t("demo_showcase.impact_sub")}
              </p>
            </div>
            <div style={{ opacity: impactIn ? 1 : 0, transform: impactIn ? "translateX(0)" : "translateX(30px)", transition: "all 0.8s 0.1s" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, border: `1px solid ${border}` }}>
                {tx.impactItems.map(([v, l], i) => (
                  <div key={i} style={{ padding: "28px 24px", border: `1px solid ${border}`, background: bg }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: fg, letterSpacing: "-0.04em", marginBottom: 6, opacity: impactIn ? 1 : 0, transition: `opacity 0.5s ${0.3 + i * 0.1}s` }}>{v}</div>
                    <div style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════ */}
      <div id="cta" style={{ borderTop: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "120px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "clamp(36px, 5vw, 72px)", fontWeight: 900, color: fg, letterSpacing: "-0.04em", lineHeight: 1.0, marginBottom: 32 }}>
              {t("demo_showcase.cta_title")}
            </h2>
            <p style={{ fontSize: 16, color: muted, lineHeight: 1.7, marginBottom: 40, maxWidth: 380 }}>
              {t("demo_showcase.cta_sub")}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <a href="/login" style={{ padding: "14px 32px", borderRadius: 8, background: fg, color: bg, fontSize: 14, fontWeight: 700, textDecoration: "none", letterSpacing: "-0.02em" }}>
                {t("demo_showcase.launch_crm")}
              </a>
              <a href="https://wa.me/919502901416?text=Hi,%20I'd%20like%20to%20book%20a%20CRM%20demo" target="_blank" rel="noopener noreferrer"
                style={{ padding: "14px 32px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: fg, fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.02em" }}>
                {t("demo_showcase.book_demo")}
              </a>
            </div>
          </div>
          <div>
            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 24 }}>{t("demo_showcase.platform_overview")}</div>
              {tx.platformItems.map(([title, desc], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderBottom: i < 5 ? `1px solid ${border}` : "none" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: fg }}>{title}</div>
                  <div style={{ fontSize: 11, color: muted, textAlign: "right", maxWidth: 200 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${border}`, padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: muted }}>{t("demo_showcase.footer")}</div>
          <div style={{ fontSize: 11, color: muted }}>
            Developed by Varshith, part of SERP HAWK · <a href="mailto:varshith@serphawk.com" style={{ color: fg, textDecoration: "none" }}>varshith@serphawk.com</a>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={() => setLanguage(lang === "en" ? "es" : "en")} style={{ fontSize: 11, color: muted, background: "transparent", border: "none", cursor: "pointer" }}>
            {lang === "en" ? "Ver en Español" : "View in English"}
          </button>
          <button onClick={() => setTheme(t2 => t2 === "dark" ? "light" : "dark")} style={{ fontSize: 11, color: muted, background: "transparent", border: "none", cursor: "pointer" }}>
            {theme === "dark" ? t("demo_showcase.switch_to_white") : t("demo_showcase.switch_to_black")}
          </button>
        </div>
      </div>
    </div>
  );
}
