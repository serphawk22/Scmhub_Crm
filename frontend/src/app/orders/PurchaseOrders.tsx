"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Plus, X, Search, Loader2, Trash2, Building2, Download, Mail, Eye } from "lucide-react";
import { ExportActions } from "@/components/ExportActions";
import { API_BASE_URL } from "@/config";

interface PO { id: number; po_number?: string; vendor_name: string; vendor_email?: string; status: string; grand_total: number; currency: string; expected_delivery?: string; created_at: string; }
const STATUSES = ["Draft", "Sent", "Received", "Cancelled"];
const STATUS_COLORS: Record<string, string> = { Draft: "bg-slate-100 text-slate-500", Sent: "bg-blue-500/10 text-blue-600", Received: "bg-emerald-500/10 text-emerald-600", Cancelled: "bg-red-500/10 text-red-500" };

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendor_name: "", vendor_email: "", status: "Draft", grand_total: "", currency: "USD", expected_delivery: "", notes: "" });
  const [emailModal, setEmailModal] = useState<{ orderId: number; poNumber: string; vendorEmail?: string; mode: "email" | "sent" } | null>(null);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailPrefilled, setEmailPrefilled] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [preview, setPreview] = useState<{ id: number; name: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const notify = (type: "ok" | "err", text: string) => { setToast({ type, text }); setTimeout(() => setToast(null), 3000); };

  const load = () => { setLoading(true); fetch(`${API_BASE_URL}/purchase-orders`).then(r => r.json()).then(d => setOrders(Array.isArray(d.orders) ? d.orders : [])).finally(() => setLoading(false)); };
  useEffect(load, []);

  const filtered = useMemo(() => orders.filter(o => {
    const s = search.toLowerCase();
    return (!s || o.vendor_name.toLowerCase().includes(s) || (o.po_number || "").toLowerCase().includes(s))
      && (statusFilter === "All" || o.status === statusFilter);
  }), [orders, search, statusFilter]);

  const handleSave = async () => {
    if (!form.vendor_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/purchase-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, grand_total: parseFloat(form.grand_total) || 0 }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify("err", err.detail || "Failed to create order");
        return;
      }
      setShowModal(false); load();
    } catch { notify("err", "Network error"); }
    finally { setSaving(false); }
  };
  const handleDelete = async (id: number) => { if (!confirm("Delete PO?")) return; await fetch(`${API_BASE_URL}/purchase-orders/${id}`, { method: "DELETE" }); load(); };
  const handleStatus = async (o: PO, status: string) => {
    if (status === "Sent") {
      setEmailModal({ orderId: o.id, poNumber: o.po_number || `PO-${o.id}`, vendorEmail: o.vendor_email, mode: "sent" });
      setEmailAddr(o.vendor_email || "");
      setEmailPrefilled(!!o.vendor_email);
      return;
    }
    await fetch(`${API_BASE_URL}/purchase-orders/${o.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...o, status }) });
    load();
  };

  const markStatus = async (id: number, status: string) => {
    const order = orders.find(x => x.id === id);
    if (!order) return;
    await fetch(`${API_BASE_URL}/purchase-orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...order, status }) });
    load();
  };

  const handleDownloadPdf = async (id: number, poNumber: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/purchase-orders/${id}/pdf`);
      if (!res.ok) { notify("err", "Download failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${poNumber || "purchase_order"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      notify("ok", "PDF downloaded");
    } catch { notify("err", "Network error"); }
  };

  const handlePreview = async (id: number, poNumber: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/purchase-orders/${id}/pdf`);
      if (!res.ok) { notify("err", "Preview failed"); setPreviewLoading(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      setPreview({ id, name: poNumber || `PO-${id}`, url });
    } catch { notify("err", "Network error"); }
    finally { setPreviewLoading(false); }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleSendEmail = async () => {
    if (!emailModal || !emailAddr.trim()) return;
    setSending(true);
    try {
      const { orderId, mode } = emailModal;
      const res = await fetch(`${API_BASE_URL}/purchase-orders/${orderId}/send-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddr.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { notify("err", d.detail || "Send failed"); return; }
      if (mode === "sent") await markStatus(orderId, "Sent");
      notify("ok", mode === "sent" ? `PDF sent to ${emailAddr.trim()} · marked as Sent` : `PDF sent to ${emailAddr.trim()}`);
      setEmailAddr("");
      setEmailModal(null);
    } catch { notify("err", "Network error"); }
    finally { setSending(false); }
  };

  const handleMarkSentOnly = async () => {
    if (!emailModal) return;
    setSending(true);
    try {
      await markStatus(emailModal.orderId, "Sent");
      notify("ok", "Marked as Sent");
      setEmailModal(null);
    } catch { notify("err", "Network error"); }
    finally { setSending(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/20"><Truck className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-black text-slate-800 dark:text-zinc-100">Purchase Orders</h1><p className="text-sm text-slate-500 dark:text-zinc-400">Track vendor orders and procurement</p></div>
        </div>
        <div className="flex items-center gap-3">
          <ExportActions
            downloadUrl={`${API_BASE_URL}/purchase-orders/export-pdf`}
            emailUrl={`${API_BASE_URL}/purchase-orders/export-pdf`}
            filename="purchase_orders.pdf"
            label="Purchase Orders"
          />
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-bold hover:opacity-90 shadow-md transition-all">
            <Plus className="w-4 h-4" /> New PO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total POs", value: orders.length, c: "text-teal-500" },
          { label: "Draft", value: orders.filter(o => o.status === "Draft").length, c: "text-slate-500" },
          { label: "Received", value: orders.filter(o => o.status === "Received").length, c: "text-emerald-500" },
          { label: "Total Spend", value: `$${orders.filter(o => o.status === "Received").reduce((s, o) => s + o.grand_total, 0).toFixed(0)}`, c: "text-cyan-500" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm">
            <p className="text-2xl font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : s.value}</p>
            <p className={`text-xs font-medium mt-0.5 ${s.c}`}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, PO#..." className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div className="flex gap-2">{["All", ...STATUSES].map(s => <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"}`}>{s}</button>)}</div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto_auto] gap-4 px-6 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
          {["PO #", "Vendor", "Amount", "Expected", "Status", "Actions", "Delete"].map(h => <p key={h} className="text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</p>)}
        </div>
        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-500 w-8 h-8" /></div>
          : filtered.length === 0 ? <div className="flex flex-col items-center justify-center py-20"><Truck className="w-10 h-10 text-slate-300 mb-3" /><p className="text-slate-500 font-bold">No purchase orders yet</p></div>
          : filtered.map((o, i) => (
          <motion.div key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="grid grid-cols-1 md:grid-cols-[auto_2fr_1fr_1fr_1fr_auto_auto] gap-3 md:gap-4 items-center px-6 py-4 border-b border-slate-100 dark:border-zinc-800 last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-800/40 group transition-colors">
            <span className="text-xs font-mono text-slate-400">{o.po_number}</span>
            <div><p className="text-sm font-bold text-slate-800 dark:text-zinc-100">{o.vendor_name}</p>{o.vendor_email && <p className="text-xs text-slate-400">{o.vendor_email}</p>}</div>
            <span className="text-sm font-black text-slate-800 dark:text-zinc-100">{o.currency} {o.grand_total.toFixed(2)}</span>
            <span className="text-xs text-slate-500">{o.expected_delivery || "—"}</span>
            <select value={o.status} onChange={e => handleStatus(o, e.target.value)} className={`text-xs font-bold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${STATUS_COLORS[o.status] || "bg-slate-100 text-slate-500"}`}>
              {!STATUSES.includes(o.status) && <option value={o.status}>{o.status}</option>}
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => handlePreview(o.id, o.po_number || `PO-${o.id}`)} disabled={previewLoading} title="Preview PDF" className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-all"><Eye className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDownloadPdf(o.id, o.po_number || `PO-${o.id}`)} title="Download PDF" className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all"><Download className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setEmailModal({ orderId: o.id, poNumber: o.po_number || `PO-${o.id}`, vendorEmail: o.vendor_email || "", mode: "email" }); setEmailAddr(o.vendor_email || ""); setEmailPrefilled(!!o.vendor_email); }} title="Email PDF" className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"><Mail className="w-3.5 h-3.5" /></button>
            </div>
            <button onClick={() => handleDelete(o.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-black text-slate-800 dark:text-zinc-100">New Purchase Order</h2><button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button></div>
              <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Vendor Name *</label>
                  <input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="e.g. Acme Supplies Ltd" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Vendor Email</label>
                  <input type="email" value={form.vendor_email} onChange={e => setForm(f => ({ ...f, vendor_email: e.target.value }))} placeholder="vendor@example.com" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Amount</label>
                    <input type="number" value={form.grand_total} onChange={e => setForm(f => ({ ...f, grand_total: e.target.value }))} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Expected Delivery</label>
                    <input type="date" value={form.expected_delivery} onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.vendor_name.trim()} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create PO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ height: "85vh" }}>
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-zinc-700">
                <h2 className="text-base font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2 truncate">
                  <Eye className="w-4 h-4 text-purple-500 shrink-0" /> {preview.name}
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleDownloadPdf(preview.id, preview.name)} title="Download PDF"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-all">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  <button onClick={closePreview} title="Close" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-all"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <iframe src={preview.url} className="flex-1 w-full border-0 bg-white" title="Purchase Order Preview" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Modal */}
      <AnimatePresence>
        {emailModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2"><Mail className="w-4 h-4 text-teal-600" /> {emailModal.mode === "sent" ? "Send Before Marking Sent" : "Email PDF"}</h2>
                <button onClick={() => setEmailModal(null)}><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-slate-500 mb-3">Send <span className="font-bold">{emailModal.poNumber}</span> as PDF attachment{emailModal.mode === "sent" ? " — the order will be marked as Sent." : ""}</p>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Recipient Email</label>
              <input type="email" autoFocus value={emailAddr} onChange={e => setEmailAddr(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendEmail()}
                placeholder="recipient@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              {emailPrefilled && emailAddr && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5">Vendor email pre-filled: <span className="font-bold">{emailAddr}</span> — edit if needed</p>
              )}
              <div className="flex gap-3 mt-5">
                <button onClick={() => setEmailModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
                {emailModal.mode === "sent" && (
                  <button onClick={handleMarkSentOnly} disabled={sending}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm disabled:opacity-50 transition-all">
                    Mark Sent Only
                  </button>
                )}
                <button onClick={handleSendEmail} disabled={!emailAddr.trim() || sending}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${emailModal.mode === "sent" ? "bg-teal-600 hover:bg-teal-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} {emailModal.mode === "sent" ? "Send & Mark Sent" : "Send"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
