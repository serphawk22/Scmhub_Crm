"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Download, RefreshCw, TrendingUp, Users, Target, BriefcaseBusiness, CheckCircle2 } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";

type ReportData = {
  range: { start_date: string; end_date: string };
  summary: Record<string, number>;
  sales: { deals: any[]; won_value: number };
  daily: any[];
  monthly: any[];
  staff_performance: any[];
  lead_sources: any[];
  onboarding: Record<string, number>;
};

const tabs = [
  ["overview", "Overview"], ["sales", "Sales Report"], ["daily", "Daily Report"],
  ["monthly", "Monthly Report"], ["staff_performance", "Staff Performance"],
  ["lead_sources", "Lead Sources"], ["onboarding", "Client Onboarding"],
] as const;
const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

function Stat({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white ${tone}`}>{icon}</div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p></div>;
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-zinc-950"><tr>{headers.map(header => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-zinc-800">{rows.length ? rows.map((row, index) => <tr key={index} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-zinc-300">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-sm text-slate-400">No records in this date range.</td></tr>}</tbody></table></div>;
}

export default function ReportsPage() {
  const { role } = useRole();
  const [tab, setTab] = useState<string>("overview");
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/reports/summary?start_date=${startDate}&end_date=${endDate}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to load reports");
      setData(payload);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load reports"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (role) load(); }, [role]);

  const download = () => {
    if (!data) return;
    const rows = tab === "overview" ? Object.entries(data.summary).map(([metric, value]) => [metric, value]) : ((data as any)[tab] instanceof Array ? (data as any)[tab] : Object.entries((data as any)[tab] || {}).map(([key, value]) => [key, value]));
    const csv = rows.map((row: any) => (Array.isArray(row) ? row : Object.values(row)).map((value: any) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${tab}-report-${startDate}-to-${endDate}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const summary = data?.summary || {};
  const staffRows = useMemo(() => (data?.staff_performance || []).map(item => [item.name, item.role, item.total_work, item.completed_tasks, item.tickets, item.cases]), [data]);
  if (role !== "Admin" && role !== "SuperAdmin" && role !== "SalesManager") return <div className="p-10 text-center font-bold text-slate-500">Reports are available to Admin and Sales Manager roles.</div>;

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Decision center</p><h1 className="text-3xl font-black text-slate-900 dark:text-white">Reports</h1><p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">One consistent view of sales, delivery, staff output, sources, and onboarding.</p></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-900"><CalendarDays size={16} className="text-indigo-500" /><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><span className="text-slate-400">to</span><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-900" /><button onClick={load} className="rounded-xl bg-indigo-600 p-2.5 text-white" title="Refresh"><RefreshCw size={17} /></button><button onClick={download} disabled={!data} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Download size={16} /> Export CSV</button></div></div>
    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-zinc-900">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition-colors ${tab === key ? "bg-white text-indigo-600 shadow-sm dark:bg-zinc-800" : "text-slate-500"}`}>{label}</button>)}</div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
    {loading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900" />)}</div> : data && <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8"><Stat label="Leads" value={summary.leads} icon={<TrendingUp size={18} />} tone="bg-indigo-600" /><Stat label="Clients onboarded" value={summary.clients_onboarded} icon={<Users size={18} />} tone="bg-emerald-600" /><Stat label="Total clients" value={summary.total_clients} icon={<Users size={18} />} tone="bg-sky-600" /><Stat label="Won revenue" value={summary.won_value} icon={<BriefcaseBusiness size={18} />} tone="bg-amber-600" /><Stat label="Deals won" value={summary.deals_won} icon={<CheckCircle2 size={18} />} tone="bg-teal-600" /><Stat label="Conversion" value={`${summary.conversion_percentage}%`} icon={<Target size={18} />} tone="bg-rose-600" /><Stat label="Win rate" value={`${summary.deal_win_rate}%`} icon={<BarChart3 size={18} />} tone="bg-violet-600" /><Stat label="Work items" value={(summary.activities || 0) + (summary.tickets || 0) + (summary.task_entries || 0)} icon={<BarChart3 size={18} />} tone="bg-slate-700" /></div>
      {tab === "overview" && <div className="grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="mb-4 text-lg font-black dark:text-white">Report coverage</h2><p className="text-sm leading-6 text-slate-500">The selected range is <strong>{data.range.start_date}</strong> through <strong>{data.range.end_date}</strong>. Conversion is calculated from all tenant leads marked converted; activity KPIs use records created inside the selected range.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="mb-4 text-lg font-black dark:text-white">Client onboarding</h2><div className="grid grid-cols-2 gap-3 text-sm"><p>Active <strong>{data.onboarding.active}</strong></p><p>Pending <strong>{data.onboarding.pending}</strong></p><p>Hold <strong>{data.onboarding.hold}</strong></p><p>New in range <strong>{data.onboarding.new_in_range}</strong></p></div></div></div>}
      {tab === "sales" && <Table headers={["Deal", "Stage", "Value", "Owner"]} rows={data.sales.deals.map(deal => [deal.title, deal.stage, deal.value, deal.assigned_to])} />}
      {tab === "daily" && <Table headers={["Date", "Leads", "Onboarded", "Deals won", "Emails", "Activities", "Tasks", "Tickets", "Cases resolved"]} rows={data.daily.map(item => [item.date, item.leads, item.clients_onboarded, item.deals_won, item.emails, item.activities, item.task_entries, item.tickets, item.cases_resolved])} />}
      {tab === "monthly" && <Table headers={["Month", "Leads", "Clients onboarded", "Deals won", "Emails"]} rows={data.monthly.map(item => [item.month, item.leads, item.clients_onboarded, item.deals_won, item.emails])} />}
      {tab === "staff_performance" && <Table headers={["Staff member", "Role", "Total work", "Completed tasks", "Tickets", "Cases"]} rows={staffRows} />}
      {tab === "lead_sources" && <Table headers={["Lead source", "Leads", "Converted", "Conversion %"]} rows={data.lead_sources.map(item => [item.source, item.leads, item.converted, `${item.conversion_percentage}%`])} />}
      {tab === "onboarding" && <Table headers={["Metric", "Count"]} rows={Object.entries(data.onboarding).map(([key, value]) => [key.replaceAll("_", " "), value])} />}
    </>}
  </div>;
}
