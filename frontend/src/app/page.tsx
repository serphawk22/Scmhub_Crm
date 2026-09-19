"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Users, Send, Clock, Briefcase, Target, Zap, Activity,
  Globe, CheckCircle, FolderKanban, Mail, ArrowUpRight,
  Bot, UserCheck, GraduationCap, Phone, Sparkles, FileText, ChevronRight, MessageCircle,
  Shield, Lock, FileCheck, Bell, DollarSign, TrendingUp, Eye, Download, AlertTriangle, CheckCircle2, Circle, Timer, Rocket, Kanban
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { fetchWithCache } from "@/lib/cache";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import PageGuide from '@/components/PageGuide';
import { AdminDashboard } from "@/components/AdminDashboard";
import { DeveloperDashboard } from "@/components/DeveloperDashboard";
import { SalesManagerDashboard } from "@/components/SalesManagerDashboard";
import { ClientDashboard } from "@/components/ClientDashboard";
import { DemoDashboard } from "@/components/DemoDashboard";
import Link from "next/link";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120 } },
};

interface RecentActivity {
  id: number; action: string; method: string; content: string; createdAt: string | null;
}
interface AdminStats {
  total: number; active: number; pending: number; hold: number;
  totalProjects: number; totalEmailsSent: number; totalActivities: number;
  totalCalls: number; totalEmployees: number; totalInterns: number;
  totalMarketplaceServices: number;
  chartLabels: string[]; activityChart: number[]; emailChart: number[]; callChart: number[];
  recentActivities: RecentActivity[];
}
interface ClientStats {
  isClient: true; companyName: string; projectName: string; website: string;
  status: string; seoStrategy: string; recommended_services: string;
  targetKeywords: string[]; nextMilestone: string; nextMilestoneDate: string;
  active_services_list: ActiveService[];
  pending_quotes_list: PendingQuote[];
  pending_requests_count: number;
  milestones: Milestone[];
  invoices: Invoice[];
  invoice_summary: { total_billed: number; total_paid: number; total_pending: number; total_overdue: number };
  files: ClientFile[];
  activities: Activity[];
  notifications: Notification[];
  unread_notifications_count: number;
  proposals: Proposal[];
  projects: Project[];
}

interface ActiveService {
  id: number;
  service_id: number;
  status: string;
  service_name: string;
}

interface PendingQuote {
  id: number;
  service_id: number;
  quoted_amount: number;
  quote_message: string;
  service_name: string;
}

interface Milestone {
  id: number;
  title: string;
  description: string;
  due_date: string;
  status: string;
  order: number;
  created_at: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  amount: number;
  tax: number;
  total: number;
  status: string;
  due_date: string;
  notes: string;
  line_items: any[];
  paid_at: string | null;
  created_at: string;
}

interface ClientFile {
  id: number;
  filename: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  description: string;
  created_at: string;
}

interface Activity {
  id: number;
  action: string;
  method: string;
  content: string;
  details: string;
  createdAt: string;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

interface Proposal {
  id: number;
  title: string;
  status: string;
  total_value: number;
  valid_until: string;
  created_at: string;
}

interface Project {
  id: number;
  name: string;
  status: string;
  progress: number;
  created_at: string;
}

type StatsData = AdminStats | ClientStats | null;


// Inline mini bar chart (no external library needed)
function MiniBarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-16 w-full">
      {data.map((val, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1 h-full justify-end group">
          <div className="relative w-full flex items-end justify-center h-full">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(val / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
              className={cn("w-full rounded-t-lg min-h-[3px] opacity-80", color)}
              title={`${labels[i]}: ${val}`}
            />
          </div>
          <span className="text-[9px] font-bold">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, gradient, href }: {
  title: string; value: number | string; sub: string; icon: any; gradient: string; href?: string;
}) {
  const inner = (
    <motion.div variants={itemVariants} className="relative group overflow-hidden glass-card glass-card-hover cursor-pointer">
      <div className={cn("absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br", gradient)} />
      {/* Top accent line */}
      <div className={cn("absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-60 transition-opacity bg-gradient-to-r", gradient)} />
      <div className="relative p-5 flex flex-col z-10">
        <div className="flex justify-between items-start mb-3">
          <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-lg", gradient)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          {href && <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 dark:text-zinc-400 transition-colors" />}
        </div>
        <p className="text-[11px] font-black text-slate-600 dark:text-zinc-300 uppercase tracking-widest mb-0.5">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 dark:text-zinc-50 tracking-tight">{value}</h3>
        <div className="mt-2 inline-flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          <p className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">{sub}</p>
        </div>
      </div>
    </motion.div>
  );
  return href ? <Link href={href} className="cursor-pointer">{inner}</Link> : inner;
}

export default function HomePage() {
  const { role, email, user, isAuthenticated, loading: authLoading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      window.location.href = "/showcase/index.html";
      return;
    }
    if (role === "Employee") {
      router.replace("/projects");
    }
  }, [authLoading, isAuthenticated, role, router]);

