"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Plus, X, Search, ThumbsUp, Eye, Edit2, Trash2, Loader2, Tag } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

interface Solution { id: number; title: string; content: string; category?: string; tags?: string[]; is_published: boolean; view_count: number; helpful_count: number; created_at: string; }
const CATEGORIES = ["General", "Billing", "Technical", "Onboarding", "Account", "Integration", "Other"];

export default function SolutionsPage() {
  const { t } = useLanguage();
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editSolution, setEditSolution] = useState<Solution | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "", tags: "", is_published: true });

  const load = () => { setLoading(true); fetch(`${API_BASE_URL}/solutions`).then(r => r.json()).then(d => setSolutions(Array.isArray(d.solutions) ? d.solutions : [])).finally(() => setLoading(false)); };
  useEffect(load, []);

  const filtered = useMemo(() => solutions.filter(s => {
    const q = search.toLowerCase();
    return (!q || s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q))
      && (catFilter === "All" || s.category === catFilter);
  }), [solutions, search, catFilter]);

  const openCreate = () => { setEditSolution(null); setForm({ title: "", content: "", category: "", tags: "", is_published: true }); setShowModal(true); };
  const openEdit = (s: Solution) => { setEditSolution(s); setForm({ title: s.title, content: s.content, category: s.category || "", tags: (s.tags || []).join(", "), is_published: s.is_published }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const payload = { ...form, tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [] };
    const url = editSolution ? `${API_BASE_URL}/solutions/${editSolution.id}` : `${API_BASE_URL}/solutions`;
    await fetch(url, { method: editSolution ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false); setShowModal(false); load();
  };
  const handleDelete = async (id: number) => { if (!confirm("Delete solution?")) return; await fetch(`${API_BASE_URL}/solutions/${id}`, { method: "DELETE" }); load(); };
  const handleHelpful = async (id: number) => { await fetch(`${API_BASE_URL}/solutions/${id}/helpful`, { method: "POST" }); load(); };

  const CATEGORY_LABELS: Record<string, string> = {
    All: t("support_solutions.title"),
    General: t("support_solutions.field_category"),
    Billing: "Billing",
    Technical: "Technical",
    Onboarding: "Onboarding",
    Account: "Account",
    Integration: "Integration",
    Other: "Other",
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20"><BookOpen className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{t("support_solutions.title")}</h1><p className="text-sm text-slate-500 dark:text-zinc-400">{t("support_solutions.subtitle")}</p></div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:opacity-90 shadow-md transition-all">
          <Plus className="w-4 h-4" /> {t("support_solutions.add_solution")}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: t("support_solutions.total_articles"), value: solutions.length, c: "text-indigo-500" },
          { label: t("support_solutions.total_views"), value: solutions.reduce((s, a) => s + a.view_count, 0), c: "text-blue-500" },
          { label: t("support_solutions.helpful_votes"), value: solutions.reduce((s, a) => s + a.helpful_count, 0), c: "text-emerald-500" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm">
            <p className="text-2xl font-black text-slate-800 dark:text-zinc-100">{loading ? "—" : s.value}</p>
            <p className={`text-xs font-medium mt-0.5 ${s.c}`}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("support_solutions.search_placeholder")} className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex gap-2 flex-wrap">{["All", ...CATEGORIES].map(c => <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${catFilter === c ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"}`}>{CATEGORY_LABELS[c] || c}</button>)}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? <div className="col-span-3 flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
          : filtered.length === 0 ? <div className="col-span-3 flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700"><BookOpen className="w-10 h-10 text-slate-300 mb-3" /><p className="text-slate-500 font-bold">{t("support_solutions.empty")}</p></div>
          : filtered.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                {s.category && <span className="text-[10px] font-black uppercase tracking-wide text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-lg mb-2 inline-block">{s.category}</span>}
                <p className="text-sm font-black text-slate-800 dark:text-zinc-100 line-clamp-2 mt-1">{s.title}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 hover:bg-slate-200"><Edit2 className="w-3 h-3" /></button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-3 flex-1 mb-3">{s.content}</p>
            {s.tags && s.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {s.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded-full">{t}</span>)}
              </div>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{s.view_count}</span>
                <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{s.helpful_count}</span>
              </div>
              <button onClick={() => handleHelpful(s.id)} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors">
                <ThumbsUp className="w-3 h-3" /> {t("support_solutions.btn_helpful")}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-700">
                <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100">{editSolution ? t("support_solutions.modal_edit") : t("support_solutions.modal_new")}</h2>
                <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("support_solutions.field_title")}</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t("support_solutions.ph_title")} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("support_solutions.field_content")}</label>
                  <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={6} placeholder={t("support_solutions.ph_content")} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("support_solutions.field_category")}</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">{t("support_solutions.option_select")}</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("support_solutions.field_tags")}</label>
                    <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder={t("support_solutions.ph_tags")} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all">{t("support_solutions.btn_cancel")}</button>
                <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editSolution ? t("support_solutions.btn_update") : t("support_solutions.btn_add")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
