"use client";
import { API_BASE_URL } from "@/config";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Plus, Trash2, Copy, Eye, EyeOff, CheckCircle, Shield, X, Loader2, Globe, AlertTriangle, Code } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface APIKeyItem {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string;
}

const SCOPE_OPTIONS = ["read", "write", "delete", "leads:read", "leads:write", "clients:read", "clients:write", "inventory:read", "inventory:write"];

export default function APIKeysPage() {
  const { t } = useLanguage();
  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: "", scopes: ["read", "write"] as string[] });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api-keys`);
      if (res.ok) setKeys((await res.json()).keys || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api-keys`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey({ key: data.key, name: data.name });
        setShowModal(false);
        fetchKeys();
      }
    } finally { setSaving(false); }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm(t("api_keys.confirm_revoke"))) return;
    await fetch(`${API_BASE_URL}/api-keys/${id}`, { method: "DELETE" });
    fetchKeys();
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope]
    }));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-black p-6">
      {/* One-time key reveal dialog */}
      <AnimatePresence>
        {newKey && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94 }}
              className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("api_keys.created_title")}</h2>
                  <p className="text-xs text-slate-500">{t("api_keys.created_desc").replace("{name}", newKey.name)}</p>
                </div>
              </div>
              <div className="p-4 bg-slate-900 rounded-xl mb-4 flex items-center gap-3">
                <code className="text-emerald-400 text-sm font-mono flex-1 break-all select-all">{newKey.key}</code>
                <button onClick={() => handleCopy(newKey.key)} className="shrink-0 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {t("api_keys.key_shown_once")}
                </p>
              </div>
              <button onClick={() => setNewKey(null)} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all">
                {t("api_keys.saved_key")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("api_keys.title")}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("api_keys.subtitle")}</p>
            </div>
          </div>
          <button onClick={() => { setShowModal(true); setForm({ name: "", scopes: ["read", "write"] }); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 shadow-sm transition-all active:scale-95">
            <Plus className="w-4 h-4" /> {t("api_keys.generate_key")}
          </button>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Globe, title: t("api_keys.rest_api"), desc: t("api_keys.rest_api_desc"), color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
            { icon: Shield, title: t("api_keys.scoped_access"), desc: t("api_keys.scoped_access_desc"), color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20" },
            { icon: Code, title: t("api_keys.base_url"), desc: t("api_keys.base_url_desc"), color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
          ].map(card => (
            <div key={card.title} className="p-4 bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{card.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-all">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* Usage example */}
        <div className="bg-slate-900 rounded-2xl p-5 mb-8">
          <p className="text-xs text-slate-400 font-mono mb-3 uppercase tracking-wider">{t("api_keys.example_request")}</p>
          <pre className="text-sm text-slate-200 font-mono overflow-x-auto">{`curl https://web-production-d6daf.up.railway.app/leads \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}</pre>
        </div>

        {/* Keys List */}
        <div className="bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">{t("api_keys.active_keys").replace("{count}", String(keys.length))}</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin w-6 h-6 text-violet-600" />
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Key className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t("api_keys.no_keys")}</p>
              <p className="text-xs text-slate-400 mt-1">{t("api_keys.generate_first")}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {keys.map(key => (
                <div key={key.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{key.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <code className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {key.key_prefix}••••••••••••••••••••••
                      </code>
                      <div className="flex gap-1 flex-wrap">
                        {key.scopes?.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t("api_keys.created")} {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && ` · ${t("api_keys.last_used")} ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button onClick={() => handleRevoke(key.id)}
                    className="p-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Key Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                    <Key className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("api_keys.generate_api_key")}</h2>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("api_keys.key_name")} <span className="text-red-500">*</span></label>
                  <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={t("api_keys.key_name_placeholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 block">{t("api_keys.permissions")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SCOPE_OPTIONS.map(scope => (
                      <button key={scope} onClick={() => toggleScope(scope)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all text-left ${form.scopes.includes(scope) ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700" : "bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-violet-300"}`}>
                        {form.scopes.includes(scope) && <CheckCircle className="w-3 h-3 inline mr-1 text-violet-500" />}
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 transition-all">
                  {t("api_keys.cancel")}
                </button>
                <button onClick={handleCreate} disabled={saving || !form.name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t("api_keys.generate_key")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
