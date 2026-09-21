"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Users,
  DollarSign,
  Zap,
  List,
  Bell,
  Download,
  Clock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Server,
  Globe,
  Filter,
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

type Tab = "overview" | "providers" | "sales" | "clients" | "endpoints" | "requests" | "live" | "alerts";

const TAB_ICONS: Record<string, typeof Activity> = {
  overview: BarChart3,
  providers: BrainCircuit,
  sales: Users,
  clients: DollarSign,
  endpoints: Server,
  requests: List,
  live: Zap,
  alerts: Bell,
};
const TAB_NAMES: Record<string, string> = {
  overview: "tab_overview",
  providers: "tab_models",
  sales: "tab_sales_team",
  clients: "tab_clients",
  endpoints: "tab_endpoints",
  requests: "tab_request_log",
  live: "tab_live_monitor",
  alerts: "tab_alerts",
};

// ── STAT CARD ──────────────────────────────────────────────────────────────
function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  color = "#2563eb",
}: {
  title: string;
  value: string;
  sub: string;
  icon: typeof Activity;
  trend?: "up" | "down" | null;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="absolute top-0 left-0 w-full h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-bold ${trend === "up" ? "text-emerald-500" : "text-red-400"}`}>
            {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend === "up" ? "+12%" : "-5%"}
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-secondary)" }}>
          {title}
        </p>
        <p className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {value}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </p>
      </div>
    </motion.div>
  );
}

// ── MINI BAR CHART ─────────────────────────────────────────────────────────
function MiniBar({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
            {typeof v === "number" && v > 0.001 ? (v < 1 ? `$${v.toFixed(3)}` : v.toLocaleString()) : v}
          </span>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(v / max) * 100}%` }}
            transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
            className="w-full rounded-t-lg cursor-pointer transition-opacity hover:opacity-80 min-h-[3px]"
            style={{ background: color }}
          />
          <span className="text-[9px] font-medium" style={{ color: "var(--text-secondary)" }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── STATUS DOT ────────────────────────────────────────────────────────────
function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
  );
}

// ── TABLE WRAPPER ─────────────────────────────────────────────────────────
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl overflow-hidden ${className ?? ""}`} style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
      {children}
    </th>
  );
}

