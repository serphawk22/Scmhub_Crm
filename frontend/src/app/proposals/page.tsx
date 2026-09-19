"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, X, Loader2, FileSignature, CheckCircle, Send,
  Clock, XCircle, DollarSign, Trash2, Eye, Edit3, Download,
  PlayCircle, Search, ShoppingCart, Package, ChevronRight,
  User2, Building2, IndianRupee, BadgeDollarSign, Minus,
  AlertCircle, FileText, RefreshCw, ArrowLeft
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LineItem {
  product_id?: number;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  unit: string;
  currency: string;
}

interface Proposal {
  id: number;
  title: string;
  client_id?: number;
  lead_id?: number;
  recipient_type: string;
  client_name?: string;
  content?: string;
  line_items: LineItem[];
  currency: string;
  status: string;
  valid_until?: string;
  total_value?: number;
  signed_at?: string;
  creator_name?: string;
  created_at: string;
}

interface CatalogItem {
  id: number;
  name: string;
  code: string;
  description?: string;
  category: string;
  unit: string;
  photo_url?: string;
  unit_price: number;
  current_stock: number;
}

interface Client { id: number; companyName: string; projectName?: string; }
interface Lead   { id: number; company_name?: string; contact_name?: string; email?: string; }

// ─── Wizard Steps ───────────────────────────────────────────────────────────
type WizardStep = "recipient" | "cart" | "details";

// ─── Currency config ─────────────────────────────────────────────────────────
const INR_RATE  = 4.5; // 1 MXN ≈ 4.5 INR
const CURRENCIES = [
  { code: "MXN", label: "MXN (Peso)", symbol: "$",  icon: BadgeDollarSign },
  { code: "INR", label: "INR (₹)",    symbol: "₹", icon: IndianRupee },
];

