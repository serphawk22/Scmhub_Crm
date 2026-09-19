"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, X, Search, Loader2, Trash2, Building2,
  Download, Eye, CheckCircle
} from "lucide-react";
import { API_BASE_URL } from "@/config";

// ─── Types ────────────────────────────────────────────────────────────────────
interface InvoiceLineItem {
  description: string;
  amount: number;
  provider?: string;
}
interface Invoice {
  id: number;
  invoice_number: string;
  client_id?: number;
  client_name?: string;
  client_email?: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  due_date?: string;
  notes?: string;
  line_items: InvoiceLineItem[];
  paid_at?: string;
  created_at: string;
  updated_at: string;
}
interface Client {
  id: number;
  companyName?: string;
  userId?: number;
}

const STATUSES = ["Draft", "Sent", "Paid", "Overdue", "Partial", "Cancelled"];
const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400",
  Sent: "bg-blue-500/10 text-blue-600",
  Paid: "bg-emerald-500/10 text-emerald-600",
  Overdue: "bg-red-500/10 text-red-500",
  Partial: "bg-amber-500/10 text-amber-600",
  Cancelled: "bg-slate-100 text-slate-400",
};

function currSymbol(c: string) { return c === "INR" ? "₹" : "$"; }
function fmtMoney(v: number, c: string) {
  return `${currSymbol(c)}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Invoices({ embedded = false }: { embedded?: boolean }) {
  // List state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [downloading, setDownloading] = useState<Invoice | null>(null);

  // Preview state
  const [previewInv, setPreviewInv] = useState<Invoice | null>(null);

  // Form
  const [form, setForm] = useState({
    client_id: "" as string | number,
    amount: "",
    tax: "",
    currency: "MXN",
    due_date: "",
    notes: "",
  });
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { description: "", amount: 0, provider: "Internal" },
  ]);

  // Dropdown data
  const [clients, setClients] = useState<Client[]>([]);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadInvoices = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/invoices`)
      .then(r => r.json())
      .then(d => setInvoices(Array.isArray(d.invoices) ? d.invoices : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadInvoices, []);

  const filtered = invoices.filter(inv => {
    if (statusFilter !== "All" && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (inv.invoice_number || "").toLowerCase().includes(q) ||
        (inv.client_name || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Actions ──────────────────────────────────────────────────────────────
  function handleDelete(id: number) {
    if (!confirm("Delete this invoice?")) return;
    fetch(`${API_BASE_URL}/invoices/${id}`, { method: "DELETE" })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(() => { setInvoices(prev => prev.filter(i => i.id !== id)); setToast({ ok: true, msg: "Invoice deleted" }); })
      .catch(() => setToast({ ok: false, msg: "Failed to delete" }));
  }

  function handleStatus(inv: Invoice, newStatus: string) {
    fetch(`${API_BASE_URL}/invoices/${inv.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...d.invoice } : i));
        setToast({ ok: true, msg: `Status → ${newStatus}` });
      })
      .catch(() => setToast({ ok: false, msg: "Failed to update status" }));
  }

  function handleDownloadPDF(inv: Invoice) {
    setDownloading(null);
    fetch(`${API_BASE_URL}/invoices/${inv.id}/pdf`)
      .then(res => {
        if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${inv.invoice_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(err => console.error(err));
  }

  // ── Create ───────────────────────────────────────────────────────────────
  function openCreate() {
    setForm({ client_id: "", amount: "", tax: "", currency: "MXN", due_date: "", notes: "" });
    setLineItems([{ description: "", amount: 0, provider: "Internal" }]);
    setError(null);
    fetch(`${API_BASE_URL}/clients`).then(r => r.json()).then(d => {
      setClients(Array.isArray(d.clients) ? d.clients : []);
    }).catch(() => {});
    setShowCreate(true);
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { description: "", amount: 0, provider: "Internal" }]);
  }

  function removeLineItem(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  function handleCreate() {
    if (!form.client_id) { setError("Client is required"); return; }
    if (lineItems.length === 0 || !lineItems.some(li => li.description)) { setError("Add at least one line item"); return; }

    setSaving(true);
    setError(null);
    const amount = lineItems.reduce((s, li) => s + (li.amount || 0), 0);
    const tax = parseFloat(form.tax) || 0;

    fetch(`${API_BASE_URL}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Number(form.client_id),
        amount,
        tax,
        currency: form.currency,
        due_date: form.due_date || null,
        notes: form.notes || null,
        line_items: lineItems.filter(li => li.description),
      }),
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        setInvoices(prev => [d.invoice, ...prev]);
        setShowCreate(false);
        setToast({ ok: true, msg: "Invoice created" });
      })
      .catch(() => setError("Failed to create invoice"))
      .finally(() => setSaving(false));
  }

  // ── Compute totals from line items ───────────────────────────────────────
  const computedAmount = lineItems.reduce((s, li) => s + (li.amount || 0), 0);
  const computedTax = parseFloat(form.tax) || 0;
  const computedTotal = computedAmount + computedTax;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={embedded ? "space-y-5" : "min-h-screen bg-[#f8fafc] dark:bg-zinc-950 p-4 md:p-6 space-y-5"}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
            onClick={() => setToast(null)}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {!embedded && (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">Invoices</h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Track and manage client invoices</p>
            </div>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 shadow-md transition-all active:scale-95">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: invoices.length, c: "text-blue-600" },
          { label: "Pending", value: invoices.filter(i => ["Draft", "Sent"].includes(i.status)).length, c: "text-amber-600" },
          { label: "Paid", value: invoices.filter(i => i.status === "Paid").length, c: "text-emerald-600" },
          { label: "Total Value", value: `$${filtered.reduce((s, i) => s + (i.total || 0), 0).toFixed(0)}`, c: "text-indigo-600" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm">
            <p className={`text-2xl font-black ${s.c}`}>{loading ? "—" : s.value}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["All", ...STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? "bg-blue-500 text-white shadow" : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[auto_1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
          {["#", "Client", "Amount", "Tax", "Total", "Status", ""].map(h => (
            <p key={h} className="text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</p>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-500 font-bold">No invoices yet</p>
            <button onClick={openCreate} className="mt-3 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-all">
              Create first invoice
            </button>
          </div>
        ) : filtered.map((inv, i) => (
          <motion.div key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="grid grid-cols-1 md:grid-cols-[auto_1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 items-center px-6 py-4 border-b border-slate-100 dark:border-zinc-800 last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-800/40 group transition-colors cursor-pointer"
            onClick={() => setPreviewInv(inv)}>
            <span className="text-xs font-mono text-slate-400">{inv.invoice_number}</span>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-600 dark:text-zinc-300 truncate">
                {inv.client_name || <span className="text-slate-400 italic">No client</span>}
              </span>
            </div>
            <span className="text-sm font-black text-slate-800 dark:text-zinc-100">{fmtMoney(inv.amount, inv.currency || "MXN")}</span>
            <span className="text-sm text-slate-600 dark:text-zinc-300">{fmtMoney(inv.tax, inv.currency || "MXN")}</span>
            <span className="text-sm font-black text-slate-800 dark:text-zinc-100">{fmtMoney(inv.total, inv.currency || "MXN")}</span>
            <select value={inv.status} onClick={e => e.stopPropagation()}
              onChange={e => handleStatus(inv, e.target.value)}
              className={`text-xs font-bold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${STATUS_COLORS[inv.status] || STATUS_COLORS.Draft}`}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={e => { e.stopPropagation(); setPreviewInv(inv); }} title="Preview Invoice"
                className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={e => { e.stopPropagation(); handleDownloadPDF(inv); }} title="Download PDF"
                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                <Download className="w-3.5 h-3.5" />
              </button>
              <button onClick={e => { e.stopPropagation(); handleDelete(inv.id); }} title="Delete Invoice"
                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CREATE INVOICE MODAL                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
            <motion.div initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-700">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">New Invoice</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Client *</label>
                    <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
                      <option value="">Select client…</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || `Client #${c.id}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Currency</label>
                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
                      <option value="MXN">MXN ($)</option>
                      <option value="USD">USD ($)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Due Date</label>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Tax</label>
                    <input type="number" step="0.01" value={form.tax} onChange={e => setForm(f => ({ ...f, tax: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Optional notes…"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" />
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-500">Line Items</label>
                    <button onClick={addLineItem} className="text-xs text-blue-500 hover:text-blue-600 font-semibold">+ Add Item</button>
                  </div>
                  <div className="space-y-2">
                    {lineItems.map((li, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <input value={li.description} onChange={e => {
                          const next = [...lineItems]; next[idx] = { ...next[idx], description: e.target.value }; setLineItems(next);
                        }} placeholder="Description" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" />
                        <input type="number" step="0.01" value={li.amount || ""} onChange={e => {
                          const next = [...lineItems]; next[idx] = { ...next[idx], amount: parseFloat(e.target.value) || 0 }; setLineItems(next);
                        }} placeholder="Amount" className="w-28 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-right" />
                        <input value={li.provider || ""} onChange={e => {
                          const next = [...lineItems]; next[idx] = { ...next[idx], provider: e.target.value }; setLineItems(next);
                        }} placeholder="Provider" className="w-28 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" />
                        {lineItems.length > 1 && (
                          <button onClick={() => removeLineItem(idx)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 flex flex-col gap-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{fmtMoney(computedAmount, form.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="font-semibold">{fmtMoney(computedTax, form.currency)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-zinc-700 pt-1 mt-1">
                    <span className="font-bold text-slate-800 dark:text-zinc-100">Total</span>
                    <span className="font-black text-blue-600">{fmtMoney(computedTotal, form.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-zinc-700">
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 shadow-md transition-all active:scale-95 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Create Invoice
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PREVIEW MODAL                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {previewInv && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setPreviewInv(null); }}>
            <motion.div initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-700">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">{previewInv.invoice_number}</h2>
                  <p className="text-sm text-slate-500">{previewInv.client_name || "No client"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleDownloadPDF(previewInv)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-all">
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                  <select value={previewInv.status} onChange={e => {
                    handleStatus(previewInv, e.target.value);
                    setPreviewInv({ ...previewInv, status: e.target.value });
                  }} className={`text-xs font-bold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${STATUS_COLORS[previewInv.status] || STATUS_COLORS.Draft}`}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setPreviewInv(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="text-lg font-black text-slate-800 dark:text-zinc-100">{fmtMoney(previewInv.amount, previewInv.currency || "MXN")}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">Tax</p>
                    <p className="text-lg font-black text-slate-800 dark:text-zinc-100">{fmtMoney(previewInv.tax, previewInv.currency || "MXN")}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                    <p className="text-xs text-blue-600">Total</p>
                    <p className="text-lg font-black text-blue-600">{fmtMoney(previewInv.total, previewInv.currency || "MXN")}</p>
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Line Items</p>
                  <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 px-4 py-2 bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Description</span><span className="text-right">Provider</span><span className="text-right">Amount</span>
                    </div>
                    {(previewInv.line_items || []).map((li, idx) => (
                      <div key={idx} className="grid grid-cols-[2fr_1fr_1fr] gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-zinc-800 text-sm">
                        <span className="text-slate-700 dark:text-zinc-200">{li.description}</span>
                        <span className="text-right text-slate-500">{li.provider || "—"}</span>
                        <span className="text-right font-semibold">{fmtMoney(li.amount, previewInv.currency || "MXN")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meta */}
                {previewInv.notes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Notes</p>
                    <p className="text-sm text-slate-600 dark:text-zinc-300">{previewInv.notes}</p>
                  </div>
                )}
                <div className="flex gap-6 text-xs text-slate-500">
                  <span>Due: {previewInv.due_date || "—"}</span>
                  <span>Created: {new Date(previewInv.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
