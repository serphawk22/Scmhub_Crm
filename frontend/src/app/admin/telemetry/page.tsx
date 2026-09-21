"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Mail, Radar, Globe, UserPlus, ArrowLeft,
  BarChart2, Clock, TrendingUp, Eye, Search, RefreshCw,
  Activity, CheckCircle2, AlertTriangle, Calendar, PhoneCall, Folder, UserCheck, Wrench,
  Brain, Target
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DemoAccount {
  id: number;
  email: string;
  name: string;
  created_at: string;
  tenant_id: number | null;
}

interface LimitData { usage: number; limit: number }
interface DemoDetail {
  user: { id: number; name: string; email: string; created_at: string; upgrade_requested?: boolean };
  clients:  Array<{ id: number; company: string; website: string; status: string; created_at: string }>;
  leads:    Array<{ id: number; name: string; email: string; company: string; status: string; created_at: string }>;
  contacts: Array<{ id: number; name: string; email: string; designation: string }>;
  radar:    Array<{ id: number; target_name: string; target_website: string; competitor_count: number; radius_km: number; run_date: string }>;
  emails:   Array<{ id: number; to: string; subject: string; status: string; sent_at: string }>;
  meetings: Array<{ id: number; title: string; status: string; scheduled_at: string }>;
  calls:    Array<{ id: number; phone: string; duration: number; summary: string; received_at: string }>;
  projects: Array<{ id: number; name: string; status: string; progress: number }>;
  team_members: Array<{ id: number; name: string; email: string; role: string }>;
  researches: Array<{ id: number; company_overview: string; updated_at: string }>;
  competitors: Array<{ id: number; competitor_domain: string; last_updated: string }>;
  limits:   { clients: LimitData; emails: LimitData; searches: LimitData; projects: LimitData; calls?: LimitData } | null;
}

