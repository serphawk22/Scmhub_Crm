"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, X, Clock, Users, MapPin, CheckCircle2, Filter, Search, Loader2, Video, Phone, Coffee, BarChart2, Trash2, Edit2, Upload, FileText } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

interface Meeting {
  id: number; title: string; description?: string; location?: string;
  meeting_type: string; status: string;
  scheduled_at?: string; duration_minutes?: number;
  host_name?: string; lead_name?: string; client_name?: string;
  attendees?: string[]; notes?: string; outcome?: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, any> = {
  Meeting: Users, Demo: Video, "Follow-up": Phone, Discovery: Coffee, default: Calendar,
};
const STATUS_COLORS: Record<string, string> = {
  Scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  "No-show": "bg-amber-500/10 text-amber-500 border-amber-500/20",
};
const TYPES = ["Meeting", "Demo", "Follow-up", "Discovery", "Call"];
const STATUSES = ["Scheduled", "Completed", "Cancelled", "No-show"];

export default function MeetingsPage() {
  const { t } = useLanguage();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", location: "", meeting_type: "Meeting",
    status: "Scheduled", scheduled_at: "", duration_minutes: "",
    attendees: "", notes: "",
  });

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/meetings`)
      .then(r => r.json())
      .then(d => setMeetings(Array.isArray(d.meetings) ? d.meetings : []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    return meetings.filter(m => {
      const q = search.toLowerCase();
      const matchSearch = !q || m.title.toLowerCase().includes(q) ||
        (m.client_name || "").toLowerCase().includes(q) ||
        (m.lead_name || "").toLowerCase().includes(q) ||
        (m.location || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" || m.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [meetings, search, statusFilter]);

  const openCreate = () => {
    setEditMeeting(null);
    setForm({ title: "", description: "", location: "", meeting_type: "Meeting", status: "Scheduled", scheduled_at: "", duration_minutes: "", attendees: "", notes: "" });
    setShowModal(true);
  };
  const openEdit = (m: Meeting) => {
    setEditMeeting(m);
    setForm({
      title: m.title, description: m.description || "", location: m.location || "",
      meeting_type: m.meeting_type, status: m.status,
      scheduled_at: m.scheduled_at ? m.scheduled_at.slice(0, 16) : "",
      duration_minutes: m.duration_minutes?.toString() || "",
      attendees: (m.attendees || []).join(", "), notes: m.notes || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      attendees: form.attendees ? form.attendees.split(",").map(s => s.trim()).filter(Boolean) : [],
    };
    const url = editMeeting ? `${API_BASE_URL}/meetings/${editMeeting.id}` : `${API_BASE_URL}/meetings`;
    const method = editMeeting ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    setShowModal(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("meetings.confirm_delete"))) return;
    await fetch(`${API_BASE_URL}/meetings/${id}`, { method: "DELETE" });
    load();
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", importFile);
    await fetch(`${API_BASE_URL}/meetings/import`, { method: "POST", body: fd });
    setImporting(false);
    setShowImport(false);
    setImportFile(null);
    load();
  };

  const stats = [
    { label: t("meetings.total"), value: meetings.length, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: t("meetings.scheduled"), value: meetings.filter(m => m.status === "Scheduled").length, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: t("meetings.completed"), value: meetings.filter(m => m.status === "Completed").length, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: t("meetings.this_week"), value: meetings.filter(m => {
      if (!m.scheduled_at) return false;
      const d = new Date(m.scheduled_at), now = new Date();
      const diff = (d.getTime() - now.getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    }).length, color: "text-violet-500", bg: "bg-violet-500/10" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{t("meetings.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">{t("meetings.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
            <Upload className="w-4 h-4" /> {t("meetings.import")}
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold hover:opacity-90 transition-all shadow-md">
            <Plus className="w-4 h-4" /> {t("meetings.schedule_meeting")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
              <Calendar className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : s.value}</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("meetings.search_placeholder")}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          {["All", ...STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 flex justify-center py-20"><Loader2 className="animate-spin text-violet-500 w-8 h-8" /></div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-violet-500 opacity-60" />
            </div>
            <p className="text-base font-bold text-slate-700 dark:text-zinc-200">{t("meetings.no_meetings")}</p>
            <p className="text-sm text-slate-400 mt-1">{t("meetings.click_schedule")}</p>
          </div>
        ) : filtered.map((m, i) => {
          const Icon = TYPE_ICONS[m.meeting_type] || TYPE_ICONS.default;
          const statusCls = STATUS_COLORS[m.status] || "bg-slate-100 text-slate-500";
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-zinc-100 line-clamp-1">{m.title}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{m.meeting_type}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg border ${statusCls}`}>{m.status}</span>
              </div>
              {m.scheduled_at && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-600 dark:text-zinc-300">
                    {new Date(m.scheduled_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {m.duration_minutes && ` • ${m.duration_minutes} min`}
                  </span>
                </div>
              )}
              {m.location && (
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {m.location.startsWith("http") ? (
                    <a href={m.location} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate">
                      {m.location}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">{m.location}</span>
                  )}
                </div>
              )}
              {(m.client_name || m.lead_name) && (
                <div className="flex items-center gap-1.5 mb-3">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-zinc-400">{m.client_name || m.lead_name}</span>
                </div>
              )}
              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(m)} className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-1">
                  <Edit2 className="w-3 h-3" /> {t("meetings.edit")}
                </button>
                <button onClick={() => handleDelete(m.id)} className="flex-1 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-1">
                  <Trash2 className="w-3 h-3" /> {t("meetings.delete")}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-700">
                <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100">{editMeeting ? t("meetings.edit_meeting") : t("meetings.schedule_meeting")}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: t("meetings.title_label"), key: "title", placeholder: t("meetings.title_placeholder") },
                  { label: t("meetings.location_label"), key: "location", placeholder: t("meetings.location_placeholder") },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1 block">{label}</label>
                    <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("meetings.type")}</label>
                    <select value={form.meeting_type} onChange={e => setForm(f => ({ ...f, meeting_type: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("meetings.status")}</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("meetings.date_time")}</label>
                    <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("meetings.duration_min")}</label>
                    <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="60"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("meetings.attendees_label")}</label>
                  <input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder={t("meetings.attendees_placeholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("meetings.notes")}</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder={t("meetings.notes_placeholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-sm hover:bg-slate-200 transition-all">{t("meetings.cancel")}</button>
                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editMeeting ? t("meetings.update") : t("meetings.schedule")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100">{t("meetings.import_meetings")}</h2>
                <button onClick={() => setShowImport(false)}><X className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">{t("meetings.import_desc")}</p>
              <label className="block w-full border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">{importFile ? importFile.name : t("meetings.click_select")}</p>
                <p className="text-xs text-slate-400 mt-1">.csv, .xlsx, .xls</p>
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => setImportFile(e.target.files?.[0] || null)} />
              </label>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowImport(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all">{t("meetings.cancel")}</button>
                <button onClick={handleImport} disabled={!importFile || importing}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />} {t("meetings.import")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
