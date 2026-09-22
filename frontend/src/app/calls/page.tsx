"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Plus, X, Clock, Loader2, Check, PhoneCall, PhoneOff, Zap,
  CalendarClock, ChevronDown, ChevronUp, Trash2, Calendar, User,
  Mail, Mic, CheckCircle, Bell, Bot, AlertCircle,
  Volume2, ExternalLink
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120 } },
};

interface CallEntry {
  id: number;
  phone_number: string;
  received_at: string;
  duration_seconds: number | null;
  summary: string | null;
  description: string | null;
  work_done: string | null;
  assigned_to: string | null;
  followup_needed: boolean;
  followup_date: string | null;
  client_id: number | null;
  entity_name?: string | null;
}

interface ScheduledCall {
  id: number;
  title: string;
  scheduled_at: string | null;
  entity_type: string;
  entity_id: number | null;
  entity_name: string | null;
  entity_email: string | null;
  pitch: string | null;
  notes: string | null;
  assigned_to: string | null;
  status: string;
  created_at: string;
  ai_call_status: string | null;
  ai_call_initiated_at: string | null;
  ai_call_completed_at: string | null;
}

interface AiCallLog {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string | null;
  phone_number: string | null;
  transcript: string | null;
  recording_url: string | null;
  call_url: string | null;
  duration_seconds: number | null;
  call_status: string;
  initiated_at: string;
  completed_at: string | null;
}

interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

let _toastId = 0;

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border font-bold text-sm max-w-xs",
              t.type === "success" && "bg-emerald-500/90 text-white border-emerald-400/50",
              t.type === "error"   && "bg-red-500/90 text-white border-red-400/50",
              t.type === "warning" && "bg-amber-500/90 text-white border-amber-400/50",
              t.type === "info"    && "bg-indigo-500/90 text-white border-indigo-400/50",
            )}>
            {t.type === "info"    && <Bot className="w-4 h-4 shrink-0" />}
            {t.type === "success" && <CheckCircle className="w-4 h-4 shrink-0" />}
            {t.type === "error"   && <AlertCircle className="w-4 h-4 shrink-0" />}
            {t.type === "warning" && <Bell className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => onRemove(t.id)} className="opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function AiCallStatusBadge({ status }: { status: string | null }) {
  const { t } = useLanguage();
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    pending:     { label: t("calls.status_calling"),   cls: "bg-violet-100 text-violet-700 animate-pulse" },
    completed:   { label: t("calls.status_done"),      cls: "bg-emerald-100 text-emerald-700" },
    failed:      { label: t("calls.status_failed"),    cls: "bg-red-100 text-red-700" },
    "no-answer": { label: t("calls.status_no_answer"), cls: "bg-amber-100 text-amber-700" },
  };
  const cfg = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider", cfg.cls)}>{cfg.label}</span>;
}

