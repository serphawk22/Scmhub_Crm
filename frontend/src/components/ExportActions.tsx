"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Mail, X, Loader2, FileDown, Send, CheckCircle, AlertTriangle, ListChecks, Check, ChevronDown } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

interface Toast {
  type: "ok" | "err";
  text: string;
}

interface ExportActionsProps {
  downloadUrl: string;
  emailUrl: string;
  filename: string;
  label?: string;
  items?: { id: number; name: string; code?: string | null }[];
  itemDownloadUrl?: (id: number) => string;
  multiDownloadUrl?: string;
}

export function ExportActions({ downloadUrl, emailUrl, filename, label = "Export", items = [], itemDownloadUrl, multiDownloadUrl }: ExportActionsProps) {
  const { t } = useLanguage();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<null | "download" | "email" | "item">(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = (type: "ok" | "err", text: unknown) => {
    setToast({ type, text: typeof text === "string" ? text : errorText(text, t("export_actions.download_failed")) });
    setTimeout(() => setToast(null), 3000);
  };

  const errorText = (detail: unknown, fallback: string): string => {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const msgs = detail.map((e: any) => {
        if (e && typeof e === "object" && typeof e.msg === "string") {
          const loc = Array.isArray(e.loc) ? e.loc.filter((x: any) => typeof x === "string").join(".") : "";
          return loc ? `${loc}: ${e.msg}` : e.msg;
        }
        return JSON.stringify(e);
      });
      return msgs.filter(Boolean).join("; ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return fallback;
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const res = await fetch(downloadUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        notify("err", errorText(d.detail, t("export_actions.download_failed")));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      notify("ok", t("export_actions.pdf_downloaded"));
    } catch {
      notify("err", t("export_actions.network_error"));
    } finally {
      setBusy(null);
    }
  };

  const handleEmailSend = async () => {
    if (!email.trim()) return;
    setBusy("email");
    try {
      const res = await fetch(emailUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify("err", errorText(d.detail, t("export_actions.send_failed")));
        return;
      }
      notify("ok", `${t("export_actions.pdf_sent_to")} ${email.trim()}`);
      setEmail("");
      setShowEmail(false);
    } catch {
      notify("err", t("export_actions.network_error"));
    } finally {
      setBusy(null);
    }
  };

  const handleMultiDownload = async (ids: number[]) => {
    if (!multiDownloadUrl || ids.length === 0) return;
    setBusy("item");
    try {
      const res = await fetch(multiDownloadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: ids }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        notify("err", errorText(d.detail, t("export_actions.download_failed")));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventory_items.pdf";
      a.click();
      URL.revokeObjectURL(url);
      notify("ok", t("export_actions.pdf_downloaded"));
    } catch {
      notify("err", t("export_actions.network_error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <button onClick={handleDownload} disabled={busy === "download" || busy === "email"}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-zinc-200 hover:border-blue-500 disabled:opacity-60 transition-all">
        {busy === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {t("export_actions.pdf")}
      </button>
      <button onClick={() => setShowEmail(true)} disabled={busy === "download" || busy === "email"}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-zinc-200 hover:border-blue-500 disabled:opacity-60 transition-all">
        <Mail className="w-4 h-4" /> {t("export_actions.email")}
      </button>

      {items.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowPicker(p => !p)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-zinc-200 hover:border-blue-500 transition-all"
            title="Select items to download"
          >
            <ListChecks className="w-4 h-4" />
            {t("export_actions.select_items")}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showPicker && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowPicker(false)}>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-600" /> {t("export_actions.select_items_title")}
                  </h3>
                  <button onClick={() => setShowPicker(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {t("export_actions.select_items_desc")} {selectedIds.length}{t("export_actions.select_items_suffix")}
                </p>

                <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 mb-4">
                  {items.map(it => {
                    const isSel = selectedIds.includes(it.id);
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => setSelectedIds(prev =>
                          isSel ? prev.filter(x => x !== it.id) : [...prev, it.id]
                        )}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSel ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-zinc-800"}`}
                      >
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${isSel ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 dark:border-slate-600"}`}>
                          {isSel && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                          {it.code ? `${it.code} · ` : ""}{it.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    disabled={selectedIds.length === 0}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    {t("export_actions.clear")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleMultiDownload(selectedIds); setShowPicker(false); }}
                    disabled={selectedIds.length === 0 || busy === "item"}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-all"
                  >
                    {busy === "item" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {t("export_actions.download")} ({selectedIds.length})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showEmail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowEmail(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" /> {t("export_actions.send_pdf")}
              </h3>
              <button onClick={() => setShowEmail(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("export_actions.email_address")}</label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEmailSend()}
              placeholder="recipient@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowEmail(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-sm hover:bg-slate-200 transition-all">
                {t("export_actions.cancel")}
              </button>
              <button onClick={handleEmailSend} disabled={!email.trim() || busy === "email"}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {busy === "email" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                {t("export_actions.send")}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
          >
            {toast.type === "ok" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}