function currSymbol(c: string) { return c === "INR" ? "₹" : "$"; }
function fmtMoney(val: number, curr: string) {
  return `${currSymbol(curr)}${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { icon: any; color: string; dot: string }> = {
  Draft:            { icon: Edit3,       color: "text-slate-500",   dot: "bg-slate-400" },
  Sent:             { icon: Send,        color: "text-blue-600",    dot: "bg-blue-500" },
  Accepted:         { icon: CheckCircle, color: "text-emerald-600", dot: "bg-emerald-500" },
  Rejected:         { icon: XCircle,     color: "text-red-500",     dot: "bg-red-500" },
  "Demo Requested": { icon: PlayCircle,  color: "text-violet-600",  dot: "bg-violet-500" },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProposalsPage() {
  const { t } = useLanguage();
  const { role, user } = useRole();
  const isClient = role === "Client";
  const clientId = user?.client_id;

  const [proposals, setProposals]       = useState<Proposal[]>([]);
  const [clients,   setClients]         = useState<Client[]>([]);
  const [leads,     setLeads]           = useState<Lead[]>([]);
  const [catalog,   setCatalog]         = useState<CatalogItem[]>([]);
  const [loading,   setLoading]         = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");

  // Wizard state
  const [showWizard, setShowWizard]     = useState(false);
  const [step, setStep]                 = useState<WizardStep>("recipient");
  const [saving, setSaving]             = useState(false);

  // Recipient step
  const [recipientType, setRecipientType] = useState<"client" | "lead">("client");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedLeadId, setSelectedLeadId]     = useState<number | null>(null);
  const [recipientSearch, setRecipientSearch]   = useState("");

  // Cart step
  const [cart, setCart]                 = useState<LineItem[]>([]);
  const [currency, setCurrency]         = useState("MXN");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("All");

  // Details step
  const [quoteTitle, setQuoteTitle]     = useState("");
  const [validUntil, setValidUntil]     = useState("");
  const [notes, setNotes]               = useState("");
  const [sendStatus, setSendStatus]     = useState<"Draft" | "Sent">("Draft");

  // Detail view
  const [selected, setSelected]         = useState<Proposal | null>(null);

  // PDF preview
  const [preview, setPreview]           = useState<{ id: number; name: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ─── Fetch ───────────────────────────────────────────────────────────────
  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const url = isClient && clientId
        ? `${API_BASE_URL}/proposals?client_id=${clientId}`
        : `${API_BASE_URL}/proposals`;
      const res = await fetch(url);
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [isClient, clientId]);

  useEffect(() => {
    fetchProposals();
    if (!isClient) {
      // Parallel fetch clients + leads for the wizard
      Promise.all([
        fetch(`${API_BASE_URL}/clients?per_page=500`).then(r => r.json()),
        fetch(`${API_BASE_URL}/leads`).then(r => r.json()),
        fetch(`${API_BASE_URL}/proposals/catalog`).then(r => r.json()),
      ]).then(([c, l, cat]) => {
        setClients(c.clients || []);
        setLeads(l.leads || []);
        setCatalog(cat.items || []);
      }).catch(console.error);
    }
  }, [fetchProposals, isClient]);

  // ─── Wizard helpers ───────────────────────────────────────────────────────
  function openWizard() {
    setStep("recipient");
    setRecipientType("client");
    setSelectedClientId(null);
    setSelectedLeadId(null);
    setRecipientSearch("");
    setCart([]);
    setCurrency("MXN");
    setCatalogSearch("");
    setCatalogCategory("All");
    setQuoteTitle("");
    setValidUntil("");
    setNotes("");
    setSendStatus("Draft");
    setShowWizard(true);
  }

  function recipientName() {
    if (recipientType === "client") {
      const c = clients.find(c => c.id === selectedClientId);
      return c?.companyName || "";
    }
    const l = leads.find(l => l.id === selectedLeadId);
    return l?.company_name || l?.contact_name || "";
  }

  const cartTotal = useMemo(() => {
    const mxn = cart.reduce((s, li) => s + li.quantity * li.unit_price, 0);
    return currency === "INR" ? mxn * INR_RATE : mxn;
  }, [cart, currency]);

  function addToCart(item: CatalogItem) {
    setCart(prev => {
      const existing = prev.findIndex(c => c.product_id === item.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, {
        product_id: item.id,
        product_name: item.name,
        description: item.description,
        quantity: 1,
        unit_price: currency === "INR" ? item.unit_price * INR_RATE : item.unit_price,
        unit: item.unit,
        currency,
      }];
    });
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  function updateCartQty(idx: number, qty: number) {
    if (qty <= 0) { removeFromCart(idx); return; }
    setCart(prev => prev.map((li, i) => i === idx ? { ...li, quantity: qty } : li));
  }

  function updateCartPrice(idx: number, price: number) {
    setCart(prev => prev.map((li, i) => i === idx ? { ...li, unit_price: price } : li));
  }

  // When currency switches, convert prices in cart
  function switchCurrency(newCurr: string) {
    if (newCurr === currency) return;
    setCurrency(newCurr);
    setCart(prev => prev.map(li => ({
      ...li,
      currency: newCurr,
      unit_price: newCurr === "INR"
        ? li.unit_price * INR_RATE
        : li.unit_price / INR_RATE,
    })));
  }

  async function submitQuote() {
    setSaving(true);
    const totalMXN = currency === "INR" ? cartTotal / INR_RATE : cartTotal;
    const autoTitle = quoteTitle.trim() ||
      `Quotation for ${recipientName()} – ${new Date().toLocaleDateString("en-IN")}`;
    try {
      await fetch(`${API_BASE_URL}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: autoTitle,
          client_id: recipientType === "client" ? selectedClientId : null,
          lead_id: recipientType === "lead" ? selectedLeadId : null,
          recipient_type: recipientType,
          content: notes || null,
          status: sendStatus,
          valid_until: validUntil || null,
          total_value: totalMXN,
          line_items: cart,
          currency,
        }),
      });
      setShowWizard(false);
      fetchProposals();
    } finally { setSaving(false); }
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`${API_BASE_URL}/proposals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s);
  }

  async function deleteProposal(id: number) {
    if (!confirm(t("proposals.confirm_delete"))) return;
    await fetch(`${API_BASE_URL}/proposals/${id}`, { method: "DELETE" });
    setProposals(prev => prev.filter(p => p.id !== id));
    setSelected(null);
  }

  function downloadPDF(id: number) {
    const uid = user?.id ? `?user_id=${user.id}` : "";
    window.open(`${API_BASE_URL}/proposals/${id}/pdf${uid}`, "_blank");
  }

  function previewPDF(id: number) {
    const uid = user?.id ? `?user_id=${user.id}` : "";
    const p = proposals.find(x => x.id === id);
    setPreviewLoading(true);
    fetch(`${API_BASE_URL}/proposals/${id}/pdf${uid}`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.blob(); })
      .then(blob => setPreview({ id, name: p?.title || `Q-${String(id).padStart(4, "0")}`, url: URL.createObjectURL(new Blob([blob], { type: "application/pdf" })) }))
      .catch(() => alert(t("proposals.pdf_error")))
      .finally(() => setPreviewLoading(false));
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const filtered = filterStatus === "All" ? proposals : proposals.filter(p => p.status === filterStatus);

  const catalogCategories = ["All", ...Array.from(new Set(catalog.map(i => i.category)))];
  const filteredCatalog = catalog.filter(item => {
    const matchCat = catalogCategory === "All" || item.category === catalogCategory;
    const matchQ   = !catalogSearch || item.name.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchCat && matchQ;
  });

  const filteredRecipients = recipientType === "client"
    ? clients.filter(c => !recipientSearch || c.companyName.toLowerCase().includes(recipientSearch.toLowerCase()))
    : leads.filter(l => {
        const name = (l.company_name || l.contact_name || "").toLowerCase();
        return !recipientSearch || name.includes(recipientSearch.toLowerCase());
      });

  const stats = {
    total:    proposals.length,
    accepted: proposals.filter(p => p.status === "Accepted").length,
    sent:     proposals.filter(p => p.status === "Sent").length,
    value:    proposals.filter(p => p.status === "Accepted")
                .reduce((s, p) => s + (p.total_value || 0), 0),
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-black min-h-screen">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t("proposals.page_title")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t("proposals.page_subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchProposals}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            {!isClient && (
              <button id="create-quotation-btn" onClick={openWizard}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all hover:shadow-md active:scale-95">
                <Plus className="w-4 h-4" /> {t("proposals.create_quotation")}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            { label: t("proposals.stat_total"),    value: stats.total,    color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
            { label: t("proposals.stat_sent"),     value: stats.sent,     color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
            { label: t("proposals.stat_accepted"), value: stats.accepted, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: t("proposals.stat_won_value"),value: `$${(stats.value/1000).toFixed(1)}k`, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${s.bg}`}>
              <p className={`text-xl font-black ${s.color}`}>{loading ? "—" : s.value}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FILTER BAR ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 px-6 py-3 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {["All", "Draft", "Sent", "Accepted", "Rejected", "Demo Requested"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterStatus === s
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* ── LIST ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileSignature className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">{t("proposals.empty")}</p>
            {!isClient && (
              <button onClick={openWizard} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                {t("proposals.create_first")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => {
              const cfg = STATUS_CFG[p.status] || STATUS_CFG.Draft;
              const Icon = cfg.icon;
              const sym = currSymbol(p.currency || "MXN");
              return (
                <div key={p.id}
                  onClick={() => setSelected(p)}
                  className="bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                        Q-{String(p.id).padStart(4, "0")}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight truncate mt-0.5">
                        {p.title}
                      </h3>
                    </div>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${cfg.color} bg-slate-100 dark:bg-slate-800`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {p.status}
                    </span>
                  </div>

                  {p.client_name && (
                    <div className="flex items-center gap-1.5 mb-3">
                      {p.recipient_type === "lead"
                        ? <User2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        : <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                      <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {p.client_name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${
                        p.recipient_type === "lead"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        {p.recipient_type === "lead" ? "Lead" : "Client"}
                      </span>
                    </div>
                  )}

                  {p.line_items?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {p.line_items.slice(0, 2).map((li, i) => (
                        <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md">
                          {li.product_name} ×{li.quantity}
                        </span>
                      ))}
                      {p.line_items.length > 2 && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                          +{p.line_items.length - 2} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {p.total_value ? fmtMoney(p.total_value, p.currency || "MXN") : "—"}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); previewPDF(p.id); }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-500 hover:text-purple-600 dark:bg-slate-800 dark:hover:bg-purple-900/30 dark:text-slate-400 dark:hover:text-purple-400 transition-colors"
                        title={t("proposals.preview_pdf")}>
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); downloadPDF(p.id); }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 dark:bg-slate-800 dark:hover:bg-blue-900/30 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                        title={t("proposals.download_pdf")}>
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteProposal(p.id); }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 dark:bg-slate-800 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                        title={t("proposals.delete")}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {p.valid_until && (
                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {t("proposals.valid_until")} {p.valid_until}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DETAIL PANEL                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-mono text-slate-400">Q-{String(selected.id).padStart(4, "0")}</span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{selected.title}</h2>
                {selected.client_name && (
                  <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                    {selected.recipient_type === "lead"
                      ? <User2 className="w-3.5 h-3.5 text-amber-500" />
                      : <Building2 className="w-3.5 h-3.5 text-blue-500" />}
                    {selected.client_name}
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Status */}
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">{t("proposals.update_status")}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(STATUS_CFG).map(s => {
                    const cfg = STATUS_CFG[s];
                    const Icon = cfg.icon;
                    return (
                      <button key={s} onClick={() => updateStatus(selected.id, s)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                          selected.status === s
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-600"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}>
                        <Icon className="w-3.5 h-3.5" />{s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Line items */}
              {selected.line_items?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                    Items ({selected.currency || "MXN"})
                  </p>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 text-left">
                          <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-400 text-xs">{t("proposals.col_product")}</th>
                          <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-400 text-xs text-right">{t("proposals.col_qty")}</th>
                          <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-400 text-xs text-right">{t("proposals.col_unit_price")}</th>
                          <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-400 text-xs text-right">{t("proposals.col_total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.line_items.map((li, i) => (
                          <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2.5 text-slate-900 dark:text-white">{li.product_name}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{li.quantity} {li.unit}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtMoney(li.unit_price, selected.currency)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-slate-900 dark:text-white">{fmtMoney(li.quantity * li.unit_price, selected.currency)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                          <td colSpan={3} className="px-3 py-2.5 font-bold text-slate-900 dark:text-white text-right">{t("proposals.total")}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-blue-600 text-base">
                            {fmtMoney(selected.total_value || 0, selected.currency)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selected.content && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">{t("proposals.notes")}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 rounded-xl p-3">{selected.content}</p>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t("proposals.meta_valid_until"),  value: selected.valid_until || "—" },
                  { label: t("proposals.meta_currency"),     value: selected.currency || "MXN" },
                  { label: t("proposals.meta_created"),      value: new Date(selected.created_at).toLocaleDateString("en-IN") },
                  { label: t("proposals.meta_creator"),      value: selected.creator_name || "—" },
                ].map(m => (
                  <div key={m.label} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{m.label}</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Digital Signature Block */}
              <div className="mt-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center">
                {selected.signed_at ? (
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <FileSignature className="w-6 h-6" />
                    </div>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-serif italic">{t("proposals.digitally_signed")}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                      Signed on {new Date(selected.signed_at).toLocaleString("en-IN")}
                    </p>
                    {selected.signed_by_ip && (
                      <p className="text-[10px] text-slate-400">IP: {selected.signed_by_ip}</p>
                    )}
                  </div>
                ) : isClient ? (
                  <div className="text-center space-y-4 w-full">
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{t("proposals.ready_to_sign")}</p>
                    <button onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE_URL}/proposals/${selected.id}/sign`, { method: "POST" });
                        if (res.ok) {
                          const updated = await res.json();
                          setSelected(updated);
                          fetchProposals();
                        }
                      } catch (e) { console.error(e); }
                    }} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-md hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                      <FileSignature className="w-5 h-5" />
                      {t("proposals.approve_sign")}
                    </button>
                    <p className="text-[10px] text-slate-400">{t("proposals.by_signing")}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <FileSignature className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-500">{t("proposals.awaiting_signature")}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => previewPDF(selected.id)}
                  className="px-4 py-2.5 bg-purple-50 text-purple-600 rounded-xl font-semibold text-sm hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => downloadPDF(selected.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                  <Download className="w-4 h-4" /> {t("proposals.download_pdf")}
                </button>
                <button onClick={() => deleteProposal(selected.id)}
                  className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PDF PREVIEW                                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d0d0d] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ height: "85vh" }}>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2 truncate">
                <Eye className="w-4 h-4 text-purple-500 shrink-0" /> {preview.name}
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                {previewLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                <button
                  onClick={() => downloadPDF(preview.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all"
                  title={t("proposals.download_pdf")}>
                  <Download className="w-3.5 h-3.5" /> {t("proposals.download_pdf")}
                </button>
                <button
                  onClick={closePreview}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <iframe src={preview.url} className="flex-1 w-full border-0 bg-white" title="Quotation Preview" />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* QUOTATION WIZARD                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d0d0d] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">

            {/* Wizard Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4">
                {step !== "recipient" && (
                  <button onClick={() => setStep(step === "cart" ? "recipient" : "cart")}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{t("proposals.wizard_new")}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(["recipient", "cart", "details"] as WizardStep[]).map((s, i) => (
                      <div key={s} className="flex items-center gap-1.5">
                        {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                        <span className={`text-xs font-medium ${step === s ? "text-blue-600" : step > s ? "text-emerald-500" : "text-slate-400"}`}>
                          {s === "recipient" ? t("proposals.wizard_step_recipient") : s === "cart" ? t("proposals.wizard_step_products") : t("proposals.wizard_step_details")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowWizard(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* ── STEP 1: RECIPIENT ────────────────────────────────────── */}
            {step === "recipient" && (
              <div className="flex-1 overflow-y-auto p-6">
                <p className="text-sm text-slate-500 mb-5">{t("proposals.wizard_who_for")}</p>

                {/* Type toggle */}
                <div className="flex gap-3 mb-5">
                  {([
                    { type: "client", label: "Client", icon: Building2 },
                    { type: "lead",   label: "Lead",   icon: User2 },
                  ] as const).map(t => (
                    <button key={t.type} onClick={() => { setRecipientType(t.type); setSelectedClientId(null); setSelectedLeadId(null); setRecipientSearch(""); }}
                      className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                        recipientType === t.type
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                      }`}>
                      <t.icon className={`w-6 h-6 ${recipientType === t.type ? "text-blue-600" : "text-slate-400"}`} />
                      <span className={`text-sm font-semibold ${recipientType === t.type ? "text-blue-700 dark:text-blue-400" : "text-slate-600 dark:text-slate-300"}`}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    placeholder={`${t("proposals.wizard_search")} ${recipientType === "client" ? t("proposals.wizard_clients") : t("proposals.wizard_leads")}…`}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                </div>

                {/* List */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredRecipients.slice(0, 50).map((r: any) => {
                    const id   = r.id;
                    const name = r.companyName || r.company_name || r.contact_name || "—";
                    const isSelected = recipientType === "client"
                      ? selectedClientId === id
                      : selectedLeadId === id;
                    return (
                      <button key={id}
                        onClick={() => recipientType === "client" ? setSelectedClientId(id) : setSelectedLeadId(id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#111]"
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                          isSelected ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{name}</p>
                          {r.email && <p className="text-xs text-slate-400 truncate">{r.email}</p>}
                        </div>
                        {isSelected && <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredRecipients.length === 0 && (
                    <p className="text-center text-slate-400 py-8 text-sm">{t("proposals.wizard_no_results")}</p>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    disabled={recipientType === "client" ? !selectedClientId : !selectedLeadId}
                    onClick={() => setStep("cart")}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {t("proposals.wizard_continue_products")}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: CART ─────────────────────────────────────────── */}
            {step === "cart" && (
              <div className="flex-1 overflow-hidden flex">
                {/* Left: Catalog */}
                <div className="flex-1 overflow-y-auto p-5 border-r border-slate-200 dark:border-slate-800">
                  {/* Currency Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("proposals.wizard_catalog")}</p>
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      {CURRENCIES.map(c => (
                        <button key={c.code} onClick={() => switchCurrency(c.code)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            currency === c.code
                              ? "bg-white dark:bg-slate-700 shadow text-blue-700 dark:text-blue-400"
                              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          }`}>
                          <c.icon className="w-3.5 h-3.5" />{c.code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search & Category */}
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                        placeholder={t("proposals.wizard_search_products")}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                    </div>
                    <select value={catalogCategory} onChange={e => setCatalogCategory(e.target.value)}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none">
                      {catalogCategories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Product grid */}
                  {filteredCatalog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                      <Package className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-sm">{t("proposals.wizard_no_products")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredCatalog.map(item => {
                        const inCart = cart.find(c => c.product_id === item.id);
                        const price  = currency === "INR" ? item.unit_price * INR_RATE : item.unit_price;
                        return (
                          <button key={item.id} onClick={() => addToCart(item)}
                            className={`text-left p-3 rounded-xl border transition-all hover:shadow-md relative overflow-hidden ${
                              inCart
                                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                : "border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111] hover:border-blue-200"
                            }`}>
                            {inCart && (
                              <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                ×{inCart.quantity}
                              </span>
                            )}
                            {item.photo_url ? (
                              <img src={item.photo_url.startsWith('/') ? `${API_BASE_URL}${item.photo_url}` : item.photo_url} alt={item.name}
                                className="w-full h-20 object-cover rounded-lg mb-2 bg-slate-100" />
                            ) : (
                              <div className="w-full h-20 bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-300" />
                              </div>
                            )}
                            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400 mb-1 truncate">{item.category}</p>
                            <p className="text-xs font-bold text-blue-600">
                              {price > 0 ? `${currSymbol(currency)}${price.toFixed(2)}` : "—"}<span className="font-normal text-slate-400">/{item.unit}</span>
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: Cart */}
                <div className="w-72 flex flex-col bg-slate-50 dark:bg-[#0a0a0a]">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("proposals.wizard_cart")} ({cart.length})</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                        <ShoppingCart className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-xs text-center">{t("proposals.wizard_click_to_add")}</p>
                      </div>
                    ) : cart.map((li, idx) => (
                      <div key={idx} className="bg-white dark:bg-[#111] rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight flex-1">{li.product_name}</p>
                          <button onClick={() => removeFromCart(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <button onClick={() => updateCartQty(idx, li.quantity - 1)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <Minus className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                          </button>
                          <span className="text-sm font-bold text-slate-900 dark:text-white w-6 text-center">{li.quantity}</span>
                          <button onClick={() => updateCartQty(idx, li.quantity + 1)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <Plus className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                          </button>
                          <span className="text-[10px] text-slate-400">{li.unit}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">{currSymbol(currency)}</span>
                          <input type="number" value={li.unit_price} min={0} step={0.01}
                            onChange={e => updateCartPrice(idx, parseFloat(e.target.value) || 0)}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <p className="text-xs font-bold text-blue-600 mt-1.5 text-right">
                          {fmtMoney(li.quantity * li.unit_price, currency)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Cart total */}
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-slate-500">{t("proposals.wizard_total")}</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">{fmtMoney(cartTotal, currency)}</p>
                    </div>
                    <button disabled={cart.length === 0} onClick={() => setStep("details")}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {t("proposals.wizard_continue_details")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: DETAILS ──────────────────────────────────────── */}
            {step === "details" && (
              <div className="flex-1 overflow-y-auto p-6 max-w-xl mx-auto w-full">
                <p className="text-sm text-slate-500 mb-6">{t("proposals.wizard_final_details")}</p>

                {/* Summary card */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {recipientType === "lead"
                        ? <User2 className="w-4 h-4 text-amber-500" />
                        : <Building2 className="w-4 h-4 text-blue-500" />}
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{recipientName()}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full font-medium">
                      {recipientType === "lead" ? "Lead" : "Client"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{cart.length} product{cart.length !== 1 ? "s" : ""} · {currency}</p>
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1">{fmtMoney(cartTotal, currency)}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      {t("proposals.wizard_quotation_title")}
                    </label>
                    <input value={quoteTitle} onChange={e => setQuoteTitle(e.target.value)}
                      placeholder={`${t("proposals.wizard_quotation_for")} ${recipientName()}`}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      {t("proposals.wizard_valid_until")}
                    </label>
                    <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      {t("proposals.wizard_notes")}
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      rows={4} placeholder={t("proposals.wizard_notes_placeholder")}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  {/* Save as Draft or Send */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      {t("proposals.wizard_save_as")}
                    </label>
                    <div className="flex gap-2">
                      {(["Draft", "Sent"] as const).map(s => (
                        <button key={s} onClick={() => setSendStatus(s)}
                          className={`flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all ${
                            sendStatus === s
                              ? s === "Sent"
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-400 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                              : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                          }`}>
                          {s === "Draft" ? t("proposals.wizard_save_draft") : `Send to ${recipientName() || "Client"}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep("cart")}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    {t("proposals.wizard_back")}
                  </button>
                  <button onClick={submitQuote} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("proposals.wizard_saving")}…</>
                      : <><FileText className="w-4 h-4" /> {sendStatus === "Draft" ? t("proposals.wizard_save_quotation") : t("proposals.wizard_create_send")}</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