function AiCallResultsPanel({
  logs,
  selectedIds,
  onToggleSelect,
}: {
  logs: AiCallLog[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
}) {
  const { t } = useLanguage();
  if (!logs.length) return null;
  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <motion.div key={log.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className={cn("bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-2xl border overflow-hidden",
            selectedIds.has(log.id) ? "border-violet-500 ring-1 ring-violet-500" : "border-violet-200 dark:border-violet-900/40")}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-violet-100 dark:border-violet-900/30">
            <div className="flex items-center gap-2.5">
              <input type="checkbox" checked={selectedIds.has(log.id)} onChange={() => onToggleSelect(log.id)}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer" />
              <Bot className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-black text-violet-700 dark:text-violet-300">
                {t("calls.ai_call")} — {log.entity_name || `${log.entity_type} #${log.entity_id}`}
              </span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                log.call_status === "completed" ? "bg-emerald-100 text-emerald-700" :
                log.call_status === "failed"    ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              )}>{log.call_status}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
              {log.phone_number && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{log.phone_number}</span>}
              {log.duration_seconds && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(log.duration_seconds)}</span>}
              <span suppressHydrationWarning>{new Date(log.initiated_at).toLocaleString()}</span>
            </div>
          </div>
          {log.recording_url && (
            <div className="px-5 py-3 border-b border-violet-100 dark:border-violet-900/30">
              <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Volume2 className="w-3 h-3" /> {t("calls.call_recording")}
              </p>
              <audio controls src={log.recording_url} className="w-full h-10 rounded-xl" />
              <a href={log.recording_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline mt-1.5 font-bold">
                <ExternalLink className="w-3 h-3" /> {t("calls.open_new_tab")}
              </a>
            </div>
          )}
          {log.call_url && (
            <div className="px-5 py-3 border-b border-violet-100 dark:border-violet-900/30">
              <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" /> {t("calls.call_url")}
              </p>
              <a href={log.call_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline mt-1.5 font-bold break-all">
                {log.call_url}
              </a>
            </div>
          )}
          {log.transcript ? (
            <div className="px-5 py-4">
              <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Mic className="w-3 h-3" /> {t("calls.conversation_transcript")}
              </p>
              <div className="bg-white/70 dark:bg-zinc-900/50 rounded-xl p-4 border border-violet-100 dark:border-violet-900/30 max-h-64 overflow-y-auto">
                <pre className="text-xs text-slate-700 dark:text-zinc-200 font-medium leading-relaxed whitespace-pre-wrap font-sans">{log.transcript}</pre>
              </div>
            </div>
          ) : log.call_status === "pending" ? (
            <div className="px-5 py-8 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-zinc-900/30">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                 <Phone className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-zinc-200 mb-1">{t("calls.dialing_name").replace("{name}", log.entity_name || log.phone_number || "")}</h3>
              <p className="text-sm text-slate-500 font-medium max-w-sm">
                {t("calls.dialing_waiting")}
              </p>
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-400 font-medium">{t("calls.no_transcript")}</div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function CallDetailPanel({ call, onSave }: { call: CallEntry; onSave: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    summary: call.summary || "",
    description: call.description || "",
    work_done: call.work_done || "",
    assigned_to: call.assigned_to || "",
    followup_needed: call.followup_needed,
    followup_date: call.followup_date || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-4">
      {call.description && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/50">
          <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-2">{t("calls.full_pitch_description")}</p>
          <p className="text-sm text-slate-700 dark:text-zinc-200 font-medium leading-relaxed whitespace-pre-wrap">{call.description}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{t("calls.summary")}</label>
          <textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder={t("calls.summary_placeholder")} className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-700 dark:text-zinc-200 resize-none" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{t("calls.work_done")}</label>
          <textarea rows={2} value={form.work_done} onChange={(e) => setForm({ ...form, work_done: e.target.value })}
            placeholder={t("calls.work_done_placeholder")} className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 text-slate-700 dark:text-zinc-200 resize-none" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{t("calls.assigned_to")}</label>
          <input type="text" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            placeholder={t("calls.assign_placeholder")} className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-slate-700 dark:text-zinc-200" />
        </div>
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div onClick={() => setForm({ ...form, followup_needed: !form.followup_needed })}
              className={cn("w-11 h-6 rounded-full transition-all relative cursor-pointer", form.followup_needed ? "bg-red-500" : "bg-slate-200 dark:bg-zinc-700")}>
              <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", form.followup_needed ? "right-1" : "left-1")} />
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">{t("calls.followup_needed")}</span>
          </label>
          {form.followup_needed && (
            <input type="date" value={form.followup_date} onChange={(e) => setForm({ ...form, followup_date: e.target.value })}
              className="mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-2xl text-sm font-bold text-red-700 outline-none" />
          )}
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-40">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {saved ? t("calls.saved") : t("calls.save_changes")}
      </button>
    </div>
  );
}

export default function CallsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"logged" | "scheduled" | "ai-calls">("logged");
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [aiCallLogs, setAiCallLogs] = useState<AiCallLog[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<{ id: number; name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [logForm, setLogForm] = useState({ phone_number: "", duration_seconds: "", description: "", work_done: "", assigned_to: "", followup_needed: false, followup_date: "" });
  const [schedForm, setSchedForm] = useState({ title: "", scheduled_at: "", entity_type: "client", entity_id: "", notes: "", assigned_to: "" });
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [genType, setGenType] = useState<"client" | "lead" | "contact">("client");
  const [genEntityId, setGenEntityId] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedSchedId, setExpandedSchedId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedCallIds, setSelectedCallIds] = useState<Set<number>>(new Set());
  const [selectedAiCallIds, setSelectedAiCallIds] = useState<Set<number>>(new Set());

  const addToast = (message: string, type: Toast["type"] = "info", duration = 5000) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  };
  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const authHeaders = () => {
    const headers: Record<string, string> = {};
    try {
      const saved = localStorage.getItem("crm_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id) headers["X-User-ID"] = String(parsed.id);
        if (parsed.tenant_id && parsed.role !== "SuperAdmin") headers["X-Tenant-ID"] = String(parsed.tenant_id);
      }
    } catch (e) {}
    return headers;
  };

  const fetchAll = async () => {
    try {
      const [callsRes, schedRes, aiLogsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/calls`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/scheduled-calls`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/calling-agent-logs`, { headers: authHeaders() }),
      ]);

      const [callsData, schedData, aiLogsData] = await Promise.all([
        callsRes.ok ? callsRes.json().catch(() => null) : null,
        schedRes.ok ? schedRes.json().catch(() => null) : null,
        aiLogsRes.ok ? aiLogsRes.json().catch(() => null) : null,
      ]);

      console.log("📞 Calls API Response:", callsData);
      console.log("📅 Scheduled Calls API Response:", schedData);
      console.log("🤖 AI Calls API Response:", aiLogsData);

      // Only commit state from valid 2xx responses so a slow/failed poll never
      // blanks out previously loaded data ("visible then invisible").
      if (callsRes.ok && callsData && Array.isArray(callsData.calls)) setCalls(callsData.calls);
      if (schedRes.ok && schedData && Array.isArray(schedData.scheduled_calls)) setScheduledCalls(schedData.scheduled_calls);
      if (aiLogsRes.ok && aiLogsData && Array.isArray(aiLogsData.calling_agent_logs)) setAiCallLogs(aiLogsData.calling_agent_logs);
    } catch (e) {
      console.error("❌ Error fetching calls:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadEntityLists = async () => {
    try {
      const [clientsRes, leadsRes, contactsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/clients?per_page=100&page=1`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/leads`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/contacts`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/users?role=Admin,SalesManager,Employee,ProjectMember,Intern`, { headers: authHeaders() }),
      ]);

      const [clientsData, leadsData, contactsData, usersData] = await Promise.all([
        clientsRes.ok ? clientsRes.json().catch(() => null) : null,
        leadsRes.ok ? leadsRes.json().catch(() => null) : null,
        contactsRes.ok ? contactsRes.json().catch(() => null) : null,
        usersRes.ok ? usersRes.json().catch(() => null) : null,
      ]);

      setClients((clientsData && clientsData.clients) || []);
      setLeads((leadsData && leadsData.leads) || []);
      setContacts((contactsData && contactsData.contacts) || []);
      if (usersData && Array.isArray(usersData.users)) setTeamUsers(usersData.users);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAll();
    loadEntityLists();
  }, []);

  useEffect(() => {
    const hasPending = aiCallLogs.some(log => log.call_status === "pending");
    const interval = setInterval(() => {
      fetchAll();
    }, hasPending ? 3000 : 20000);
    return () => clearInterval(interval);
  }, [aiCallLogs]);

  // Debug: Log state updates
  useEffect(() => {
    console.log("📊 Component State Updated:");
    console.log("  - calls:", calls.length, "items");
    console.log("  - scheduledCalls:", scheduledCalls.length, "items");
    console.log("  - aiCallLogs:", aiCallLogs.length, "items");
    console.log("  - loading:", loading);
    console.log("  - activeTab:", activeTab);
  }, [calls, scheduledCalls, aiCallLogs, loading, activeTab]);

  const getEntityName = (type: string, id: string) => {
    if (type === "client") {
      const c = clients.find((c) => c.id.toString() === id);
      return c?.companyName || c?.projectName || t("calls.unknown");
    }
    if (type === "lead") return leads.find((l) => l.id.toString() === id)?.company_name || t("calls.unknown");
    const c = contacts.find((c) => c.id.toString() === id);
    return c ? `${c.first_name} ${c.last_name || ""}`.trim() : t("calls.unknown");
  };
  const getEntityEmail = (type: string, id: string) => {
    if (type === "client") return clients.find((c) => c.id.toString() === id)?.email || null;
    if (type === "lead") return leads.find((l) => l.id.toString() === id)?.email || null;
    return contacts.find((c) => c.id.toString() === id)?.email || null;
  };
  const getEntityPhone = (type: string, id: string): string | null => {
    if (type === "client") return clients.find((c) => c.id.toString() === id)?.phone || null;
    if (type === "lead") return leads.find((l) => l.id.toString() === id)?.phone || null;
    return null;
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          phone_number: logForm.phone_number,
          duration_seconds: logForm.duration_seconds ? parseInt(logForm.duration_seconds) : null,
          description: logForm.description || null,
          work_done: logForm.work_done || null,
          assigned_to: logForm.assigned_to || null,
          followup_needed: logForm.followup_needed,
          followup_date: logForm.followup_date || null,
        }),
      });
      if (!res.ok) {
        addToast(t("calls.failed_log_toast") || "Failed to log call", "error");
        return;
      }
      setLogForm({ phone_number: "", duration_seconds: "", description: "", work_done: "", assigned_to: "", followup_needed: false, followup_date: "" });
      setShowLogModal(false);
      fetchAll();
    } finally { setSubmitting(false); }
  };

  const handleScheduleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const entityName = getEntityName(schedForm.entity_type, schedForm.entity_id);
      const entityEmail = getEntityEmail(schedForm.entity_type, schedForm.entity_id);
      const res = await fetch(`${API_BASE_URL}/scheduled-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: schedForm.title,
          scheduled_at: schedForm.scheduled_at || null,
          entity_type: schedForm.entity_type,
          entity_id: schedForm.entity_id ? parseInt(schedForm.entity_id) : null,
          entity_name: entityName,
          entity_email: entityEmail,
          notes: schedForm.notes || null,
          assigned_to: schedForm.assigned_to || null,
        }),
      });
      let data: any = null;
      try { data = await res.json(); } catch {}

      // Email confirmation UI rejected the send → do NOT schedule or close.
      if (data && data.cancelled) {
        addToast(t("calls.email_cancelled_toast") || "Email not sent. Call not scheduled.", "info");
        return;
      }
      if (!res.ok) {
        addToast(data?.detail || data?.message || t("calls.failed_schedule_toast") || "Failed to schedule call.", "error");
        return;
      }
      setSchedForm({ title: "", scheduled_at: "", entity_type: "client", entity_id: "", notes: "", assigned_to: "" });
      setShowScheduleModal(false);
      setActiveTab("scheduled");
      fetchAll();
      addToast(t("calls.scheduled_toast") || "Call scheduled — email sent to client.", "success");
    } finally { setSubmitting(false); }
  };

  const handleDeleteScheduled = async (id: number) => {
    if (!confirm(t("calls.delete_scheduled_confirm"))) return;
    await fetch(`${API_BASE_URL}/scheduled-calls/${id}`, { method: "DELETE" });
    fetchAll();
  };
  const handleMarkCompleted = async (id: number) => {
    await fetch(`${API_BASE_URL}/scheduled-calls/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Completed" }),
    });
    fetchAll();
  };

  const toggleSelectCall = (id: number) => {
    const newSet = new Set(selectedCallIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedCallIds(newSet);
  };
  const toggleSelectAllCalls = () => {
    if (selectedCallIds.size === calls.length) setSelectedCallIds(new Set());
    else setSelectedCallIds(new Set(calls.map(c => c.id)));
  };
  const deleteSelectedCalls = async () => {
    if (selectedCallIds.size === 0) return;
    if (!confirm(t("calls.delete_selected_confirm"))) return;
    await fetch(`${API_BASE_URL}/calls/bulk?ids=${Array.from(selectedCallIds).join(',')}`, { method: 'DELETE' });
    setSelectedCallIds(new Set());
    fetchAll();
  };

  const toggleSelectAiCall = (id: number) => {
    const newSet = new Set(selectedAiCallIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedAiCallIds(newSet);
  };
  const toggleSelectAllAiCalls = () => {
    if (selectedAiCallIds.size === aiCallLogs.length) setSelectedAiCallIds(new Set());
    else setSelectedAiCallIds(new Set(aiCallLogs.map(c => c.id)));
  };
  const deleteSelectedAiCalls = async () => {
    if (selectedAiCallIds.size === 0) return;
    if (!confirm(t("calls.delete_selected_ai_confirm"))) return;
    await fetch(`${API_BASE_URL}/calling-agent-logs?ids=${Array.from(selectedAiCallIds).join(',')}`, { method: 'DELETE' });
    setSelectedAiCallIds(new Set());
    fetchAll();
  };


  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-5xl mx-auto space-y-8 p-6">

        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-amber-700 to-slate-900 dark:from-white dark:via-amber-400 dark:to-white tracking-tight">{t("calls.title")}</h1>
            <p className="text-slate-500 dark:text-zinc-400 font-medium mt-1">
              {calls.length} {t("calls.logged_suffix")} &middot; {scheduledCalls.filter((s) => s.status === "Scheduled").length} {t("calls.scheduled_suffix")} &middot; {aiCallLogs.length} {t("calls.ai_calls_suffix")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl font-bold text-sm hover:-translate-y-0.5 transition-all shadow-lg">
              <Zap className="w-4 h-4" /> {t("calls.generate_pitch_call")}
            </button>
            <button onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold shadow-lg hover:-translate-y-0.5 transition-all text-sm">
              <CalendarClock className="w-4 h-4" /> {t("calls.schedule_call")}
            </button>
            <button onClick={() => setShowLogModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold shadow-[0_8px_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 transition-all text-sm">
              <Plus className="w-4 h-4" /> {t("calls.log_call")}
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants} className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl w-fit">
          <button onClick={() => setActiveTab("logged")}
            className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              activeTab === "logged" ? "bg-white dark:bg-zinc-800 text-amber-600 shadow-sm" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700")}>
            <PhoneCall className="w-4 h-4" /> {t("calls.tab_logged")}
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-black",
              activeTab === "logged" ? "bg-amber-100 text-amber-700" : "bg-slate-200 dark:bg-zinc-700 text-slate-500")}>{calls.length}</span>
          </button>
          <button onClick={() => setActiveTab("scheduled")}
            className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              activeTab === "scheduled" ? "bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700")}>
            <CalendarClock className="w-4 h-4" /> {t("calls.tab_scheduled")}
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-black",
              activeTab === "scheduled" ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 dark:bg-zinc-700 text-slate-500")}>{scheduledCalls.filter((s) => s.status === "Scheduled").length}</span>
          </button>
          <button onClick={() => setActiveTab("ai-calls")}
            className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              activeTab === "ai-calls" ? "bg-white dark:bg-zinc-800 text-violet-600 shadow-sm" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700")}>
            <Bot className="w-4 h-4" /> {t("calls.tab_ai")}
            {aiCallLogs.length > 0 && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-black",
                activeTab === "ai-calls" ? "bg-violet-100 text-violet-700" : "bg-slate-200 dark:bg-zinc-700 text-slate-500")}>{aiCallLogs.length}</span>
            )}
          </button>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">

          {/* Logged Calls */}
          {activeTab === "logged" && (
            <motion.div key="logged" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="space-y-4">
              {calls.length > 0 && !loading && (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl">
                  <label className="flex items-center gap-3 cursor-pointer pl-2">
                    <input type="checkbox" checked={selectedCallIds.size === calls.length && calls.length > 0} onChange={toggleSelectAllCalls}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer" />
                    <span className="text-sm font-bold text-slate-600 dark:text-zinc-300">{t("calls.select_all")}</span>
                  </label>
                  {selectedCallIds.size > 0 && (
                    <button onClick={deleteSelectedCalls} className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-bold transition-colors">
                      <Trash2 className="w-4 h-4" /> {t("calls.delete_count").replace("{count}", String(selectedCallIds.size))}
                    </button>
                  )}
                </div>
              )}
              {loading ? (
                <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
              ) : calls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-4">
                  <PhoneOff className="w-14 h-14 opacity-30" />
                  <p className="font-bold text-lg">{t("calls.no_logged")}</p>
                  <button onClick={() => setShowLogModal(true)} className="text-amber-600 font-bold hover:underline">{t("calls.log_first")}</button>
                </div>
              ) : (
                <>
                  {aiCallLogs.filter(log => log.call_status === "pending").map((log) => (
                    <motion.div key={`pending-${log.id}`} variants={itemVariants}
                      className="bg-white dark:bg-zinc-900/60 backdrop-blur-2xl border border-slate-100 dark:border-zinc-800 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 relative overflow-hidden transition-all">
                      <div className="flex items-start gap-4">
                        <div className="mt-3.5 w-4 h-4 rounded" /> 
                        <div className="p-3 rounded-2xl shrink-0 bg-slate-50 text-slate-400">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-1">
                            <span className="font-black text-slate-800 dark:text-zinc-100 text-lg">{log.entity_name || log.phone_number}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">{t("calls.dialing")}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400 font-medium mt-2">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t("calls.ongoing_call")}</span>
                            <span suppressHydrationWarning>{new Date(log.initiated_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {calls.map((call) => (
                    <motion.div key={call.id} variants={itemVariants}
                    className={cn("bg-white dark:bg-zinc-900/60 backdrop-blur-2xl border rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 transition-all",
                      call.followup_needed ? "border-red-200 dark:border-red-900/50" : "border-slate-100 dark:border-zinc-800",
                      selectedCallIds.has(call.id) && "ring-2 ring-amber-400 border-amber-400")}>
                    <div className="flex items-start gap-4">
                      <input type="checkbox" checked={selectedCallIds.has(call.id)} onChange={() => toggleSelectCall(call.id)}
                        className="mt-3.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer" />
                      <div className={cn("p-3 rounded-2xl shrink-0", call.summary?.startsWith("AI Call") ? "bg-violet-50 text-violet-500" : call.summary ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500")}>
                        {call.summary?.startsWith("AI Call") ? <Bot className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <span className="font-black text-slate-800 dark:text-zinc-100 text-lg">{call.entity_name || call.phone_number}</span>
                          {call.entity_name && <span className="text-sm font-bold text-slate-400">({call.phone_number})</span>}
                          {!call.summary && <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">{t("calls.needs_summary")}</span>}
                          {call.followup_needed && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">{t("calls.followup_badge")}</span>}
                          {call.assigned_to && <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full">{call.assigned_to}</span>}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(call.duration_seconds)}</span>
                          <span suppressHydrationWarning>{new Date(call.received_at).toLocaleString()}</span>
                          {call.followup_date && <span className="text-red-600 font-bold">Due: {call.followup_date}</span>}
                        </div>
                        {call.summary && (
                          <p className="text-sm text-slate-600 dark:text-zinc-300 font-medium bg-slate-50 dark:bg-zinc-800 p-3 rounded-2xl border border-slate-100 dark:border-zinc-700 mt-3 line-clamp-2">{call.summary}</p>
                        )}
                      </div>
                      <button onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                        className="shrink-0 p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-slate-500 dark:text-zinc-400">
                        {expandedId === call.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {expandedId === call.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}>
                          <CallDetailPanel call={call} onSave={fetchAll} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
                </>
              )}
            </motion.div>
          )}

          {/* Scheduled Calls */}
          {activeTab === "scheduled" && (
            <motion.div key="scheduled" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
              ) : scheduledCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-4">
                  <CalendarClock className="w-14 h-14 opacity-30" />
                  <p className="font-bold text-lg">{t("calls.no_scheduled")}</p>
                  <button onClick={() => setShowScheduleModal(true)} className="text-indigo-600 font-bold hover:underline">{t("calls.schedule_first")}</button>
                </div>
              ) : (
                scheduledCalls.map((sc) => (
                  <motion.div key={sc.id} variants={itemVariants} initial="hidden" animate="show"
                    className={cn("bg-white dark:bg-zinc-900/60 backdrop-blur-2xl border rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 transition-all",
                      sc.status === "Completed" ? "border-emerald-100 dark:border-emerald-900/40 opacity-75" : "border-slate-100 dark:border-zinc-800")}>
                    <div className="flex items-start gap-4">
                      <div className={cn("p-3 rounded-2xl shrink-0", sc.status === "Completed" ? "bg-emerald-50 text-emerald-500" : "bg-indigo-50 text-indigo-500")}>
                        {sc.status === "Completed" ? <CheckCircle className="w-5 h-5" /> : <CalendarClock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <span className="font-black text-slate-800 dark:text-zinc-100 text-lg">{sc.title}</span>
                          <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider",
                            sc.status === "Completed" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700")}>{sc.status}</span>
                          {sc.pitch && <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-full">{t("calls.pitch_ready")}</span>}
                          <AiCallStatusBadge status={sc.ai_call_status} />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400 font-medium flex-wrap">
                          {sc.entity_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{sc.entity_name} ({sc.entity_type})</span>}
                          {sc.scheduled_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span suppressHydrationWarning>{new Date(sc.scheduled_at).toLocaleString()}</span></span>}
                          {sc.entity_email && <span className="flex items-center gap-1 text-indigo-500"><Mail className="w-3 h-3" />{sc.entity_email}</span>}
                          {sc.assigned_to && <span className="flex items-center gap-1"><User className="w-3 h-3" />{sc.assigned_to}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sc.status !== "Completed" && (
                           <button onClick={() => handleMarkCompleted(sc.id)} title={t("calls.mark_completed")}
                            className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-colors text-slate-400 hover:text-emerald-600">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setExpandedSchedId(expandedSchedId === sc.id ? null : sc.id)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-slate-500 dark:text-zinc-400">
                          {expandedSchedId === sc.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleDeleteScheduled(sc.id)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-slate-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {expandedSchedId === sc.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}>
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-4">
                            {sc.pitch && (
                              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 rounded-2xl p-5 border border-purple-100 dark:border-purple-900/50">
                                <div className="flex items-center justify-between mb-3">
                                 <p className="text-xs font-black text-purple-600 uppercase tracking-widest">{t("calls.ai_call_pitch")}</p>
                                 <button onClick={() => navigator.clipboard.writeText(sc.pitch!)}
                                   className="text-xs font-bold text-purple-600 hover:text-purple-800 bg-purple-100 hover:bg-purple-200 px-3 py-1 rounded-lg transition-colors">{t("calls.copy")}</button>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-zinc-200 font-medium leading-relaxed whitespace-pre-wrap">{sc.pitch}</p>
                              </div>
                            )}
                            {sc.notes && (
                              <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t("calls.notes")}</p>
                                <p className="text-sm text-slate-700 dark:text-zinc-300">{sc.notes}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {/* AI Calls Tab */}
          {activeTab === "ai-calls" && (
            <motion.div key="ai-calls" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="rounded-3xl border-2 border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-700 p-12 text-center shadow-lg shadow-violet-500/10">
                <Bot className="w-14 h-14 mx-auto text-violet-600 mb-5" />
                <h2 className="text-2xl font-black text-violet-800 dark:text-violet-200">AI Calling is coming soon</h2>
                <p className="mt-3 text-sm font-medium text-violet-700/80 dark:text-violet-300/80 max-w-md mx-auto">The AI calling agent is being prepared. Logged calls and scheduled calls are available now.</p>
              </div>
              {false && <>
              <div className="flex items-start gap-3 p-4 bg-violet-50 dark:bg-violet-950/20 rounded-2xl border border-violet-100 dark:border-violet-900/30">
                <Bot className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{t("calls.ai_agent_title")}</p>
                  <p className="text-xs text-violet-600/80 dark:text-violet-400 mt-0.5">
                    {t("calls.ai_agent_desc")}
                  </p>
                </div>
              </div>
              {aiCallLogs.length > 0 && !loading && (
                <div className="flex items-center justify-between bg-violet-50/50 dark:bg-violet-900/10 p-3 rounded-2xl">
                  <label className="flex items-center gap-3 cursor-pointer pl-2">
                    <input type="checkbox" checked={selectedAiCallIds.size === aiCallLogs.length && aiCallLogs.length > 0} onChange={toggleSelectAllAiCalls}
                      className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer" />
                    <span className="text-sm font-bold text-violet-700 dark:text-violet-300">{t("calls.select_all")}</span>
                  </label>
                  {selectedAiCallIds.size > 0 && (
                    <button onClick={deleteSelectedAiCalls} className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-bold transition-colors">
                      <Trash2 className="w-4 h-4" /> {t("calls.delete_count").replace("{count}", String(selectedAiCallIds.size))}
                    </button>
                  )}
                </div>
              )}
              {loading ? (
                <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
              ) : aiCallLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-4">
                  <Bot className="w-14 h-14 opacity-30" />
                  <p className="font-bold text-lg">{t("calls.no_ai_calls")}</p>
                </div>
              ) : (
                <AiCallResultsPanel 
                  logs={aiCallLogs} 
                  selectedIds={selectedAiCallIds} 
                  onToggleSelect={toggleSelectAiCall} 
                />
              )}
              </>}
            </motion.div>
          )}

        </AnimatePresence>

        {/* Log Call Modal */}
        <AnimatePresence>
          {showLogModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="bg-white dark:bg-zinc-900/95 backdrop-blur-2xl rounded-[2rem] border border-slate-200 dark:border-zinc-700 shadow-2xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto">
                <button onClick={() => setShowLogModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Phone className="w-5 h-5" /></div>
                  {t("calls.log_new_call")}
                </h2>
                <form onSubmit={handleLogCall} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.phone_number")}</label>
                      <input type="text" required placeholder="+91 98765 43210" value={logForm.phone_number}
                        onChange={(e) => setLogForm({ ...logForm, phone_number: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.duration_seconds")}</label>
                      <input type="number" placeholder="e.g. 180" min={0} value={logForm.duration_seconds}
                        onChange={(e) => setLogForm({ ...logForm, duration_seconds: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-400/30" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.assigned_to")}</label>
                      <select value={logForm.assigned_to} onChange={(e) => setLogForm({ ...logForm, assigned_to: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-400/30">
                        <option value="">{t("calls.select_team_member")}</option>
                        {teamUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.description")}</label>
                    <textarea rows={3} placeholder={t("calls.description_placeholder")} value={logForm.description}
                      onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-400/30 resize-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.work_done")}</label>
                    <textarea rows={2} placeholder={t("calls.work_done_placeholder")} value={logForm.work_done}
                      onChange={(e) => setLogForm({ ...logForm, work_done: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-400/30 resize-none" />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <div onClick={() => setLogForm({ ...logForm, followup_needed: !logForm.followup_needed })}
                        className={cn("w-11 h-6 rounded-full transition-all relative cursor-pointer", logForm.followup_needed ? "bg-red-500" : "bg-slate-200 dark:bg-zinc-700")}>
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", logForm.followup_needed ? "right-1" : "left-1")} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">{t("calls.followup_needed")}</span>
                    </label>
                    {logForm.followup_needed && (
                      <input type="date" value={logForm.followup_date}
                        onChange={(e) => setLogForm({ ...logForm, followup_date: e.target.value })}
                        className="px-4 py-2 bg-red-50 border border-red-200 rounded-2xl text-sm font-bold text-red-700 outline-none" />
                    )}
                  </div>
                  <button type="submit" disabled={submitting}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                    {t("calls.save_call_log")}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedule Call Modal */}
        <AnimatePresence>
          {showScheduleModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="bg-white dark:bg-zinc-900/95 backdrop-blur-2xl rounded-[2rem] border border-slate-200 dark:border-zinc-700 shadow-2xl w-full max-w-xl p-8 relative max-h-[90vh] overflow-y-auto">
                <button onClick={() => setShowScheduleModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><CalendarClock className="w-5 h-5" /></div>
                  {t("calls.schedule_a_call")}
                </h2>
                <form onSubmit={handleScheduleCall} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.call_title")}</label>
                    <input type="text" required placeholder="e.g. Discovery call with Acme Corp" value={schedForm.title}
                      onChange={(e) => setSchedForm({ ...schedForm, title: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-400/30" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.scheduled_datetime")}</label>
                    <input type="datetime-local" value={schedForm.scheduled_at}
                      onChange={(e) => setSchedForm({ ...schedForm, scheduled_at: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-400/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.type")}</label>
                      <select value={schedForm.entity_type} onChange={(e) => setSchedForm({ ...schedForm, entity_type: e.target.value, entity_id: "" })}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-400/30">
                        <option value="client">Client</option>
                        <option value="lead">Lead</option>
                        <option value="contact">Contact</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.select_entity").replace("{entity}", schedForm.entity_type)}</label>
                      <select value={schedForm.entity_id} onChange={(e) => setSchedForm({ ...schedForm, entity_id: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-400/30">
                        <option value="">{t("calls.select_placeholder")}</option>
                        {schedForm.entity_type === "client" && clients.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.projectName || c.email}</option>)}
                        {schedForm.entity_type === "lead" && leads.map((l) => <option key={l.id} value={l.id}>{l.company_name || l.email}</option>)}
                        {schedForm.entity_type === "contact" && contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ""}</option>)}
                      </select>
                    </div>
                  </div>
                  {schedForm.entity_id && (() => {
                    const em = getEntityEmail(schedForm.entity_type, schedForm.entity_id);
                    return em ? (
                      <div className="flex items-start gap-2 p-3 bg-sky-50 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900/40">
                        <Mail className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-sky-700 dark:text-sky-300 font-medium break-all">
                          {t("calls.notify_email").replace("{email}", em)}
                        </p>
                      </div>
                    ) : null;
                  })()}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.notes")}</label>
                    <textarea rows={2} placeholder={t("calls.notes_placeholder")} value={schedForm.notes}
                      onChange={(e) => setSchedForm({ ...schedForm, notes: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-400/30 resize-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.assign_to")}</label>
                    <select value={schedForm.assigned_to} onChange={(e) => setSchedForm({ ...schedForm, assigned_to: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-400/30">
                      <option value="">{t("calls.select_team_member")}</option>
                      {teamUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      {t("calls.email_notification")}
                    </p>
                  </div>
                  <button type="submit" disabled={submitting || !schedForm.title}
                    className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                    {t("calls.schedule_and_notify")}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate Pitch Modal — with Call via AI button at bottom */}
        <AnimatePresence>
          {showGenerateModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="bg-white dark:bg-zinc-900/95 backdrop-blur-2xl rounded-[2rem] border border-slate-200 dark:border-zinc-700 shadow-2xl w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 dark:border-zinc-800">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 flex items-center gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Zap className="w-5 h-5" /></div>
                    {t("calls.generate_ai_pitch")}
                  </h2>
                  <button onClick={() => { setShowGenerateModal(false); setGeneratedPitch(""); setGenEntityId(""); setAiContext(""); }} className="text-slate-400 hover:text-slate-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.type")}</label>
                      <select value={genType} onChange={(e) => { setGenType(e.target.value as "client" | "lead" | "contact"); setGenEntityId(""); setGeneratedPitch(""); setAiContext(""); }}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-400/30">
                        <option value="client">Client</option>
                        <option value="lead">Lead</option>
                        <option value="contact">Contact</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t("calls.select_entity").replace("{entity}", "")}</label>
                      <select value={genEntityId} onChange={(e) => { setGenEntityId(e.target.value); setGeneratedPitch(""); setAiContext(""); }}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-400/30">
                        <option value="">{t("calls.select_placeholder")}</option>
                        {genType === "client" && clients.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.projectName || c.email}</option>)}
                        {genType === "lead" && leads.map((l) => <option key={l.id} value={l.id}>{l.company_name || l.email}</option>)}
                        {genType === "contact" && contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ""}</option>)}
                      </select>
                    </div>
                  </div>

                  {genEntityId && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Additional Context / Questions (Optional)</label>
                      <textarea
                        value={aiContext}
                        onChange={(e) => setAiContext(e.target.value)}
                        placeholder="E.g., Focus on our new SEO package, or mention we saw their recent LinkedIn post..."
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-medium text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-400/30 resize-none h-24"
                      />
                    </div>
                  )}

                  {genEntityId && genType !== "contact" && getEntityPhone(genType, genEntityId) && (
                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      Phone on file: {getEntityPhone(genType, genEntityId)}
                    </div>
                  )}

                  <button type="button" disabled={generating || !genEntityId}
                    onClick={async () => {
                      if (!genEntityId) return;
                      setGenerating(true);
                      try {
                        const res = await fetch(`${API_BASE_URL}/${genType}s/${genEntityId}/simulate-call`, { 
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ context: aiContext })
                        });
                        if (res.ok) { 
                          const data = await res.json(); 
                          setGeneratedPitch(data.pitch || ""); 
                          fetchAll(); 
                           addToast(t("calls.pitch_generated_toast"), "success");
                        } else {
                          const err = await res.json().catch(() => ({}));
        addToast(err.detail || t("calls.failed_generate_pitch"), "error");
                        }
                      } catch (e) { 
                        console.error(e); 
      addToast(t("calls.network_error_pitch"), "error");
                      }
                      finally { setGenerating(false); }
                    }}
                    className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    {generating ? t("calls.generating_pitch") : t("calls.generate_ai_pitch_btn")}
                  </button>

                  {generatedPitch && (
                    <>
                      <div className="bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-zinc-800 dark:to-indigo-950/30 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900/40">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{t("calls.pitch_generated")}</p>
                          <button onClick={() => navigator.clipboard.writeText(generatedPitch)}
                            className="text-xs font-bold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 px-3 py-1 rounded-lg transition-colors">{t("calls.copy")}</button>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-zinc-200 font-medium leading-relaxed whitespace-pre-wrap">{generatedPitch}</p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => { setShowGenerateModal(false); setGeneratedPitch(""); setGenEntityId(""); setAiContext(""); }}
                          className="w-full py-3.5 rounded-2xl font-black text-sm bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" /> {t("calls.done")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </>
  );
}
