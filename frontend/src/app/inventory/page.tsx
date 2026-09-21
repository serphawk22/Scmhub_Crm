"use client";
import { API_BASE_URL } from "@/config";
import React, { useState, useEffect, useRef } from "react";
import { ExportActions } from "@/components/ExportActions";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Search, Trash2, Edit2, X, ChevronDown, ChevronUp,
  Loader2, Tag, Building2, DollarSign, Clock, ShoppingCart, Send,
  CheckCircle, AlertTriangle, Upload, Star, StarOff, MoreHorizontal
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Supplier {
  id: number;
  supplier_name: string;
  supplier_brand?: string;
  supplier_email?: string;
  lot_number?: string;
  unit_cost?: number;
  currency: string;
  lead_time_days?: number;
  min_order_qty?: number;
  is_preferred: boolean;
  notes?: string;
  supplier_user_id?: number | null;
  credentials_ready?: boolean;
  credentials_sent?: boolean;
}

interface InventoryItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  photo_url?: string;
  unit?: string;
  min_stock: number;
  current_stock: number;
  created_at: string;
  suppliers: Supplier[];
}

const emptyItem = {
  code: "", name: "", description: "", category: "",
  tags: [] as string[], photo_url: "", unit: "", min_stock: 0, current_stock: 0
};
const emptySupplier = {
  supplier_name: "", supplier_brand: "", supplier_email: "", lot_number: "",
  unit_cost: 0, currency: "USD", lead_time_days: 0, min_order_qty: 0,
  is_preferred: false, notes: ""
};