  // Show landing page if not authenticated
  if (!authLoading && !isAuthenticated) {
    return null;
  }

  // Show dashboard if authenticated
  return <Dashboard />;
}

function Dashboard() {
  const { role, email, user } = useRole();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<StatsData>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = role === "Admin";

  const NAV_CARDS = [
    { href: "/clients", icon: Users, gradient: "from-indigo-500 to-indigo-600", title: language === 'es' ? "Centro de Clientes" : "Clients Hub", description: language === 'es' ? "La Fundación: Gestione cada perfil de cliente, realice un seguimiento de los protocolos de crecimiento, hitos y mantenga relaciones profesionales en un solo lugar." : "The Foundation: Manage every client profile, track growth protocols, milestones, and maintain professional relationships in one central hub.", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
    { href: "/sales-manager", icon: UserCheck, gradient: "from-fuchsia-500 to-pink-600", title: language === 'es' ? "Centro de Gerente de Ventas" : "Sales Manager Hub", description: language === 'es' ? "Espacio de trabajo para el propietario de los ingresos en cuentas asignadas, registros de comunicación, traspasos de facturas y escalado administrativo." : "Revenue owner workspace for assigned accounts, communication logs, invoice handoffs, and admin escalation.", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
    { href: "/admin/sales-team", icon: UserCheck, gradient: "from-teal-500 to-emerald-500", title: language === 'es' ? "Equipo de Ventas" : "Sales Team", description: language === 'es' ? "Espacio de trabajo del administrador para agregar vendedores, gestionar cuentas y crear acceso de inicio de sesión para los Gerentes de Ventas." : "Admin workspace for adding salespeople, managing accounts, and creating Sales Manager login access.", roles: ["Admin"] },
    { href: "/email-agent", icon: Bot, gradient: "from-violet-500 to-purple-600", title: language === 'es' ? "Agente de Email" : "Email Agent", description: language === 'es' ? "Motor de Crecimiento: Alcance automatizado por IA que analiza prospectos y redacta correos personalizados bilingües para escalar sus ingresos." : "Growth Engine: AI-powered outreach that auto-analyzes leads and drafts personalized bilingual emails to scale your revenue automatically.", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
    { href: "/calls", icon: Phone, gradient: "from-amber-500 to-orange-600", title: language === 'es' ? "Centro de Llamadas" : "Call Center", description: language === 'es' ? "Inteligencia de Puntos de Contacto: Registre cada conversación, haga seguimiento y asegúrese de que ningún prospecto quede sin un próximo paso claro." : "Touchpoint Intelligence: Log every conversation, track follow-ups, and ensure no lead is ever left without a clear next step or work assignment.", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
    { href: "/projects", icon: FolderKanban, gradient: "from-sky-400 to-cyan-500", title: language === 'es' ? "Tablero de Proyectos" : "Project Board", description: language === 'es' ? "Capa de Ejecución: Supervise flujos de trabajo complejos, asigne miembros del equipo y asegúrese de que cada hito se entregue con precisión." : "Execution Layer: Oversee complex workflows, assign specialized team members, and ensure every milestone is delivered with precision and quality.", roles: ["Admin", "Employee", "Intern", "ProjectMember", "Demo"] },
    { href: "/interns", icon: GraduationCap, gradient: "from-rose-400 to-rose-500", title: language === 'es' ? "Grupo de Talentos" : "Talent Pool", description: language === 'es' ? "Soporte de Escala: Administre a sus pasantes, asigne tareas de aprendizaje y monitoree su contribución." : "Scale Support: Manage your interns, assign learning tasks, and monitor their contribution to the core team's productivity and growth.", roles: ["Admin", "Employee", "Demo"] },
    { href: "/admin/services-overview", icon: Briefcase, gradient: "from-fuchsia-500 to-pink-600", title: language === 'es' ? "Resumen de Servicios" : "Services Overview", description: language === 'es' ? "Tablero Principal: Vista de toda la organización de las líneas de servicio activas, clientes consumidores y equipos de ejecución asignados." : "Master Board: Organization-wide view of all active service lines, client consumers, and assigned execution teams.", roles: ["Admin", "Employee"] },
    { href: "/setup", icon: Globe, gradient: "from-indigo-500 to-indigo-600", title: language === 'es' ? "Configuración Inicial" : "Initial Setup", description: language === 'es' ? "Conecte su sitio web y perfiles de redes sociales para análisis automático multicanal." : "Connect your website and social media profiles for automated cross-channel analysis.", roles: ["Client"] },
    { href: "/audit", icon: Activity, gradient: "from-emerald-500 to-teal-500", title: language === 'es' ? "Auditoría en 1 Clic" : "One-Click Audit", description: language === 'es' ? "Ejecute escaneos profundos de SEO técnico y compare su rendimiento con el de sus principales competidores." : "Run deep technical SEO scans and compare your performance against top competitors.", roles: ["Client", "Admin", "Employee", "Demo"] },
    { href: "/messages", icon: Send, gradient: "from-violet-500 to-purple-600", title: language === 'es' ? "Centro de Comunicación" : "Team Comm Hub", description: language === 'es' ? "Comunicación directa con especialistas SEO, archivos compartidos y colas prioritarias." : "Direct communication with your assigned SEO specialists, shared files, and priority queues.", roles: ["Client", "Admin", "Employee", "Demo"] },
    { href: "/monitor", icon: Target, gradient: "from-amber-500 to-orange-600", title: language === 'es' ? "Monitor en Vivo" : "Live Monitor", description: language === 'es' ? "Rastreador de clasificación en tiempo real y análisis de rendimiento sincronizado con GA4 y GSC." : "Real-time ranking tracker and performance analytics synced with GA4 and GSC.", roles: ["Client"] },
    { href: "/store", icon: Briefcase, gradient: "from-indigo-500 to-violet-600", title: language === 'es' ? "Servicios de Crecimiento" : "Growth Services", description: language === 'es' ? "Explore nuestro catálogo exclusivo de servicios de crecimiento. Solicite cualquier cosa y reciba una cotización personalizada." : "Explore our exclusive catalog of growth services. Request anything and receive a personalized quote from your dedicated team.", roles: ["Client"] },
    { href: "/pipeline", icon: Kanban, gradient: "from-blue-500 to-indigo-600", title: language === 'es' ? "Pipeline de Ventas" : "Sales Pipeline", description: language === 'es' ? "Pipeline visual Kanban." : "Visual drag-and-drop Kanban board for managing deals.", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
  ];

  useEffect(() => {
    if (!role) return;
    const url = `${API_BASE_URL}/dashboard-stats?role=${role}&email=${email}`;
    fetchWithCache<StatsData>(
      url,
      (data: StatsData, _isFromCache: boolean) => {
        setStats(data);
        setLoading(false);
      },
      60_000
    ).catch(() => setLoading(false));
  }, [role, email]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(37,99,235,0.07) 0%, transparent 70%)" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="ddots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#2563eb" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#ddots)" />
        </svg>
        <div className="relative flex flex-col items-center gap-9">
          <div className="relative" style={{ width: 160, height: 160 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} className="absolute inset-0" style={{ borderRadius: "50%", border: "1.5px solid rgba(37,99,235,0.14)" }}>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.7)]" />
            </motion.div>
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }} className="absolute inset-[20px]" style={{ borderRadius: "50%", border: "1.5px solid rgba(99,102,241,0.16)" }}>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.7)]" />
            </motion.div>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} className="absolute inset-[38px]" style={{ borderRadius: "50%", border: "1.5px solid rgba(139,92,246,0.16)" }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div animate={{ scale: [1, 1.07, 1], boxShadow: ["0 0 0px rgba(37,99,235,0.3)", "0 0 28px rgba(37,99,235,0.55)", "0 0 0px rgba(37,99,235,0.3)"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)" }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                  <path d="M12 3L3 8.5V15.5L12 21L21 15.5V8.5L12 3Z" fill="white" fillOpacity="0.9" />
                  <path d="M12 7L7 10V14L12 17L17 14V10L12 7Z" fill="white" fillOpacity="0.45" />
                  <circle cx="12" cy="12" r="2" fill="white" />
                </svg>
              </motion.div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <motion.span className="text-lg font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              SERP Hawk{" "}<span style={{ background: "linear-gradient(90deg,#2563eb,#6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CRM</span>
            </motion.span>
            <motion.p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
              {t("dashboard.loading")}
            </motion.p>
          </div>
          <div className="w-52">
            <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#2563eb,#6366f1,#8b5cf6)", width: "40%" }} animate={{ x: ["-100%", "350%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback if role is not set
  if (!role) {
    return (
      <motion.div initial="hidden" animate="show" variants={containerVariants}>
        <motion.div variants={itemVariants} className="glass-card p-10 text-center">
          <span className="text-[10px] tracking-widest font-black text-amber-600 uppercase">{t("dashboard.warning")}</span>
          <h1 className="text-3xl font-black text-slate-800 dark:text-zinc-100 mt-1 mb-3">{t("dashboard.session_error")}</h1>
          <p className="text-slate-400 font-medium">{t("dashboard.session_error_desc")}</p>
        </motion.div>
      </motion.div>
    );
  }

  const adminStats = (isAdmin || role === "Demo") ? (stats as AdminStats) : null;
  const clientStats = (!isAdmin && role !== "Demo") ? (stats as ClientStats) : null;
  const visibleNavCards = NAV_CARDS.filter(c => c.roles.includes(role));

  if (role === "Supplier") {
    if (typeof window !== 'undefined') {
      window.location.href = '/supplier';
    }
    return null;
  }

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className={cn(isAdmin || role === 'ProjectMember' || role === 'Demo' ? "space-y-6" : "")}>
      {role === "ProjectMember" && <DeveloperDashboard />}
      {role === "SalesManager" && <SalesManagerDashboard />}
      {isAdmin && adminStats && <AdminDashboard adminStats={adminStats} NAV_CARDS={NAV_CARDS} language={language} />}
      {role === "Demo" && <AdminDashboard adminStats={adminStats} NAV_CARDS={visibleNavCards} language={language} isDemo={true} />}
      {!isAdmin && role !== "Demo" && role !== "ProjectMember" && role !== "SalesManager" && role !== "Supplier" && (
        <ClientDashboard clientStats={clientStats} NAV_CARDS={visibleNavCards} language={language} />
      )}

      {/* FALLBACK: If stats didn't load but we're authenticated */}
      {!stats && role && (
        <motion.div variants={itemVariants} className="glass-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-amber-500/15 border border-amber-500/20">
              <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="font-bold text-white/80 text-lg">{t("dashboard.loading_title")}</h3>
            <p className="text-white/40 text-sm max-w-md">{t("dashboard.loading_desc")}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 btn-glow-indigo px-6 py-2.5 rounded-xl font-bold text-sm text-white"
            >
              {t("dashboard.refresh_page")}
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