// ─── Helper components ────────────────────────────────────────────────────────
function UsageBar({ label, usage, limit, color }: { label: string; usage: number; limit: number; color: string }) {
  const pct = Math.min((usage / limit) * 100, 100);
  const isRed = pct >= 100, isAmber = pct >= 80;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-zinc-300">
        <span>{label}</span>
        <span className={isRed ? "text-red-500" : isAmber ? "text-amber-500" : ""}>{usage}/{limit}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${isRed ? "bg-red-500" : isAmber ? "bg-amber-500" : color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">{label}</p>
        <p className="text-2xl font-black text-slate-800 dark:text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <div className="py-12 text-center text-slate-400 text-sm">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
          <tr>{headers.map(h => <th key={h} className="px-5 py-3 text-left whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/60">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20">
              {cells.map((cell, j) => <td key={j} className="px-5 py-3 text-slate-700 dark:text-zinc-300">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${color}`}>{text}</span>;
}

// ─── Demo Detail Full Screen ──────────────────────────────────────────────────
function DemoDetail({ account, onBack }: { account: DemoAccount; onBack: () => void }) {
  const { user } = useRole();
  const { t } = useLanguage();
  const [detail, setDetail] = useState<DemoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [tab, setTab] = useState<"overview" | "clients" | "leads" | "contacts" | "radar" | "emails" | "meetings" | "calls" | "projects" | "team">("overview");

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/demo-account/${account.id}`, {
        headers: { "X-Tenant-ID": "" }
      });
      const data = await res.json();
      if (data.success) setDetail(data);
    } catch {}
    setLoading(false);
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      await fetch(`${API_BASE_URL}/admin/backfill-tenant-data/${account.id}`, {
        method: "POST", headers: { "X-Tenant-ID": "" }
      });
      await loadDetail();
    } catch {}
    setBackfilling(false);
  };

  useEffect(() => { loadDetail(); }, [account.id]);

  const tabs = [
    { key: "overview",  label: t("telemetry.tab_overview"),        icon: <BarChart2  className="w-3.5 h-3.5" /> },
    { key: "clients",   label: t("telemetry.tab_clients"),          icon: <Users      className="w-3.5 h-3.5" />, count: detail?.clients?.length },
    { key: "leads",     label: t("telemetry.tab_leads"),            icon: <TrendingUp className="w-3.5 h-3.5" />, count: detail?.leads?.length },
    { key: "contacts",  label: t("telemetry.tab_contacts"),         icon: <UserPlus   className="w-3.5 h-3.5" />, count: detail?.contacts?.length },
    { key: "radar",     label: t("telemetry.tab_radar"),            icon: <Radar      className="w-3.5 h-3.5" />, count: detail?.radar?.length },
    { key: "emails",    label: t("telemetry.tab_email_agent"),      icon: <Mail       className="w-3.5 h-3.5" />, count: detail?.emails?.length },
    { key: "meetings",  label: t("telemetry.tab_meetings"),         icon: <Calendar   className="w-3.5 h-3.5" />, count: detail?.meetings?.length },
    { key: "calls",     label: t("telemetry.tab_calls"),            icon: <PhoneCall  className="w-3.5 h-3.5" />, count: detail?.calls?.length },
    { key: "projects",  label: t("telemetry.tab_projects"),         icon: <Folder     className="w-3.5 h-3.5" />, count: detail?.projects?.length },
    { key: "team",      label: t("telemetry.tab_team"),             icon: <UserCheck  className="w-3.5 h-3.5" />, count: detail?.team_members?.length },
    { key: "ai",        label: t("telemetry.tab_ai_activities"),    icon: <Brain      className="w-3.5 h-3.5" />, count: (detail?.researches?.length || 0) + (detail?.competitors?.length || 0) },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 transition-all shadow-sm">
          <ArrowLeft className="w-4 h-4" /> {t("telemetry.back")}
        </button>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
          {account.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            {account.name}
            {detail?.user?.upgrade_requested && (
              <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] uppercase font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200 dark:border-amber-800/50">
                ⭐ {t("telemetry.upgrade_requested")}
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{account.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            title={t("telemetry.fix_data_title")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-all disabled:opacity-50"
          >
            <Wrench className="w-3.5 h-3.5" />
            {backfilling ? t("telemetry.fixing") : t("telemetry.fix_data")}
          </button>
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {t("telemetry.demo_since")} {account.created_at ? new Date(account.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${tab === t.key ? "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t.icon} {t.label}
            {"count" in t && t.count !== undefined && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${tab === t.key ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600" : "bg-slate-200 dark:bg-zinc-700 text-slate-500"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 text-center"><Activity className="w-8 h-8 animate-pulse mx-auto mb-3 text-indigo-400 opacity-60" /><p className="text-slate-500">{t("telemetry.loading")}</p></div>
      ) : !detail ? (
        <div className="py-20 text-center text-slate-500">{t("telemetry.load_failed")}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            
            {/* OVERVIEW */}
            {tab === "overview" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={<Users      className="w-5 h-5" />} label={t("telemetry.clients")}        value={detail.clients?.length ?? 0}       color="bg-gradient-to-br from-blue-500 to-blue-600" />
                  <StatCard icon={<TrendingUp className="w-5 h-5" />} label={t("telemetry.leads")}          value={detail.leads?.length ?? 0}         color="bg-gradient-to-br from-violet-500 to-purple-600" />
                  <StatCard icon={<UserPlus   className="w-5 h-5" />} label={t("telemetry.contacts")}       value={detail.contacts?.length ?? 0}      color="bg-gradient-to-br from-pink-500 to-rose-500" />
                  <StatCard icon={<Radar      className="w-5 h-5" />} label={t("telemetry.radar_analyses")} value={detail.radar?.length ?? 0}         color="bg-gradient-to-br from-cyan-500 to-teal-600" />
                  <StatCard icon={<Mail       className="w-5 h-5" />} label={t("telemetry.emails_sent")}    value={detail.emails?.length ?? 0}        color="bg-gradient-to-br from-orange-500 to-amber-500" />
                  <StatCard icon={<Calendar   className="w-5 h-5" />} label={t("telemetry.meetings")}       value={detail.meetings?.length ?? 0}      color="bg-gradient-to-br from-emerald-500 to-green-600" />
                  <StatCard icon={<PhoneCall  className="w-5 h-5" />} label={t("telemetry.calls")}          value={detail.calls?.length ?? 0}         color="bg-gradient-to-br from-green-500 to-teal-500" />
                  <StatCard icon={<Folder     className="w-5 h-5" />} label={t("telemetry.projects")}       value={detail.projects?.length ?? 0}      color="bg-gradient-to-br from-indigo-500 to-blue-600" />
                  <StatCard icon={<UserCheck  className="w-5 h-5" />} label={t("telemetry.team_members")}   value={detail.team_members?.length ?? 0}  color="bg-gradient-to-br from-fuchsia-500 to-pink-600" />
                  <StatCard icon={<Brain      className="w-5 h-5" />} label={t("telemetry.ai_researches")}  value={detail.researches?.length ?? 0}    color="bg-gradient-to-br from-purple-500 to-indigo-600" />
                  <StatCard icon={<Target     className="w-5 h-5" />} label={t("telemetry.competitor_scans")} value={detail.competitors?.length ?? 0} color="bg-gradient-to-br from-rose-500 to-red-600" />
                </div>

                {detail.limits && (
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> {t("telemetry.demo_usage_limits")}</h4>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <UsageBar label={t("telemetry.clients")}          usage={detail.limits.clients.usage}  limit={detail.limits.clients.limit}  color="bg-blue-500" />
                      <UsageBar label={t("telemetry.email_agent")}      usage={detail.limits.emails.usage}   limit={detail.limits.emails.limit}   color="bg-orange-500" />
                      <UsageBar label={t("telemetry.radar_searches")}   usage={detail.limits.searches.usage} limit={detail.limits.searches.limit} color="bg-cyan-500" />
                      {detail.limits.calls && <UsageBar label={t("telemetry.calls")} usage={detail.limits.calls.usage} limit={detail.limits.calls.limit} color="bg-green-500" />}
                    </div>
                  </div>
                )}

                {/* Activity feed */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                  <h4 className="font-bold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> {t("telemetry.recent_activity")}</h4>
                  {(() => {
                    const feed = [
                      ...detail.clients.slice(0, 4).map(c  => ({ color: "bg-blue-500",   text: `${t("telemetry.activity_client")} "${c.company}"`,          time: c.created_at })),
                      ...detail.leads.slice(0, 4).map(l    => ({ color: "bg-violet-500", text: `${t("telemetry.activity_lead")} "${l.name}"`,              time: l.created_at })),
                      ...detail.radar.slice(0, 4).map(r    => ({ color: "bg-cyan-500",   text: `${t("telemetry.activity_radar")} "${r.target_name}"`,       time: r.run_date })),
                      ...detail.emails.slice(0, 4).map(e   => ({ color: "bg-orange-500", text: `${t("telemetry.activity_email")} "${e.to}"`,              time: e.sent_at })),
                    ].filter(x => x.time).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);
                    if (feed.length === 0) return <p className="text-center text-slate-400 text-sm py-6">{t("telemetry.no_activity")}</p>;
                    return (
                      <div className="space-y-0 divide-y divide-slate-50 dark:divide-zinc-800/50">
                        {feed.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 py-2.5">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                            <span className="text-sm text-slate-700 dark:text-zinc-300 flex-1">{item.text}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">{new Date(item.time).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* CLIENTS */}
            {tab === "clients" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-blue-50/40 dark:bg-blue-900/10 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.clients_added")}</h3>
                  <span className="ml-auto text-xs font-black bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-full">{detail.clients.length}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.company"), t("telemetry.website"), t("telemetry.status"), t("telemetry.added")]}
                  empty={t("telemetry.no_clients")}
                  rows={detail.clients.map(c => [
                    <span className="font-semibold">{c.company}</span>,
                    <span className="text-xs text-slate-400">{c.website}</span>,
                    <Badge text={c.status} color="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" />,
                    <span className="text-xs text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</span>
                  ])}
                />
              </div>
            )}

            {/* LEADS */}
            {tab === "leads" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-violet-50/40 dark:bg-violet-900/10 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-600" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.leads_added")}</h3>
                  <span className="ml-auto text-xs font-black bg-violet-100 dark:bg-violet-900/30 text-violet-600 px-2 py-0.5 rounded-full">{detail.leads.length}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.name"), t("telemetry.email"), t("telemetry.company"), t("telemetry.status"), t("telemetry.added")]}
                  empty={t("telemetry.no_leads")}
                  rows={detail.leads.map(l => [
                    <span className="font-semibold">{l.name}</span>,
                    <span className="text-xs text-slate-400">{l.email}</span>,
                    <span className="text-xs text-slate-500">{l.company}</span>,
                    <Badge text={l.status} color="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400" />,
                    <span className="text-xs text-slate-400">{l.created_at ? new Date(l.created_at).toLocaleDateString() : "—"}</span>
                  ])}
                />
              </div>
            )}

            {/* CONTACTS */}
            {tab === "contacts" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-pink-50/40 dark:bg-pink-900/10 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-pink-600" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.contacts")}</h3>
                  <span className="ml-auto text-xs font-black bg-pink-100 dark:bg-pink-900/30 text-pink-600 px-2 py-0.5 rounded-full">{detail.contacts.length}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.name"), t("telemetry.email"), t("telemetry.designation")]}
                  empty={t("telemetry.no_contacts")}
                  rows={detail.contacts.map(c => [
                    <span className="font-semibold">{c.name}</span>,
                    <span className="text-xs text-slate-400">{c.email}</span>,
                    <span className="text-xs text-slate-500">{c.designation}</span>
                  ])}
                />
              </div>
            )}

            {/* RADAR */}
            {tab === "radar" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-cyan-50/40 dark:bg-cyan-900/10 flex items-center gap-2">
                  <Radar className="w-4 h-4 text-cyan-600" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.radar_analyses")}</h3>
                  <span className="ml-auto text-xs font-black bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 px-2 py-0.5 rounded-full">{detail.radar.length}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.target_business"), t("telemetry.website"), t("telemetry.competitors_found"), t("telemetry.radius"), t("telemetry.run_date")]}
                  empty={t("telemetry.no_radar")}
                  rows={detail.radar.map(r => [
                    <span className="font-semibold">{r.target_name}</span>,
                    <span className="text-xs text-slate-400">{r.target_website}</span>,
                    <Badge text={String(r.competitor_count)} color="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400" />,
                    <span className="text-xs text-slate-500">{r.radius_km} km</span>,
                    <span className="text-xs text-slate-400">{r.run_date ? new Date(r.run_date).toLocaleString() : "—"}</span>
                  ])}
                />
              </div>
            )}

            {/* EMAILS */}
            {tab === "emails" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-orange-50/40 dark:bg-orange-900/10 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-orange-500" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.email_agent")}</h3>
                  <span className="ml-auto text-xs font-black bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-2 py-0.5 rounded-full">{detail.emails.length}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.sent_to"), t("telemetry.subject"), t("telemetry.status"), t("telemetry.sent_at")]}
                  empty={t("telemetry.no_emails")}
                  rows={detail.emails.map(e => [
                    <span className="text-xs text-slate-500">{e.to}</span>,
                    <span className="font-semibold max-w-xs truncate block">{e.subject}</span>,
                    <Badge text={e.status} color="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" />,
                    <span className="text-xs text-slate-400">{e.sent_at ? new Date(e.sent_at).toLocaleString() : "—"}</span>
                  ])}
                />
              </div>
            )}

            {/* MEETINGS */}
            {tab === "meetings" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-emerald-50/40 dark:bg-emerald-900/10 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.meetings")}</h3>
                  <span className="ml-auto text-xs font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-2 py-0.5 rounded-full">{detail.meetings?.length || 0}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.title"), t("telemetry.status"), t("telemetry.scheduled_at")]}
                  empty={t("telemetry.no_meetings")}
                  rows={(detail.meetings || []).map(m => [
                    <span className="font-semibold">{m.title}</span>,
                    <Badge text={m.status} color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" />,
                    <span className="text-xs text-slate-400">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "—"}</span>
                  ])}
                />
              </div>
            )}

            {/* CALLS */}
            {tab === "calls" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-green-50/40 dark:bg-green-900/10 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-green-600" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.calls_pitches")}</h3>
                  <span className="ml-auto text-xs font-black bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full">{detail.calls?.length || 0}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.phone"), t("telemetry.duration"), t("telemetry.summary"), t("telemetry.logged_at")]}
                  empty={t("telemetry.no_calls")}
                  rows={(detail.calls || []).map(c => [
                    <span className="font-semibold">{c.phone}</span>,
                    <span className="text-xs text-slate-500">{c.duration}s</span>,
                    <span className="text-xs text-slate-600 truncate max-w-[200px] block">{c.summary}</span>,
                    <span className="text-xs text-slate-400">{c.received_at ? new Date(c.received_at).toLocaleString() : "—"}</span>
                  ])}
                />
              </div>
            )}

            {/* PROJECTS */}
            {tab === "projects" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-blue-50/40 dark:bg-blue-900/10 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-600" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.projects")}</h3>
                  <span className="ml-auto text-xs font-black bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-full">{detail.projects?.length || 0}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.project_name"), t("telemetry.status"), t("telemetry.progress")]}
                  empty={t("telemetry.no_projects")}
                  rows={(detail.projects || []).map(p => [
                    <span className="font-semibold">{p.name}</span>,
                    <Badge text={p.status} color="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" />,
                    <span className="text-xs text-slate-500">{p.progress}%</span>
                  ])}
                />
              </div>
            )}

            {/* TEAM MEMBERS */}
            {tab === "team" && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-fuchsia-50/40 dark:bg-fuchsia-900/10 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-fuchsia-600" /><h3 className="font-bold text-slate-800 dark:text-zinc-100">{t("telemetry.team_members")}</h3>
                  <span className="ml-auto text-xs font-black bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 px-2 py-0.5 rounded-full">{detail.team_members?.length || 0}</span>
                </div>
                <DataTable
                  headers={[t("telemetry.name"), t("telemetry.email"), t("telemetry.role")]}
                  empty={t("telemetry.no_team")}
                  rows={(detail.team_members || []).map(u => [
                    <span className="font-semibold">{u.name}</span>,
                    <span className="text-xs text-slate-400">{u.email}</span>,
                    <Badge text={u.role} color="bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400" />
                  ])}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

// ─── Account Grid ─────────────────────────────────────────────────────────────
function AccountGrid({ onSelect }: { onSelect: (a: DemoAccount) => void }) {
  const { user } = useRole();
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/demo-accounts`, {
        headers: { "X-Tenant-ID": "" }
      });
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">{t("telemetry.total_demo_accounts")}</p>
            <p className="text-2xl font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : accounts.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">{t("telemetry.active_this_week")}</p>
            <p className="text-2xl font-black text-slate-800 dark:text-zinc-100">
              {loading ? "—" : accounts.filter(a => {
                const d = new Date(a.created_at);
                return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
              }).length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">{t("telemetry.click_to_view")}</p>
            <p className="text-sm font-semibold text-blue-500">{t("telemetry.clients_leads_radar")}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("telemetry.search_name_email")}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-zinc-100" />
        </div>
        <button onClick={load} className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-slate-500">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="py-20 text-center"><Activity className="w-8 h-8 animate-pulse mx-auto mb-3 text-indigo-400 opacity-60" /><p className="text-slate-500">{t("telemetry.loading_accounts")}</p></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">{t("telemetry.no_demo_accounts")}</p>
          <p className="text-sm mt-1">{t("telemetry.no_demo_accounts_desc")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <motion.button key={a.id} onClick={() => onSelect(a)}
              whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="w-full text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-zinc-100 truncate">{a.name}</p>
                  <p className="text-xs text-slate-500 truncate">{a.email}</p>
                </div>
                <Eye className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {a.created_at ? new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">Demo</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DemoAccountsDashboard() {
  const { user } = useRole();
  const { t } = useLanguage();
  const [selected, setSelected] = useState<DemoAccount | null>(null);

  if (user?.role === "Demo") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 mb-2">{t("telemetry.access_restricted")}</h2>
          <p className="text-slate-500 text-sm">{t("telemetry.access_restricted_desc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{t("telemetry.demo_accounts")}</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{t("telemetry.subtitle")}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DemoDetail account={selected} onBack={() => setSelected(null)} />
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AccountGrid onSelect={setSelected} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