function Td({ children, mono, green, red }: { children: React.ReactNode; mono?: boolean; green?: boolean; red?: boolean }) {
  return (
    <td
      className={`px-5 py-3.5 text-[13px] ${mono ? "font-mono" : ""}`}
      style={{ color: green ? "#10b981" : red ? "#ef4444" : "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}
    >
      {children}
    </td>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function ApiIntelligencePage() {
  const { role, isAuthenticated } = useRole();
  const { t } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [trend, setTrend] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (role !== "Admin") { router.push("/"); return; }
    fetchData();
  }, [isAuthenticated, role]);

  // Auto-scroll live feed
  useEffect(() => {
    if (activeTab === "live" && liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [requests, activeTab]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    const safeFetch = async (url: string) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        console.error(`Failed to fetch ${url}`, e);
        return null;
      }
    };

    try {
      const [ov, prov, sales, cli, endp, req, trn] = await Promise.all([
        safeFetch(`${API_BASE_URL}/api-intelligence/overview`),
        safeFetch(`${API_BASE_URL}/api-intelligence/providers`),
        safeFetch(`${API_BASE_URL}/api-intelligence/salespersons`),
        safeFetch(`${API_BASE_URL}/api-intelligence/clients`),
        safeFetch(`${API_BASE_URL}/api-intelligence/endpoints`),
        safeFetch(`${API_BASE_URL}/api-intelligence/requests?limit=100`),
        safeFetch(`${API_BASE_URL}/api-intelligence/charts/trend`),
      ]);
      setOverview(ov);
      setProviders(prov || []);
      setSalespersons(sales || []);
      setClients(cli || []);
      setEndpoints(endp || []);
      setRequests(req || []);
      setTrend(trn);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Live polling every 5s on live tab
  useEffect(() => {
    if (activeTab !== "live") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api-intelligence/requests?limit=50`);
        const data = await res.json();
        setRequests(data);
        setLastUpdated(new Date());
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  if (!isAuthenticated || role !== "Admin") return null;

  return (
    <div className="min-h-screen py-6 px-4 md:px-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-4 mb-7 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {t("api_intelligence.title")}
            </h1>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {t("api_intelligence.subtitle")}
              {lastUpdated && (
                <span className="ml-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  · {t("api_intelligence.updated")} {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => fetchData(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold border transition-all disabled:opacity-50"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {t("api_intelligence.refresh")}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#2563eb,#6366f1)", boxShadow: "0 4px 14px rgba(37,99,235,0.28)" }}
          >
            <Download className="w-3.5 h-3.5" />
            {t("api_intelligence.export")}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Tab Bar ── */}
      <div
        className="flex gap-0.5 p-1 rounded-2xl mb-6 overflow-x-auto shrink-0"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {TAB_NAMES && Object.entries(TAB_NAMES).map(([id, nameKey]) => {
          const Icon = TAB_ICONS[id];
          const tabName = t(`api_intelligence.${nameKey}`);
          return (
          <button
            key={id}
            onClick={() => setActiveTab(id as Tab)}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all whitespace-nowrap"
            style={activeTab === id ? { color: "#2563eb" } : { color: "var(--text-secondary)" }}
          >
            {activeTab === id && (
              <motion.div layoutId="tab-bg" className="absolute inset-0 rounded-xl" style={{ background: "rgba(37,99,235,0.08)" }} />
            )}
            <Icon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{tabName}</span>
            {id === "live" && (
              <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="relative w-12 h-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent" />
            <div className="absolute inset-2.5 rounded-full bg-blue-600 opacity-20 animate-pulse" />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("api_intelligence.loading")}</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && overview && (
              <div className="space-y-5">
                {/* Metric cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title={t("api_intelligence.total_tokens")} value={overview.tokens.total.toLocaleString()} sub={`${overview.tokens.input.toLocaleString()} in · ${overview.tokens.output.toLocaleString()} out`} icon={BrainCircuit} trend="up" color="#2563eb" />
                  <StatCard title={t("api_intelligence.total_cost")} value={`$${overview.cost.total.toFixed(4)}`} sub={`$${overview.cost.today.toFixed(2)} ${t("api_intelligence.today")}`} icon={DollarSign} trend="down" color="#10b981" />
                  <StatCard title={t("api_intelligence.api_calls")} value={overview.calls.total.toLocaleString()} sub={`${overview.calls.today} ${t("api_intelligence.today")}`} icon={Activity} trend="up" color="#6366f1" />
                  <StatCard title={t("api_intelligence.projected_annual")} value={`$${overview.cost.annual_projection.toFixed(2)}`} sub={t("api_intelligence.based_on_month")} icon={TrendingUp} color="#f59e0b" />
                </div>

                {/* Trend charts */}
                {trend && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>{t("api_intelligence.token_consumption")}</h3>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb" }}>{t("api_intelligence.last_7_days")}</span>
                        </div>
                        <MiniBar data={trend.tokens} labels={trend.labels} color="#2563eb" />
                      </div>
                    </Card>
                    <Card>
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>{t("api_intelligence.cost_trend")}</h3>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}>{t("api_intelligence.last_7_days")}</span>
                        </div>
                        <MiniBar data={trend.costs} labels={trend.labels} color="#10b981" />
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* ── AI MODELS ── */}
            {activeTab === "providers" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map((p, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card>
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                            {p.provider?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-[15px] capitalize" style={{ color: "var(--text-primary)" }}>{p.provider}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <StatusDot ok={p.error_rate < 5} />
                              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{p.error_rate < 5 ? t("api_intelligence.healthy") : t("api_intelligence.degraded")}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: t("api_intelligence.calls"), value: p.calls.toLocaleString(), color: "#6366f1" },
                            { label: t("api_intelligence.tokens"), value: p.tokens.toLocaleString(), color: "#2563eb" },
                            { label: t("api_intelligence.total_cost"), value: `$${p.cost.toFixed(4)}`, color: "#10b981" },
                            { label: t("api_intelligence.avg_latency"), value: `${p.avg_response_time.toFixed(0)}ms`, color: "#f59e0b" },
                          ].map((m) => (
                            <div key={m.label} className="p-2.5 rounded-xl" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-secondary)" }}>{m.label}</p>
                              <p className="text-[15px] font-extrabold" style={{ color: m.color }}>{m.value}</p>
                            </div>
                          ))}
                        </div>
                        {/* Error rate bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span style={{ color: "var(--text-secondary)" }}>{t("api_intelligence.error_rate")}</span>
                            <span style={{ color: p.error_rate > 5 ? "#ef4444" : "#10b981" }}>{p.error_rate.toFixed(1)}%</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(p.error_rate, 100)}%`, background: p.error_rate > 5 ? "#ef4444" : "#10b981" }} />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── SALES TEAM ── */}
            {activeTab === "sales" && (
              <Card>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr><Th>{t("api_intelligence.salesperson")}</Th><Th>{t("api_intelligence.api_calls")}</Th><Th>{t("api_intelligence.tokens")}</Th><Th>{t("api_intelligence.cost_generated")}</Th></tr>
                  </thead>
                  <tbody>
                    {salespersons.map((s, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs">{s.name?.[0]}</div>
                            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{s.name}</span>
                          </div>
                        </Td>
                        <Td>{s.calls.toLocaleString()}</Td>
                        <Td>{s.tokens.toLocaleString()}</Td>
                        <Td green>${s.cost.toFixed(4)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* ── CLIENTS ── */}
            {activeTab === "clients" && (
              <Card>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr><Th>{t("api_intelligence.client")}</Th><Th>{t("api_intelligence.api_calls")}</Th><Th>{t("api_intelligence.tokens")}</Th><Th>{t("api_intelligence.cost")}</Th></tr>
                  </thead>
                  <tbody>
                    {clients.map((c, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs">{c.companyName?.[0]}</div>
                            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{c.companyName}</span>
                          </div>
                        </Td>
                        <Td>{c.calls.toLocaleString()}</Td>
                        <Td>{c.tokens.toLocaleString()}</Td>
                        <Td green>${c.cost.toFixed(4)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* ── ENDPOINTS ── */}
            {activeTab === "endpoints" && (
              <Card>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr><Th>{t("api_intelligence.endpoint")}</Th><Th>{t("api_intelligence.hits")}</Th><Th>{t("api_intelligence.tokens")}</Th><Th>{t("api_intelligence.cost")}</Th><Th>{t("api_intelligence.avg_latency")}</Th></tr>
                  </thead>
                  <tbody>
                    {endpoints.map((e, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <Td>
                          <span className="font-mono text-[12px] px-2 py-0.5 rounded-md" style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb" }}>
                            {e.endpoint}
                          </span>
                        </Td>
                        <Td>{e.hits.toLocaleString()}</Td>
                        <Td>{e.tokens.toLocaleString()}</Td>
                        <Td green>${e.cost.toFixed(4)}</Td>
                        <Td>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" style={{ color: "var(--text-secondary)" }} />
                            {e.avg_latency.toFixed(0)}ms
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* ── REQUEST LOG ── */}
            {activeTab === "requests" && (
              <Card>
                <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {requests.length} {t("api_intelligence.requests_logged")}
                  </span>
                  <button className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50" style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}>
                    <Filter className="w-3.5 h-3.5" /> {t("api_intelligence.filter")}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr><Th>{t("api_intelligence.time")}</Th><Th>{t("api_intelligence.endpoint")}</Th><Th>{t("api_intelligence.user")}</Th><Th>{t("api_intelligence.model")}</Th><Th>{t("api_intelligence.tokens")}</Th><Th>{t("api_intelligence.cost")}</Th><Th>{t("api_intelligence.latency")}</Th><Th>{t("api_intelligence.status")}</Th></tr>
                    </thead>
                    <tbody>
                      {requests.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                          <Td>{new Date(r.timestamp).toLocaleTimeString()}</Td>
                          <Td>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md" style={{ background: "rgba(37,99,235,0.07)", color: "#2563eb" }}>
                              {r.endpoint}
                            </span>
                          </Td>
                          <Td>{r.salesperson}</Td>
                          <Td>
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>
                              {r.model}
                            </span>
                          </Td>
                          <Td>{r.total_tokens.toLocaleString()}</Td>
                          <Td green>${r.total_cost.toFixed(4)}</Td>
                          <Td>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" style={{ color: "var(--text-secondary)" }} />
                              {r.response_time_ms}ms
                            </span>
                          </Td>
                          <Td>
                            {r.status === "success" || !r.status ? (
                              <span className="flex items-center gap-1 text-emerald-500"><CheckCircle className="w-3.5 h-3.5" />{t("api_intelligence.ok")}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3.5 h-3.5" />{t("api_intelligence.error")}</span>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ── LIVE MONITOR ── */}
            {activeTab === "live" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 font-semibold text-emerald-500 text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live API Stream — {t("api_intelligence.auto_refresh")}
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {requests.length} {t("api_intelligence.events_loaded")}
                  </span>
                </div>

                {/* Terminal */}
                <div className="rounded-2xl overflow-hidden" style={{ background: "#0d1117", border: "1px solid #30363d" }}>
                  {/* Terminal bar */}
                  <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #30363d" }}>
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="ml-3 text-[11px] font-mono text-gray-500">api-intelligence/stream</span>
                    <span className="ml-auto text-[11px] font-mono text-emerald-400">● {t("api_intelligence.connected")}</span>
                  </div>
                  <div ref={liveRef} className="p-4 max-h-[500px] overflow-y-auto space-y-1 font-mono text-[12px]" style={{ scrollbarWidth: "none" }}>
                    {requests.map((r, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-3 items-baseline py-0.5 hover:bg-white/[0.03] px-1.5 rounded transition-colors"
                      >
                        <span className="text-gray-600 w-20 shrink-0">{new Date(r.timestamp).toLocaleTimeString()}</span>
                        <span className="text-blue-400 w-28 shrink-0 truncate">{r.salesperson}</span>
                        <span className="text-emerald-400 w-40 shrink-0 truncate">{r.endpoint}</span>
                        <span className="text-purple-400 w-28 shrink-0 truncate">{r.model}</span>
                        <span className="text-yellow-400 w-20 shrink-0">{r.total_tokens} tkns</span>
                        <span className="text-gray-400">${r.total_cost?.toFixed(5)}</span>
                        <span className="text-gray-600">{r.response_time_ms}ms</span>
                      </motion.div>
                    ))}
                    {requests.length === 0 && (
                      <p className="text-gray-600 text-center py-8">{t("api_intelligence.waiting")}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── ALERTS ── */}
            {activeTab === "alerts" && (
              <div className="space-y-4">
                <Card>
                  <div className="p-6 flex flex-col items-center text-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                      <Bell className="w-7 h-7 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[16px]" style={{ color: "var(--text-primary)" }}>{t("api_intelligence.alert_config")}</h3>
                      <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                        {t("api_intelligence.alert_config_desc")}
                      </p>
                    </div>

                    {/* Quick alert presets */}
                    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                      {[
                        { title: t("api_intelligence.cost_threshold"), desc: t("api_intelligence.cost_threshold_desc"), icon: DollarSign, color: "#10b981" },
                        { title: t("api_intelligence.error_rate_spike"), desc: t("api_intelligence.error_rate_spike_desc"), icon: AlertTriangle, color: "#f59e0b" },
                        { title: t("api_intelligence.token_limit"), desc: t("api_intelligence.token_limit_desc"), icon: BrainCircuit, color: "#6366f1" },
                      ].map((a) => (
                        <div key={a.title} className="p-4 rounded-xl text-left cursor-pointer hover:opacity-90 transition-opacity border" style={{ background: `${a.color}08`, borderColor: `${a.color}22` }}>
                          <a.icon className="w-4 h-4 mb-2" style={{ color: a.color }} />
                          <p className="font-bold text-[13px]" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{a.desc}</p>
                        </div>
                      ))}
                    </div>

                    <button
                      className="px-6 py-2.5 rounded-xl font-bold text-[13px] text-white mt-2 transition-all"
                      style={{ background: "linear-gradient(135deg,#2563eb,#6366f1)", boxShadow: "0 4px 14px rgba(37,99,235,0.28)" }}
                    >
                      {t("api_intelligence.create_new_alert")}
                    </button>
                  </div>
                </Card>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
