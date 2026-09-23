"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Download, RefreshCw, TrendingUp, Users, Target, BriefcaseBusiness, CheckCircle2, Phone, Video } from "lucide-react";
import { jsPDF } from "jspdf";
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
  calls: any[];
  meetings: any[];
  onboarding: Record<string, number>;
};

const tabs = [
  ["overview", "Overview"], ["sales", "Sales Report"], ["calls", "Calls"],
  ["meetings", "Meetings"], ["daily", "Daily Report"], ["monthly", "Monthly Report"],
  ["staff_performance", "Staff Performance"],
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

function drawPdfTable(pdf: jsPDF, headers: string[], rows: string[][], startY: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 14;
  const tableWidth = pageWidth - 28;
  const columnWidth = tableWidth / headers.length;
  const lineHeight = 4.5;
  let y = startY;

  const drawHeader = () => {
    pdf.setFillColor(30, 64, 175);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(left, y, tableWidth, 9, "F");
    headers.forEach((header, index) => pdf.text(header, left + index * columnWidth + 2, y + 6));
    pdf.setTextColor(30, 41, 59);
    y += 9;
  };

  drawHeader();
  rows.forEach((row, rowIndex) => {
    const wrappedCells = row.map(cell => pdf.splitTextToSize(cell, columnWidth - 4));
    const rowHeight = Math.max(...wrappedCells.map(lines => lines.length), 1) * lineHeight + 4;
    if (y + rowHeight > pageHeight - 18) {
      pdf.addPage();
      y = 18;
      drawHeader();
    }
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(left, y, tableWidth, rowHeight, "F");
    }
    wrappedCells.forEach((lines, index) => pdf.text(lines, left + index * columnWidth + 2, y + 5));
    pdf.setDrawColor(226, 232, 240);
    pdf.line(left, y + rowHeight, left + tableWidth, y + rowHeight);
    y += rowHeight;
  });
  return y;
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
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const response = await fetch(`${API_BASE_URL}/reports/summary?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to load reports");
      setData(payload);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load reports"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (role && startDate && endDate && startDate <= endDate) load();
  }, [role, startDate, endDate]);

  const download = () => {
    if (!data) return;
    const pdf = new jsPDF();
    const reportNames: Record<string, string> = Object.fromEntries(tabs);
    const format = (value: unknown) => value == null ? "-" : typeof value === "object" ? JSON.stringify(value) : String(value);
    let headers: string[];
    let rows: string[][];
    if (tab === "overview") {
      headers = ["Metric", "Value"];
      rows = Object.entries(data.summary).map(([key, value]) => [key.replaceAll("_", " "), format(value)]);
    } else if (tab === "sales") {
      headers = ["Deal", "Stage", "Value", "Owner"];
      rows = data.sales.deals.map(deal => [format(deal.title), format(deal.stage), format(deal.value), format(deal.assigned_to)]);
    } else if (tab === "calls") {
      headers = ["Date", "Phone", "Agent", "Duration", "Follow-up", "Notes"];
      rows = data.calls.map(call => [fmtDate(call.date), format(call.phone_number), format(call.assigned_to), fmtMinutes(call.duration_seconds), call.followup_needed ? format(call.followup_date || "Yes") : "No", format(call.summary)]);
    } else if (tab === "meetings") {
      headers = ["When", "Title", "Type", "Status", "Host", "Duration", "Location", "Outcome"];
      rows = data.meetings.map(meeting => [fmtDate(meeting.scheduled_at), format(meeting.title), format(meeting.meeting_type), format(meeting.status), format(meeting.host), meeting.duration_minutes ? `${meeting.duration_minutes}m` : "-", format(meeting.location), format(meeting.outcome)]);
    } else if (tab === "daily") {
      headers = ["Date", "Leads", "Onboarded", "Deals won", "Emails", "Activities", "Calls", "Meetings", "Tasks", "Tickets", "Cases"];
      rows = data.daily.map(item => [format(item.date), format(item.leads), format(item.clients_onboarded), format(item.deals_won), format(item.emails), format(item.activities), format(item.calls), format(item.meetings), format(item.task_entries), format(item.tickets), format(item.cases_resolved)]);
    } else if (tab === "monthly") {
      headers = ["Month", "Leads", "Onboarded", "Deals won", "Emails", "Calls", "Meetings"];
      rows = data.monthly.map(item => [format(item.month), format(item.leads), format(item.clients_onboarded), format(item.deals_won), format(item.emails), format(item.calls), format(item.meetings)]);
    } else if (tab === "staff_performance") {
      headers = ["Staff member", "Role", "Total work", "Calls", "Meetings", "Completed", "Tickets", "Cases"];
      rows = data.staff_performance.map(item => [format(item.name), format(item.role), format(item.total_work), format(item.calls), format(item.meetings), format(item.completed_tasks), format(item.tickets), format(item.cases)]);
    } else if (tab === "lead_sources") {
      headers = ["Lead source", "Leads", "Converted", "Conversion %"];
      rows = data.lead_sources.map(item => [format(item.source), format(item.leads), format(item.converted), `${format(item.conversion_percentage)}%`]);
    } else {
      headers = ["Metric", "Count"];
      rows = Object.entries(data.onboarding).map(([key, value]) => [key.replaceAll("_", " "), format(value)]);
    }
    pdf.setProperties({ title: `${reportNames[tab]} report` });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42);
    pdf.text(reportNames[tab] || "Report", 14, 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Reporting period: ${startDate} to ${endDate}`, 14, 26);
    drawPdfTable(pdf, headers, rows, 36);
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Page ${page} of ${pageCount}`, 14, pdf.internal.pageSize.getHeight() - 8);
    }
    pdf.save(`${tab}-report-${startDate}-to-${endDate}.pdf`);
  };

  const downloadFullReport = () => {
    if (!data) return;
    const pdf = new jsPDF();
    const format = (value: unknown) => value == null ? "-" : typeof value === "object" ? JSON.stringify(value) : String(value);
    const sections: Array<{ title: string; headers: string[]; rows: string[][] }> = [
      { title: "Overview", headers: ["Metric", "Value"], rows: Object.entries(data.summary).map(([key, value]) => [key.replaceAll("_", " "), format(value)]) },
      { title: "Sales Report", headers: ["Deal", "Stage", "Value", "Owner"], rows: data.sales.deals.map(deal => [format(deal.title), format(deal.stage), format(deal.value), format(deal.assigned_to)]) },
      { title: "Calls", headers: ["Date", "Phone", "Agent", "Duration", "Follow-up", "Notes"], rows: data.calls.map(call => [fmtDate(call.date), format(call.phone_number), format(call.assigned_to), fmtMinutes(call.duration_seconds), call.followup_needed ? format(call.followup_date || "Yes") : "No", format(call.summary)]) },
      { title: "Meetings", headers: ["When", "Title", "Type", "Status", "Host", "Duration", "Location", "Outcome"], rows: data.meetings.map(meeting => [fmtDate(meeting.scheduled_at), format(meeting.title), format(meeting.meeting_type), format(meeting.status), format(meeting.host), meeting.duration_minutes ? `${meeting.duration_minutes}m` : "-", format(meeting.location), format(meeting.outcome)]) },
      { title: "Daily Report", headers: ["Date", "Leads", "Onboarded", "Deals won", "Emails", "Activities", "Calls", "Meetings", "Tasks", "Tickets", "Cases"], rows: data.daily.map(item => [format(item.date), format(item.leads), format(item.clients_onboarded), format(item.deals_won), format(item.emails), format(item.activities), format(item.calls), format(item.meetings), format(item.task_entries), format(item.tickets), format(item.cases_resolved)]) },
      { title: "Monthly Report", headers: ["Month", "Leads", "Onboarded", "Deals won", "Emails", "Calls", "Meetings"], rows: data.monthly.map(item => [format(item.month), format(item.leads), format(item.clients_onboarded), format(item.deals_won), format(item.emails), format(item.calls), format(item.meetings)]) },
      { title: "Staff Performance", headers: ["Staff", "Role", "Total work", "Calls", "Meetings", "Completed", "Tickets", "Cases"], rows: data.staff_performance.map(item => [format(item.name), format(item.role), format(item.total_work), format(item.calls), format(item.meetings), format(item.completed_tasks), format(item.tickets), format(item.cases)]) },
      { title: "Lead Sources", headers: ["Source", "Leads", "Converted", "Conversion %"], rows: data.lead_sources.map(item => [format(item.source), format(item.leads), format(item.converted), `${format(item.conversion_percentage)}%`]) },
      { title: "Client Onboarding", headers: ["Metric", "Count"], rows: Object.entries(data.onboarding).map(([key, value]) => [key.replaceAll("_", " "), format(value)]) },
    ];
    sections.forEach((section, index) => {
      if (index > 0) pdf.addPage();
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(18); pdf.setTextColor(15, 23, 42);
      pdf.text(section.title, 14, 18);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(71, 85, 105);
      pdf.text(`Reporting period: ${startDate} to ${endDate}`, 14, 26);
      drawPdfTable(pdf, section.headers, section.rows, 36);
    });
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139);
      pdf.text(`Page ${page} of ${pageCount}`, 14, pdf.internal.pageSize.getHeight() - 8);
    }
    pdf.setProperties({ title: "Complete sales report" });
    pdf.save(`complete-sales-report-${startDate}-to-${endDate}.pdf`);
  };

  const summary = data?.summary || {};
  const staffRows = useMemo(() => (data?.staff_performance || []).map(item => [item.name, item.role, item.total_work, item.calls, item.meetings, item.completed_tasks, item.tickets, item.cases]), [data]);
  const fmtMinutes = (seconds: number | null | undefined) => seconds == null ? "–" : ((seconds / 60) < 1 ? `${seconds}s` : `${Math.round(seconds / 60)}m`);
  const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString() + " " + new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "–";
  if (role !== "Admin" && role !== "SuperAdmin") return <div className="p-10 text-center font-bold text-slate-500">Reports are available to administrators only.</div>;
  return <div className="mx-auto max-w-[1500px] space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Decision center</p><h1 className="text-3xl font-black text-slate-900 dark:text-white">Reports</h1><p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">One consistent view of sales, delivery, staff output, sources, and onboarding.</p></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-900"><CalendarDays size={16} className="text-indigo-500" /><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><span className="text-slate-400">to</span><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-900" /><button onClick={load} className="rounded-xl bg-indigo-600 p-2.5 text-white" title="Refresh"><RefreshCw size={17} /></button><button onClick={download} disabled={!data} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Download size={16} /> Download PDF</button><button onClick={downloadFullReport} disabled={!data} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Download size={16} /> Full Sales Report</button></div></div>
    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-zinc-900">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition-colors ${tab === key ? "bg-white text-indigo-600 shadow-sm dark:bg-zinc-800" : "text-slate-500"}`}>{label}</button>)}</div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
    {loading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900" />)}</div> : data && <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8"><Stat label="Leads" value={summary.leads} icon={<TrendingUp size={18} />} tone="bg-indigo-600" /><Stat label="Clients onboarded" value={summary.clients_onboarded} icon={<Users size={18} />} tone="bg-emerald-600" /><Stat label="Total clients" value={summary.total_clients} icon={<Users size={18} />} tone="bg-sky-600" /><Stat label="Won revenue" value={summary.won_value} icon={<BriefcaseBusiness size={18} />} tone="bg-amber-600" /><Stat label="Deals won" value={summary.deals_won} icon={<CheckCircle2 size={18} />} tone="bg-teal-600" /><Stat label="Conversion" value={`${summary.conversion_percentage}%`} icon={<Target size={18} />} tone="bg-rose-600" /><Stat label="Win rate" value={`${summary.deal_win_rate}%`} icon={<BarChart3 size={18} />} tone="bg-violet-600" /><Stat label="Calls" value={summary.calls} icon={<Phone size={18} />} tone="bg-cyan-600" /><Stat label="Meetings" value={summary.meetings} icon={<CalendarDays size={18} />} tone="bg-fuchsia-600" /><Stat label="Work items" value={(summary.activities || 0) + (summary.tickets || 0) + (summary.task_entries || 0)} icon={<BarChart3 size={18} />} tone="bg-slate-700" /></div>
      {tab === "overview" && <div className="grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="mb-4 text-lg font-black dark:text-white">Report coverage</h2><p className="text-sm leading-6 text-slate-500">The selected range is <strong>{data.range.start_date}</strong> through <strong>{data.range.end_date}</strong>. Conversion is calculated from all tenant leads marked converted; activity KPIs use records created inside the selected range.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="mb-4 text-lg font-black dark:text-white">Client onboarding</h2><div className="grid grid-cols-2 gap-3 text-sm"><p>Active <strong>{data.onboarding.active}</strong></p><p>Pending <strong>{data.onboarding.pending}</strong></p><p>Hold <strong>{data.onboarding.hold}</strong></p><p>New in range <strong>{data.onboarding.new_in_range}</strong></p></div></div></div>}
      {tab === "sales" && <Table headers={["Deal", "Stage", "Value", "Owner"]} rows={data.sales.deals.map(deal => [deal.title, deal.stage, deal.value, deal.assigned_to])} />}
      {tab === "calls" && <Table headers={["Date", "Phone", "Agent", "Duration", "Follow-up", "Notes"]} rows={data.calls.map((call: any) => [fmtDate(call.date), call.phone_number, call.assigned_to, fmtMinutes(call.duration_seconds), call.followup_needed ? (call.followup_date || "Yes") : "No", call.summary || "–"])} />}
      {tab === "meetings" && <Table headers={["When", "Title", "Type", "Status", "Host", "Duration", "Location", "Outcome"]} rows={data.meetings.map((meeting: any) => [fmtDate(meeting.scheduled_at), meeting.title, meeting.meeting_type, meeting.status, meeting.host, meeting.duration_minutes ? `${meeting.duration_minutes}m` : "–", meeting.location || "–", meeting.outcome || "–"])} />}
      {tab === "daily" && <Table headers={["Date", "Leads", "Onboarded", "Deals won", "Emails", "Activities", "Calls", "Meetings", "Tasks", "Tickets", "Cases resolved"]} rows={data.daily.map(item => [item.date, item.leads, item.clients_onboarded, item.deals_won, item.emails, item.activities, item.calls, item.meetings, item.task_entries, item.tickets, item.cases_resolved])} />}
      {tab === "monthly" && <Table headers={["Month", "Leads", "Clients onboarded", "Deals won", "Emails", "Calls", "Meetings"]} rows={data.monthly.map(item => [item.month, item.leads, item.clients_onboarded, item.deals_won, item.emails, item.calls, item.meetings])} />}
      {tab === "staff_performance" && <Table headers={["Staff member", "Role", "Total work", "Calls", "Meetings", "Completed tasks", "Tickets", "Cases"]} rows={staffRows} />}
      {tab === "lead_sources" && <Table headers={["Lead source", "Leads", "Converted", "Conversion %"]} rows={data.lead_sources.map(item => [item.source, item.leads, item.converted, `${item.conversion_percentage}%`])} />}
      {tab === "onboarding" && <Table headers={["Metric", "Count"]} rows={Object.entries(data.onboarding).map(([key, value]) => [key.replaceAll("_", " "), value])} />}
    </>}
  </div>;
}
