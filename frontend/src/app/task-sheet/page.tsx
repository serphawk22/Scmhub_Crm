"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Download, Edit3, Plus, Save, X } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";

interface Entry {
  id: number;
  user_id: number;
  user_name: string;
  work_date: string;
  area: string;
  project_id?: number;
  project_name?: string;
  ticket_id?: number;
  ticket_name?: string;
  summary: string;
  status: string;
  updated_at: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function TaskSheetPage() {
  const { role, user } = useRole();
  const isAdmin = role === "Admin" || role === "SuperAdmin";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [date, setDate] = useState(today());
  const [editing, setEditing] = useState<Entry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ area: "Development", project_id: "", summary: "", status: "Done" });
  const [message, setMessage] = useState("");

  const load = async () => {
    const params = new URLSearchParams({ work_date: date });
    if (!isAdmin && user?.id) params.set("user_id", String(user.id));
    const [entriesRes, projectsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/task-sheet?${params}`),
      fetch(`${API_BASE_URL}/projects${!isAdmin && user?.id ? `?member_id=${user.id}` : ""}`),
    ]);
    const entriesData = await entriesRes.json();
    const projectsData = await projectsRes.json();
    setEntries(entriesData.entries || []);
    setProjects(projectsData.projects || []);
  };

  useEffect(() => { if (user?.id) load(); }, [user?.id, date, isAdmin]);

  const openNew = () => {
    setEditing(null);
    setForm({ area: role === "SalesManager" ? "Sales" : "Development", project_id: "", summary: "", status: "Done" });
    setShowForm(true);
  };

  const openEdit = (entry: Entry) => {
    setEditing(entry);
    setForm({ area: entry.area, project_id: String(entry.project_id || ""), summary: entry.summary, status: entry.status });
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.summary.trim() || !user?.id) return;
    const payload = {
      user_id: editing?.user_id || user.id,
      work_date: editing?.work_date || today(),
      area: form.area,
      project_id: form.project_id ? Number(form.project_id) : null,
      summary: form.summary.trim(),
      status: form.status,
    };
    const response = await fetch(`${API_BASE_URL}/task-sheet${editing ? `/${editing.id}` : ""}`, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.detail || "Unable to save task-sheet entry");
      return;
    }
    setShowForm(false);
    setMessage("");
    load();
  };

  const download = () => {
    const columns = ["Date", "Person", "Area", "Project", "Status", "Work done", "Updated"];
    const rows = entries.map((entry) => [entry.work_date, entry.user_name, entry.area, entry.project_name || "", entry.status, entry.summary, entry.updated_at]);
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `task-sheet-${date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Daily operations</p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Task Sheet</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Record what was completed and keep a traceable delivery history.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-bold">
            <CalendarDays size={16} className="text-indigo-500" />
            <input type="date" value={date} onChange={event => setDate(event.target.value)} className="bg-transparent outline-none" />
          </label>
          {isAdmin && <button onClick={download} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"><Download size={16} /> Export CSV</button>}
          {!isAdmin && <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Add entry</button>}
        </div>
      </div>

      {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{message}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-[1.1fr_1fr_1.2fr_2fr_0.8fr_80px] gap-4 border-b border-slate-100 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-zinc-800">
          <span>Date</span><span>Person</span><span>Area / project</span><span>Work completed</span><span>Status</span><span />
        </div>
        {entries.length === 0 ? <div className="px-5 py-16 text-center text-sm font-semibold text-slate-400">No task-sheet entries for this date.</div> : entries.map(entry => (
          <div key={entry.id} className="grid grid-cols-[1.1fr_1fr_1.2fr_2fr_0.8fr_80px] gap-4 border-b border-slate-100 px-5 py-4 text-sm last:border-0 dark:border-zinc-800">
            <span className="font-bold text-slate-700 dark:text-zinc-200">{entry.work_date}</span>
            <span className="text-slate-600 dark:text-zinc-300">{entry.user_name}</span>
            <span><strong className="block text-slate-800 dark:text-white">{entry.area}</strong><small className="text-slate-400">{entry.project_name || "General work"}</small></span>
            <span className="text-slate-600 dark:text-zinc-300">{entry.summary}</span>
            <span className="font-bold text-emerald-600">{entry.status}</span>
            <button onClick={() => openEdit(entry)} className="flex items-center gap-1 text-xs font-bold text-indigo-600"><Edit3 size={14} /> Edit</button>
          </div>
        ))}
      </div>

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={save} className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between"><h2 className="text-xl font-black dark:text-white">{editing ? "Edit entry" : "Add today's work"}</h2><button type="button" onClick={() => setShowForm(false)}><X /></button></div>
        <div className="grid grid-cols-2 gap-4"><label className="text-xs font-bold text-slate-500">Area<select value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} className="mt-1 w-full rounded-xl border p-3 text-sm"><option>Development</option><option>Sales</option><option>QA</option><option>Support</option><option>General</option></select></label><label className="text-xs font-bold text-slate-500">Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-xl border p-3 text-sm"><option>Done</option><option>In progress</option><option>Blocked</option></select></label></div>
        <label className="block text-xs font-bold text-slate-500">Project<select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="mt-1 w-full rounded-xl border p-3 text-sm"><option value="">General work</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="block text-xs font-bold text-slate-500">What did you do?<textarea required rows={5} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} className="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="Describe the work, result, or blocker..." /></label>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white"><Save size={16} /> {editing ? "Save changes" : "Save today's entry"}</button>
      </form></div>}
    </div>
  );
}
