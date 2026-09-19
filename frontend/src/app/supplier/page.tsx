"use client";
import { API_BASE_URL } from "@/config";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, DollarSign, Clock, Edit2, CheckCircle, Loader2, X,
  AlertTriangle, Star, ShoppingCart, Tag, BarChart2, Save, ArrowUpDown, Plus
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";

interface SupplierItem {
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
  my_supplier_id: number;
  my_unit_cost?: number;
  my_currency: string;
  my_lead_time_days?: number;
  my_lot_number?: string;
  my_notes?: string;
  is_preferred: boolean;
  total_suppliers: number;
}

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD"];

export default function SupplierPortalPage() {
  const { t } = useLanguage();
  const { user } = useRole();
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<SupplierItem | null>(null);
  const [editForm, setEditForm] = useState({
    unit_cost: 0, currency: "USD", lead_time_days: 0,
    lot_number: "", notes: "", current_stock: 0
  });
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemForm, setAddItemForm] = useState({
    code: "", name: "", description: "", category: "", tags: "",
    unit: "", min_stock: 0, current_stock: 0, unit_cost: 0,
    currency: "USD", lead_time_days: 0
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchItems = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/supplier/inventory?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, [user?.email]);

  const openEdit = (item: SupplierItem) => {
    setEditItem(item);
    setEditForm({
      unit_cost: item.my_unit_cost || 0,
      currency: item.my_currency || "USD",
      lead_time_days: item.my_lead_time_days || 0,
      lot_number: item.my_lot_number || "",
      notes: item.my_notes || "",
      current_stock: item.current_stock || 0,
    });
  };

  const handleSave = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const updateRes = await fetch(`${API_BASE_URL}/supplier/inventory/${editItem.my_supplier_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_name: user?.name || "",
          supplier_email: user?.email || "",
          unit_cost: editForm.unit_cost,
          currency: editForm.currency,
          lead_time_days: editForm.lead_time_days,
          lot_number: editForm.lot_number,
          notes: editForm.notes,
          is_preferred: editItem.is_preferred,
        })
      });

      await fetch(`${API_BASE_URL}/supplier/inventory/${editItem.my_supplier_id}/stock?current_stock=${editForm.current_stock}`, {
        method: "PUT"
      });

      if (updateRes.ok) {
        setEditItem(null);
        fetchItems();
        showToast(t("supplier.updated_ok"));
      }
    } finally { setSaving(false); }
  };

  const handleAddItem = async () => {
    if (!addItemForm.name || !addItemForm.code) {
      showToast("Name and Code are required", "err");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/supplier/inventory/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_name: user?.name || user?.email || "Unknown",
          supplier_email: user?.email || "",
          code: addItemForm.code,
          name: addItemForm.name,
          description: addItemForm.description,
          category: addItemForm.category,
          tags: addItemForm.tags.split(",").map(t => t.trim()).filter(Boolean),
          unit: addItemForm.unit,
          min_stock: addItemForm.min_stock,
          current_stock: addItemForm.current_stock,
          unit_cost: addItemForm.unit_cost,
          currency: addItemForm.currency,
          lead_time_days: addItemForm.lead_time_days
        })
      });
      if (res.ok) {
        setShowAddItem(false);
        fetchItems();
        showToast("Item added successfully");
      } else {
        showToast("Failed to add item", "err");
      }
    } catch {
      showToast("Network error", "err");
    } finally { setSaving(false); }
  };

  const stockStatus = (item: SupplierItem) => {
    if (item.current_stock === 0) return { label: t("supplier.stock_out"), color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" };
    if (item.current_stock <= item.min_stock) return { label: t("supplier.stock_low"), color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" };
    return { label: t("supplier.stock_in"), color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" };
  };

  const stats = [
    { label: t("supplier.stat_assigned"), value: items.length, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", icon: Package },
    { label: t("supplier.stat_in_stock"), value: items.filter(i => i.current_stock > i.min_stock).length, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: CheckCircle },
    { label: t("supplier.stat_low_out"), value: items.filter(i => i.current_stock <= i.min_stock).length, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", icon: AlertTriangle },
    { label: t("supplier.stat_preferred"), value: items.filter(i => i.is_preferred).length, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20", icon: Star },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-black">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {toast.type === "ok" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("supplier.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t("supplier.welcome")} <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.name || user?.email}</span>
              {" · "}{t("supplier.manage_inventory")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowAddItem(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-sm hover:-translate-y-0.5 transition-transform">
              <Plus className="w-4 h-4" /> {t("supplier.add_item") || "Add Item"}
            </button>
            <div className="text-right">
              <p className="text-xs text-slate-400">{t("supplier.logged_in_as")}</p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map(s => (
            <div key={s.label} className={`flex items-center gap-3 p-4 rounded-2xl ${s.bg} border border-transparent`}>
              <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
              <div>
                <p className={`text-2xl font-black ${s.color}`}>{loading ? "—" : s.value}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800">
            <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="font-bold text-slate-700 dark:text-slate-200">{t("supplier.no_items")}</h3>
            <p className="text-sm text-slate-400 mt-1">{t("supplier.no_items_desc")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => {
              const stock = stockStatus(item);
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <div className="p-5 flex gap-4 items-start">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                      {item.photo_url ? (
                        <img src={item.photo_url.startsWith('/') ? `${API_BASE_URL}${item.photo_url}` : item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-7 h-7 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {item.is_preferred && <Star className="w-4 h-4 text-violet-500 fill-violet-500" />}
                            <h3 className="font-bold text-slate-900 dark:text-white">{item.name}</h3>
                            <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{item.code}</span>
                          </div>
                          {item.description && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{item.description}</p>}
                          <div className="flex flex-wrap gap-1 mb-3">
                            {item.tags.map(tag => (
                              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium">{tag}</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => openEdit(item)}
                          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all">
                          <Edit2 className="w-3.5 h-3.5" /> {t("supplier.update")}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className={`p-3 rounded-xl border ${stock.bg}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <BarChart2 className={`w-3.5 h-3.5 ${stock.color}`} />
                            <span className={`text-[11px] font-bold uppercase tracking-wide ${stock.color}`}>{stock.label}</span>
                          </div>
                          <p className="text-lg font-black text-slate-900 dark:text-white">{item.current_stock}</p>
                          <p className="text-[11px] text-slate-500">{t("supplier.min")} {item.min_stock} {item.unit || t("supplier.units")}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t("supplier.my_price")}</span>
                          </div>
                          <p className="text-lg font-black text-slate-900 dark:text-white">
                            {item.my_unit_cost ? `${item.my_currency} ${item.my_unit_cost}` : "—"}
                          </p>
                          <p className="text-[11px] text-slate-500">{t("supplier.per_unit")} {item.unit || t("supplier.units")}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t("supplier.lead_time")}</span>
                          </div>
                          <p className="text-lg font-black text-slate-900 dark:text-white">
                            {item.my_lead_time_days ? `${item.my_lead_time_days}d` : "—"}
                          </p>
                          <p className="text-[11px] text-slate-500">{t("supplier.delivery")}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-1.5 mb-1">
                            <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t("supplier.lot")}</span>
                          </div>
                          <p className="text-lg font-black text-slate-900 dark:text-white font-mono">{item.my_lot_number || "—"}</p>
                          <p className="text-[11px] text-slate-500">{item.total_suppliers} {item.total_suppliers !== 1 ? t("supplier.supplier_total") : t("supplier.supplier_total_one")}</p>
                        </div>
                      </div>

                      {item.my_notes && (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                          <p className="text-xs text-amber-700 dark:text-amber-400"><span className="font-bold">{t("supplier.my_notes")}</span> {item.my_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setEditItem(null); }}>
            <motion.div initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <Edit2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("supplier.modal_title")}</h2>
                    <p className="text-xs text-slate-500">{editItem.name} · {editItem.code}</p>
                  </div>
                </div>
                <button onClick={() => setEditItem(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <label className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" /> {t("supplier.current_stock")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="number" value={editForm.current_stock} onChange={e => setEditForm(f => ({ ...f, current_stock: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 text-slate-900 dark:text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm text-slate-500">{editItem.unit || t("supplier.units")}</span>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t("supplier.min_required")} {editItem.min_stock}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("supplier.unit_cost")}</label>
                    <input type="number" value={editForm.unit_cost} onChange={e => setEditForm(f => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("supplier.currency")}</label>
                    <select value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("supplier.lead_time_days")}</label>
                    <input type="number" value={editForm.lead_time_days} onChange={e => setEditForm(f => ({ ...f, lead_time_days: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("supplier.lot_number")}</label>
                    <input value={editForm.lot_number} onChange={e => setEditForm(f => ({ ...f, lot_number: e.target.value }))} placeholder="LOT-2024-001"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("supplier.notes")}</label>
                  <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                    placeholder={t("supplier.notes_ph")}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                <button onClick={() => setEditItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 transition-all">
                  {t("supplier.cancel")}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t("supplier.save_changes")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add New Item</h2>
                    <p className="text-sm text-slate-500">Create an item and add it to your supply list</p>
                  </div>
                </div>
                <button onClick={() => setShowAddItem(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Item Name *</label>
                    <input type="text" value={addItemForm.name} onChange={e => setAddItemForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Item Code *</label>
                    <input type="text" value={addItemForm.code} onChange={e => setAddItemForm(f => ({ ...f, code: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Description</label>
                  <textarea value={addItemForm.description} onChange={e => setAddItemForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Unit Cost</label>
                    <input type="number" value={addItemForm.unit_cost} onChange={e => setAddItemForm(f => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Currency</label>
                    <select value={addItemForm.currency} onChange={e => setAddItemForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Lead Time (Days)</label>
                    <input type="number" value={addItemForm.lead_time_days} onChange={e => setAddItemForm(f => ({ ...f, lead_time_days: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Initial Stock</label>
                    <input type="number" value={addItemForm.current_stock} onChange={e => setAddItemForm(f => ({ ...f, current_stock: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                <button onClick={() => setShowAddItem(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 transition-all">
                  Cancel
                </button>
                <button onClick={handleAddItem} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Item
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