const CATEGORIES = ["Electronics", "Raw Materials", "Packaging", "Tools", "Office Supplies", "Chemical", "Food & Beverage", "Textile", "Machinery", "Other"];
const UNITS = ["pcs", "kg", "g", "L", "mL", "m", "cm", "box", "pack", "pair", "roll", "set"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD"];

export default function InventoryPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"items" | "suppliers">("items");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState<{ itemId: number } | null>(null);
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [showRFQModal, setShowRFQModal] = useState<{ item: InventoryItem } | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({ ...emptyItem });
  const [supplierForm, setSupplierForm] = useState({ ...emptySupplier });
  const [rfqForm, setRfqForm] = useState({ supplier_name: "", supplier_email: "", quantity: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [newCredentials, setNewCredentials] = useState<{ supplier_id: number; email: string; password: string; name: string } | null>(null);
  const [sendingCreds, setSendingCreds] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dropdownSuppliers = Array.from(new Map(
    items.flatMap(i => i.suppliers).map(s => [s.supplier_name, s])
  ).values());

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("Image must be under 10 MB", "err");
      if (e.target) e.target.value = "";
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.file_url) {
        setItemForm(f => ({ ...f, photo_url: data.file_url }));
        showToast(t("inventory.toast_photo_uploaded"), "ok");
      } else {
        showToast(data.detail || t("inventory.toast_upload_failed"), "err");
      }
    } catch {
      showToast(t("inventory.toast_network_error"), "err");
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = "";
    }
  };

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
      || (item.category || "").toLowerCase().includes(q) || item.tags.some(tag => tag.toLowerCase().includes(q));
    const matchCat = categoryFilter === "All" || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const openCreate = () => {
    setEditItem(null);
    setItemForm({ ...emptyItem });
    setTagInput("");
    setShowItemModal(true);
  };

  const openEdit = (item: InventoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditItem(item);
    setItemForm({
      code: item.code, name: item.name, description: item.description || "",
      category: item.category || "", tags: item.tags || [], photo_url: item.photo_url || "",
      unit: item.unit || "", min_stock: item.min_stock, current_stock: item.current_stock
    });
    setTagInput("");
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.code.trim()) return;
    setSaving(true);
    try {
      const url = editItem ? `${API_BASE_URL}/inventory/${editItem.id}` : `${API_BASE_URL}/inventory`;
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm)
      });
      if (res.ok) {
        setShowItemModal(false);
        fetchItems();
        showToast(editItem ? t("inventory.toast_item_updated") : t("inventory.toast_item_created"));
      }
    } finally { setSaving(false); }
  };

  const handleDeleteItem = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("inventory.confirm_delete_item"))) return;
    await fetch(`${API_BASE_URL}/inventory/${id}`, { method: "DELETE" });
    fetchItems();
    showToast(t("inventory.toast_deleted"));
  };

  const handleAddSupplier = async () => {
    if (!showSupplierModal || !supplierForm.supplier_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/${showSupplierModal.itemId}/suppliers`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Failed to add supplier", "err");
        return;
      }
      setShowSupplierModal(null);
      setIsNewSupplier(false);
      setSupplierForm({ ...emptySupplier });
      await fetchItems();
      if (data.credentials_created && data.login_email) {
        setNewCredentials({ supplier_id: data.id, email: data.login_email, password: data.login_password, name: supplierForm.supplier_name });
      } else {
        // No email → show popup with message to add email for portal access
        setNewCredentials({ supplier_id: data.id, email: "", password: "", name: supplierForm.supplier_name });
      }
    } catch {
      showToast("Network error — please try again", "err");
    } finally { setSaving(false); }
  };

  const handleSendCredentials = async (supplierId: number, supplierName: string) => {
    setSendingCreds(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/suppliers/${supplierId}/send-credentials`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`${supplierName}: ${t("inventory.toast_cred_sent")}`);
        fetchItems();
        if (newCredentials?.supplier_id === supplierId) setNewCredentials(null);
      } else {
        showToast(data.detail || t("inventory.toast_cred_send_failed"), "err");
      }
    } catch {
      showToast(t("inventory.toast_cred_send_failed"), "err");
    } finally { setSendingCreds(false); }
  };

  const handleDeleteSupplier = async (supplierId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${API_BASE_URL}/inventory/suppliers/${supplierId}`, { method: "DELETE" });
    fetchItems();
  };

  const handleSendRFQ = async () => {
    if (!showRFQModal || !rfqForm.supplier_email.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/rfq`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: showRFQModal.item.id,
          supplier_name: rfqForm.supplier_name,
          supplier_email: rfqForm.supplier_email,
          quantity: rfqForm.quantity ? parseFloat(rfqForm.quantity) : null,
          notes: rfqForm.notes
        })
      });
      setShowRFQModal(null);
      showToast(t("inventory.toast_rfq_sent"));
    } finally { setSaving(false); }
  };

  const handleTagAdd = () => {
    const tag = tagInput.trim();
    if (tag && !itemForm.tags.includes(tag)) {
      setItemForm(f => ({ ...f, tags: [...f.tags, tag] }));
    }
    setTagInput("");
  };

  const stockStatus = (item: InventoryItem) => {
    if (item.current_stock === 0) return { label: t("inventory.stock_out_of_stock"), color: "text-red-500 bg-red-50 dark:bg-red-900/20" };
    if (item.current_stock <= item.min_stock) return { label: t("inventory.stock_low_stock"), color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" };
    return { label: t("inventory.stock_in_stock"), color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" };
  };

  const categories = ["All", ...Array.from(new Set(items.map(i => i.category || "Other")))];

  // Group suppliers by email or name
  const groupedSuppliers = items.reduce((acc, item) => {
    item.suppliers.forEach(sup => {
      const key = sup.supplier_email || sup.supplier_name;
      if (!acc[key]) {
        acc[key] = {
          name: sup.supplier_name,
          email: sup.supplier_email,
          brand: sup.supplier_brand,
          items: []
        };
      }
      acc[key].items.push({ ...item, supplier_details: sup });
    });
    return acc;
  }, {} as Record<string, any>);
  const uniqueSuppliers = Object.values(groupedSuppliers);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-black min-h-screen">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {toast.type === "ok" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credentials Modal - shown after every supplier add */}
      <AnimatePresence>
        {newCredentials && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94 }}
              className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{newCredentials.name}</h2>
                  <p className="text-xs text-slate-500">
                    {newCredentials.email
                      ? t("inventory.cred_can_login")
                      : "Supplier added — add an email to enable portal login"}
                  </p>
                </div>
              </div>

              {newCredentials.email ? (
                <>
                  <div className="space-y-3 mb-5">
                    <div className="p-4 bg-slate-900 rounded-xl">
                      <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">{t("inventory.cred_login_url")}</p>
                      <code className="text-blue-400 text-sm font-mono break-all">{typeof window !== 'undefined' ? `${window.location.origin}/login` : ''}</code>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-slate-900 rounded-xl">
                        <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">{t("inventory.cred_email")}</p>
                        <code className="text-emerald-400 text-sm font-mono break-all select-all">{newCredentials.email}</code>
                      </div>
                      <div className="p-4 bg-slate-900 rounded-xl">
                        <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">{t("inventory.cred_password")}</p>
                        <code className="text-amber-400 text-sm font-mono select-all">{newCredentials.password}</code>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {t("inventory.cred_share_notice")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSendCredentials(newCredentials.supplier_id, newCredentials.name)}
                      disabled={sendingCreds}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                      {sendingCreds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {t("inventory.cred_send_email")}
                    </button>
                    <button onClick={() => { setNewCredentials(null); showToast(t("inventory.toast_supplier_added_login")); }}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all">
                      {t("inventory.cred_done_btn")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl mb-5">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      To enable supplier portal login, edit this supplier and add their email address. A login account will be created automatically.
                    </p>
                  </div>
                  <button onClick={() => { setNewCredentials(null); showToast(t("inventory.toast_supplier_added")); }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all">
                    {t("inventory.cred_done_btn")}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t("inventory.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {items.length} {t("inventory.items_label")} · {items.reduce((a, b) => a + b.suppliers.length, 0)} {t("inventory.supplier_links_label")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportActions
              downloadUrl={`${API_BASE_URL}/inventory/export-pdf`}
              emailUrl={`${API_BASE_URL}/inventory/export-pdf`}
              filename="inventory_list.pdf"
              label="Inventory"
              items={items.map(i => ({ id: i.id, name: i.name, code: i.code }))}
              multiDownloadUrl={`${API_BASE_URL}/inventory/pdf`}
            />
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all hover:shadow-md active:scale-95">
              <Plus className="w-4 h-4" /> {t("inventory.btn_add_item")}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            { label: t("inventory.stat_total_items"), value: items.length, color: "text-blue-600", bg: "bg-blue-500/10" },
            { label: t("inventory.stat_in_stock"), value: items.filter(i => i.current_stock > i.min_stock).length, color: "text-emerald-600", bg: "bg-emerald-500/10" },
            { label: t("inventory.stat_low_out"), value: items.filter(i => i.current_stock <= i.min_stock).length, color: "text-amber-600", bg: "bg-amber-500/10" },
            { label: t("inventory.stat_suppliers"), value: items.reduce((a, b) => a + b.suppliers.length, 0), color: "text-violet-600", bg: "bg-violet-500/10" },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${s.bg}`}>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black">
        <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl w-fit">
          <button onClick={() => setActiveTab("items")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "items" ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"}`}>
            Items
          </button>
          <button onClick={() => setActiveTab("suppliers")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "suppliers" ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"}`}>
            Suppliers
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {activeTab === "items" && (
        <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 flex-wrap gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder={t("inventory.search_placeholder")} value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${categoryFilter === cat ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
              {cat === "All" ? t("inventory.filter_all") : cat}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Item List */}
      {activeTab === "items" && (
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("inventory.empty_title")}</h3>
            <p className="text-sm text-slate-500 mt-1">{t("inventory.empty_desc")}</p>
            <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
              <Plus className="w-4 h-4" /> {t("inventory.empty_add_first")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const stock = stockStatus(item);
              const isExpanded = expandedId === item.id;
              const preferredSupplier = item.suppliers.find(s => s.is_preferred) || item.suppliers[0];
              return (
                <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  
                  {/* Item Header Row */}
                  <div className="flex items-center gap-4 p-4 cursor-pointer select-none" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                    {/* Photo */}
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.photo_url ? (
                        <img src={item.photo_url.startsWith("/static") ? `${API_BASE_URL}${item.photo_url}` : item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</span>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{item.code}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${stock.color}`}>{stock.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[12px] text-slate-500 dark:text-slate-400 flex-wrap">
                        {item.category && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{item.category}</span>}
                        <span>{t("inventory.label_stock")} <b className="text-slate-700 dark:text-slate-200">{item.current_stock} {item.unit || t("inventory.default_unit")}</b></span>
                        <span>{t("inventory.label_min")} <b className="text-slate-700 dark:text-slate-200">{item.min_stock} {item.unit || t("inventory.default_unit")}</b></span>
                        {preferredSupplier && (
                          <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                            <Building2 className="w-3 h-3" />
                            {preferredSupplier.supplier_name}
                            {preferredSupplier.unit_cost ? ` · ${preferredSupplier.currency} ${preferredSupplier.unit_cost}` : ""}
                          </span>
                        )}
                      </div>
                      {item.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {item.tags.map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-slate-400">{item.suppliers.length} {item.suppliers.length !== 1 ? t("inventory.suppliers_suffix") : t("inventory.supplier_suffix")}</span>
                      <button onClick={e => { e.stopPropagation(); setShowRFQModal({ item }); setRfqForm({ supplier_name: "", supplier_email: "", quantity: "", notes: "" }); }}
                        title={t("inventory.title_send_rfq")} className="p-1.5 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 text-slate-400 hover:text-violet-600 transition-colors">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => openEdit(item, e)} title={t("inventory.title_edit")} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => handleDeleteItem(item.id, e)} title={t("inventory.title_delete")} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded: Supplier Breakdown */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("inventory.section_suppliers_cost")}</h4>
                            <button onClick={() => { setShowSupplierModal({ itemId: item.id }); setIsNewSupplier(false); setSupplierForm({ ...emptySupplier }); }}
                              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                              <Plus className="w-3 h-3" /> {t("inventory.btn_add_supplier")}
                            </button>
                          </div>
                          {item.suppliers.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">{t("inventory.no_suppliers")}</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {item.suppliers.map(s => (
                                <div key={s.id} className={`p-3 rounded-xl border ${s.is_preferred ? "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/10" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"}`}>
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <div className="flex items-center gap-1">
                                        {s.is_preferred && <Star className="w-3 h-3 text-violet-500 fill-violet-500" />}
                                        <span className="text-sm font-bold text-slate-800 dark:text-white">{s.supplier_name}</span>
                                      </div>
                                      {s.supplier_brand && <span className="text-[11px] text-slate-500">{s.supplier_brand}</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {s.credentials_ready && (
                                        <button
                                          onClick={e => { e.stopPropagation(); handleSendCredentials(s.id, s.supplier_name); }}
                                          disabled={sendingCreds}
                                          title={s.credentials_sent ? t("inventory.title_resend_creds") : t("inventory.title_send_creds")}
                                          className={`p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors ${s.credentials_sent ? "text-emerald-500" : "text-slate-400 hover:text-emerald-600"}`}>
                                          {sendingCreds ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                        </button>
                                      )}
                                      <button onClick={e => handleDeleteSupplier(s.id, e)}
                                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-500 transition-colors">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="space-y-1 text-[12px] text-slate-600 dark:text-slate-400">
                                    {s.unit_cost != null && <div className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{s.currency} {s.unit_cost} {t("inventory.per_unit")}</div>}
                                    {s.lead_time_days != null && <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.lead_time_days} {t("inventory.day_lead_time")}</div>}
                                    {s.lot_number && <div className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{t("inventory.lot_label")} {s.lot_number}</div>}
                                    {s.supplier_email && <div className="text-blue-500 truncate">{s.supplier_email}</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Supplier List */}
      {activeTab === "suppliers" && (
        <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-black/50">
          {uniqueSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">{t("inventory.no_suppliers") || "No suppliers found"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {uniqueSuppliers.map((supplier: any) => (
                <div key={supplier.email || supplier.name} className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{supplier.name}</h3>
                        {supplier.email && <p className="text-sm text-slate-500 font-medium">{supplier.email}</p>}
                      </div>
                    </div>
                  </div>
                  
                  {/* Items Supplied by this Supplier */}
                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Items ({supplier.items.length})</h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {supplier.items.map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                              {it.photo_url ? <img src={it.photo_url} alt={it.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-400" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{it.name}</p>
                              <p className="text-xs text-slate-500">{it.code}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-600">
                              {it.supplier_details.unit_cost ? `${it.supplier_details.currency} ${it.supplier_details.unit_cost}` : "No Price"}
                            </p>
                            <p className="text-xs text-slate-400">{it.supplier_details.lead_time_days ? `${it.supplier_details.lead_time_days} days` : "Unknown lead time"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ADD/EDIT ITEM MODAL ─── */}
      <AnimatePresence>
        {showItemModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowItemModal(false); }}>
            <motion.div initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editItem ? t("inventory.modal_edit_item") : t("inventory.modal_add_item")}</h2>
                    <p className="text-xs text-slate-500">{t("inventory.modal_item_sub")}</p>
                  </div>
                </div>
                <button onClick={() => setShowItemModal(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Photo Upload */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_photo")}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="inventoryPhotoUpload"
                      onChange={handlePhotoUpload}
                    />
                    <label
                      htmlFor="inventoryPhotoUpload"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-zinc-300 cursor-pointer hover:border-blue-500 hover:text-blue-600 transition-colors"
                    >
                      <Upload className="w-4 h-4" /> {uploadingPhoto ? t("inventory.uploading") : itemForm.photo_url ? t("inventory.change_photo") : t("inventory.upload_image")}
                    </label>
                    {itemForm.photo_url && (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                        <img src={itemForm.photo_url.startsWith("/static") ? `${API_BASE_URL}${itemForm.photo_url}` : itemForm.photo_url} alt="preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setItemForm(f => ({ ...f, photo_url: "" }))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_item_code")} <span className="text-red-500">*</span></label>
                    <input autoFocus value={itemForm.code} onChange={e => setItemForm(f => ({ ...f, code: e.target.value }))} placeholder="SKU-001"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_item_name")} <span className="text-red-500">*</span></label>
                    <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Industrial Pump"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_category")}</label>
                    <select value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{t("inventory.select_category")}</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_unit")}</label>
                    <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{t("inventory.select_unit")}</option>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_current_stock")}</label>
                    <input type="number" value={itemForm.current_stock} onChange={e => setItemForm(f => ({ ...f, current_stock: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_min_stock")}</label>
                    <input type="number" value={itemForm.min_stock} onChange={e => setItemForm(f => ({ ...f, min_stock: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_tags")}</label>
                  <div className="flex gap-2">
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleTagAdd(); } }}
                      placeholder={t("inventory.tag_placeholder")}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={handleTagAdd} className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {itemForm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {itemForm.tags.map(tag => (
                        <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                          {tag}
                          <button onClick={() => setItemForm(f => ({ ...f, tags: f.tags.filter(tt => tt !== tag) }))}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_description")}</label>
                  <textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    placeholder={t("inventory.desc_placeholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                <button onClick={() => setShowItemModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 transition-all">
                  {t("inventory.btn_cancel")}
                </button>
                <button onClick={handleSaveItem} disabled={saving || !itemForm.name.trim() || !itemForm.code.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editItem ? t("inventory.btn_save_changes") : t("inventory.btn_add_item")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ADD SUPPLIER MODAL ─── */}
      <AnimatePresence>
        {showSupplierModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowSupplierModal(null); }}>
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("inventory.modal_add_supplier")}</h2>
                </div>
                <button onClick={() => setShowSupplierModal(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_supplier_name")} <span className="text-red-500">*</span></label>
                    {!isNewSupplier && dropdownSuppliers.length > 0 ? (
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={supplierForm.supplier_name}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === "__NEW__") {
                              setIsNewSupplier(true);
                              setSupplierForm(f => ({ ...f, supplier_name: "", supplier_brand: "", supplier_email: "" }));
                            } else {
                              const existing = dropdownSuppliers.find(s => s.supplier_name === val);
                              if (existing) {
                                setSupplierForm(f => ({ ...f, supplier_name: existing.supplier_name, supplier_brand: existing.supplier_brand || "", supplier_email: existing.supplier_email || "", currency: existing.currency || "USD" }));
                              }
                            }
                          }}
                        >
                          <option value="" disabled>Select a supplier...</option>
                          {dropdownSuppliers.map(s => (
                            <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>
                          ))}
                          <option value="__NEW__" className="font-bold text-blue-600">+ Create New Supplier</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input autoFocus value={supplierForm.supplier_name} onChange={e => setSupplierForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="Supplier Co."
                          className="flex-1 w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {dropdownSuppliers.length > 0 && (
                          <button type="button" onClick={() => setIsNewSupplier(false)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 bg-slate-100 dark:bg-slate-800 rounded-xl">Cancel</button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_brand")}</label>
                    <input value={supplierForm.supplier_brand} onChange={e => setSupplierForm(f => ({ ...f, supplier_brand: e.target.value }))} placeholder="Brand name"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_supplier_email")}</label>
                  <input type="email" value={supplierForm.supplier_email} onChange={e => setSupplierForm(f => ({ ...f, supplier_email: e.target.value }))} placeholder="orders@supplier.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_unit_cost")}</label>
                    <input type="number" value={supplierForm.unit_cost} onChange={e => setSupplierForm(f => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_currency")}</label>
                    <select value={supplierForm.currency} onChange={e => setSupplierForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_lead_time")}</label>
                    <input type="number" value={supplierForm.lead_time_days} onChange={e => setSupplierForm(f => ({ ...f, lead_time_days: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_lot_number")}</label>
                    <input value={supplierForm.lot_number} onChange={e => setSupplierForm(f => ({ ...f, lot_number: e.target.value }))} placeholder="LOT-2024-001"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_min_order_qty")}</label>
                    <input type="number" value={supplierForm.min_order_qty} onChange={e => setSupplierForm(f => ({ ...f, min_order_qty: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="is-preferred" checked={supplierForm.is_preferred} onChange={e => setSupplierForm(f => ({ ...f, is_preferred: e.target.checked }))}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500" />
                  <label htmlFor="is-preferred" className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-violet-500" /> {t("inventory.label_preferred")}
                  </label>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_notes")}</label>
                  <textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                <button onClick={() => setShowSupplierModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 transition-all">
                  {t("inventory.btn_cancel")}
                </button>
                <button onClick={handleAddSupplier} disabled={saving || !supplierForm.supplier_name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t("inventory.btn_add_supplier_modal")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SEND RFQ MODAL ─── */}
      <AnimatePresence>
        {showRFQModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowRFQModal(null); }}>
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("inventory.modal_send_rfq")}</h2>
                    <p className="text-xs text-slate-500">{showRFQModal.item.name} · {showRFQModal.item.code}</p>
                  </div>
                </div>
                <button onClick={() => setShowRFQModal(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium">
                  {t("inventory.rfq_notice")}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_supplier_name")}</label>
                    <input autoFocus value={rfqForm.supplier_name} onChange={e => setRfqForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="Supplier Co."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_supplier_email")} <span className="text-red-500">*</span></label>
                    <input type="email" value={rfqForm.supplier_email} onChange={e => setRfqForm(f => ({ ...f, supplier_email: e.target.value }))} placeholder="orders@supplier.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_quantity")}</label>
                  <input type="number" value={rfqForm.quantity} onChange={e => setRfqForm(f => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 100"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("inventory.label_notes_to_supplier")}</label>
                  <textarea value={rfqForm.notes} onChange={e => setRfqForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                    placeholder="Any specific requirements, delivery location, specs..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                <button onClick={() => setShowRFQModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 transition-all">
                  {t("inventory.btn_cancel")}
                </button>
                <button onClick={handleSendRFQ} disabled={saving || !rfqForm.supplier_email.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Send className="w-4 h-4" /> {t("inventory.btn_send_rfq")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
