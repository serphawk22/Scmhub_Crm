"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Plus, X, Search, Loader2, Trash2, ChevronDown, Building2, AlertCircle } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

interface Quote { id: number; quote_number?: string; title: string; status: string; grand_total: number; currency: string; lead_name?: string; client_name?: string; lead_id?: number; client_id?: number; valid_until?: string; created_at: string; }
interface Lead { id: number; company_name: string; email?: string; }
interface Client { id: number; companyName?: string; userId?: number; }

const STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Expired"];
const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400",
  Sent: "bg-blue-500/10 text-blue-600",
  Accepted: "bg-emerald-500/10 text-emerald-600",
  Rejected: "bg-red-500/10 text-red-500",
  Expired: "bg-amber-500/10 text-amber-600"
};

export default function QuotesPage() {
  const { t } = useLanguage();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pendingSend, setPendingSend] = useState<{ quote: Quote; trigger?: "list" } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [form, setForm] = useState({
    title: "", status: "Draft", currency: "USD",
    valid_until: "", notes: "",
    linked_to: "lead" as "lead" | "client",
    lead_id: "" as string | number,
    client_id: "" as string | number,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE_URL}/quotes`).then(r => r.json()),
      fetch(`${API_BASE_URL}/leads`).then(r => r.json()),
      fetch(`${API_BASE_URL}/clients?per_page=1000`).then(r => r.json()),
    ]).then(([qd, ld, cd]) => {
      setQuotes(Array.isArray(qd.quotes) ? qd.quotes : []);
      setLeads(Array.isArray(ld.leads) ? ld.leads : []);
      setClients(Array.isArray(cd.clients) ? cd.clients : []);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => quotes.filter(q => {
    const s = search.toLowerCase();
    return (!s || q.title.toLowerCase().includes(s) || (q.quote_number || "").toLowerCase().includes(s) || (q.client_name || q.lead_name || "").toLowerCase().includes(s))
      && (statusFilter === "All" || q.status === statusFilter);
  }), [quotes, search, statusFilter]);

  const openCreate = () => {
    setForm({ title: "", status: "Draft", currency: "USD", valid_until: "", notes: "", linked_to: "lead", lead_id: "", client_id: "" });
    setShowModal(true);
  };

  const canSave = () => {
    if (!form.title.trim()) return false;
    if (form.linked_to === "lead" && !form.lead_id) return false;
    if (form.linked_to === "client" && !form.client_id) return false;
    return true;
  };

  const handleSave = async () => {
    if (!canSave()) return;
    setSaving(true);
    setEmailStatus(null);
    const payload: any = { title: form.title, status: form.status, currency: form.currency, valid_until: form.valid_until, notes: form.notes };
    if (form.linked_to === "lead" && form.lead_id) payload.lead_id = Number(form.lead_id);
    if (form.linked_to === "client" && form.client_id) payload.client_id = Number(form.client_id);
    try {
      const res = await fetch(`${API_BASE_URL}/quotes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        setEmailStatus({ ok: false, msg: t("quotes.email_error") || "Failed to create quote." });
      } else if (data.email_error) {
        setEmailStatus({ ok: false, msg: t("quotes.email_failed") || "Quote created but failed to send email." });
      } else if (data.email_sent) {
        setEmailStatus({ ok: true, msg: t("quotes.email_sent") || "Quote created and email sent." });
      } else {
        setEmailStatus({ ok: false, msg: t("quotes.email_no_recipient") || "Quote created. No email sent (no client/lead email)." });
      }
      setShowModal(false);
      load();
    } catch {
      setEmailStatus({ ok: false, msg: t("quotes.email_error") || "Failed to create quote." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => { if (!confirm(t("quotes.confirm_delete"))) return; await fetch(`${API_BASE_URL}/quotes/${id}`, { method: "DELETE" }); load(); };

  const updateStatus = async (q: Quote, status: string) => {
    await fetch(`${API_BASE_URL}/quotes/${q.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: q.title, status }) });
    load();
  };

  const handleStatus = async (q: Quote, status: string) => {
    if (status === "Sent") {
      setPendingSend({ quote: q });
      return;
    }
    await updateStatus(q, status);
  };

  const recipientEmailOf = (q: Quote) => {
    if (q.lead_id) return leads.find(l => l.id === q.lead_id)?.email;
    return undefined;
  };

  const sendEmailAndMarkSent = async () => {
    if (!pendingSend) return;
    const q = pendingSend.quote;
    setSendingEmail(true);
    let emailOk = false;
    try {
      const res = await fetch(`${API_BASE_URL}/quotes/${q.id}/send-email`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      emailOk = !!data.email_sent;
      if (emailOk) {
        setEmailStatus({ ok: true, msg: t("quotes.email_sent") ?? "Quote marked as sent and email sent." });
      } else {
        setEmailStatus({ ok: false, msg: data.recipient_email ? (t("quotes.email_failed") ?? "Failed to send email.") : (t("quotes.email_no_recipient") ?? "No email on the linked lead/client.") });
      }
    } catch {
      setEmailStatus({ ok: false, msg: t("quotes.email_failed") ?? "Failed to send email." });
    }
    await fetch(`${API_BASE_URL}/quotes/${q.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: q.title, status: "Sent" }) });
    setSendingEmail(false);
    setPendingSend(null);
    load();
  };

  const markSentOnly = async () => {
    if (!pendingSend) return;
    await updateStatus(pendingSend.quote, "Sent");
    setPendingSend(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20"><FileText className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{t("quotes.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">{t("quotes.subtitle")}</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:opacity-90 shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" /> {t("quotes.new_quote")}
        </button>
      </div>

      {/* Stats */}
      {emailStatus && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${emailStatus.ok ? "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-700" : "bg-red-500/10 text-red-700 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-700"}`}>
          <div className="flex items-center justify-between gap-3">
            <span>{emailStatus.msg}</span>
            <button onClick={() => setEmailStatus(null)} className="text-xs underline opacity-70 hover:opacity-100">OK</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("quotes.stat_total_quotes"), value: quotes.length, c: "text-amber-600 bg-amber-500/10" },
          { label: t("quotes.stat_draft"), value: quotes.filter(q => q.status === "Draft").length, c: "text-slate-600 bg-slate-100 dark:bg-zinc-800 dark:text-zinc-300" },
          { label: t("quotes.stat_accepted"), value: quotes.filter(q => q.status === "Accepted").length, c: "text-emerald-600 bg-emerald-500/10" },
          { label: t("quotes.stat_total_value"), value: `$${filtered.reduce((s, q) => s + q.grand_total, 0).toFixed(0)}`, c: "text-orange-600 bg-orange-500/10" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm">
            <p className={`text-2xl font-black ${s.c.split(" ")[0]}`}>{loading ? "—" : s.value}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("quotes.search_placeholder")}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", ...STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"}`}>{s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[auto_2fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
          {["#", t("quotes.col_title"), t("quotes.col_lead_client"), t("quotes.col_amount"), t("quotes.col_status"), ""].map(h => <p key={h} className="text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</p>)}
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500 w-8 h-8" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-500 font-bold">{t("quotes.empty")}</p>
            <button onClick={openCreate} className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all">{t("quotes.create_first")}</button>
          </div>
        ) : filtered.map((q, i) => (
          <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="grid grid-cols-1 md:grid-cols-[auto_2fr_1.5fr_1fr_1fr_auto] gap-3 md:gap-4 items-center px-6 py-4 border-b border-slate-100 dark:border-zinc-800 last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-800/40 group transition-colors">
            <span className="text-xs font-mono text-slate-400">{q.quote_number || `#${q.id}`}</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{q.title}</p>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-600 dark:text-zinc-300 truncate">{q.client_name || q.lead_name || <span className="text-slate-400 italic">{t("quotes.no_contact")}</span>}</span>
            </div>
            <span className="text-sm font-black text-slate-800 dark:text-zinc-100">{q.currency} {q.grand_total.toFixed(2)}</span>
            <select value={q.status} onChange={e => handleStatus(q, e.target.value)}
              className={`text-xs font-bold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${STATUS_COLORS[q.status]}`}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => handleDelete(q.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          </motion.div>
        ))}
      </div>

      {/* Send Email Confirmation Modal */}
      <AnimatePresence>
        {pendingSend && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget && !sendingEmail) setPendingSend(null); }}>
            <motion.div initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-700">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">{t("quotes.send_email_title")}</h2>
                <button onClick={() => setPendingSend(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                  {t("quotes.send_email_desc") || "Mark this quote as Sent and email the details to the linked lead/client?"}
                </p>
                <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {pendingSend.quote.client_name || pendingSend.quote.lead_name || "#" + pendingSend.quote.id}
                  {recipientEmailOf(pendingSend.quote) ? ` — ${recipientEmailOf(pendingSend.quote)}` : ""}
                </p>
                {!recipientEmailOf(pendingSend.quote) && pendingSend.quote.lead_id && (
                  <p className="mt-2 text-xs text-slate-400">{t("quotes.email_no_lead_email") || "No email found on this lead."}</p>
                )}
                {!recipientEmailOf(pendingSend.quote) && !pendingSend.quote.lead_id && !pendingSend.quote.client_id && (
                  <p className="mt-2 text-xs text-slate-400">{t("quotes.no_contact")}</p>
                )}
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50 rounded-b-2xl">
                <button onClick={markSentOnly} disabled={sendingEmail}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-sm hover:bg-slate-100 transition-all disabled:opacity-40">
                  {t("quotes.mark_sent_only") || "Mark Sent Only"}
                </button>
                <button onClick={sendEmailAndMarkSent} disabled={sendingEmail}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md">
                  {sendingEmail && <Loader2 className="w-4 h-4 animate-spin" />} {t("quotes.send_email_btn") || "Send Email & Mark Sent"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-700">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">{t("quotes.new_quote")}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                {/* WHO IS THIS FOR — required context */}
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> {t("quotes.who_for")} *
                  </p>
                  <div className="flex gap-2 mb-3">
                    {(["lead", "client"] as const).map(type => (
                      <button key={type} onClick={() => setForm(f => ({ ...f, linked_to: type, lead_id: "", client_id: "" }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${form.linked_to === type ? "bg-amber-500 text-white shadow" : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:border-amber-400"}`}>
                        {type === "lead" ? t("quotes.lead_option") : t("quotes.client_option")}
                      </button>
                    ))}
                  </div>
                  {form.linked_to === "lead" ? (
                    <select value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="">{t("quotes.select_lead")}...</option>
                      {leads.map(l => <option key={l.id} value={l.id}>{l.company_name}{l.email ? ` — ${l.email}` : ""}</option>)}
                    </select>
                  ) : (
                    <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="">{t("quotes.select_client")}...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || `Client #${c.id}`}</option>)}
                    </select>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("quotes.field_quote_title")} *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t("quotes.quote_title_placeholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("quotes.field_status")}</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("quotes.field_valid_until")}</label>
                    <input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("quotes.field_notes")}</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={t("quotes.notes_placeholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50 rounded-b-2xl">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-sm hover:bg-slate-100 transition-all">{t("quotes.cancel")}</button>
                <button onClick={handleSave} disabled={saving || !canSave()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t("quotes.create_quote")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
