"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, X, Clock, MessageSquare, Check } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

interface Call {
  id: number;
  phone_number: string;
  received_at: string;
  duration_seconds: number | null;
  summary: string | null;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const DISMISSED_KEY = "crm_dismissed_unsummarized_calls";

function loadDismissed(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore storage errors
  }
}

export function CallNotificationBar() {
  const { t } = useLanguage();
  const [calls, setCalls] = useState<Call[]>([]);
  const [current, setCurrent] = useState<Call | null>(null);
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchUnsummarized = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/calls?unsummarized=true`);
      const data = await res.json();
      const dismissedIds = loadDismissed();
      const list: Call[] = (data.calls || []).filter((c: Call) => !dismissedIds.has(c.id));
      setCalls(list);
      if (list.length > 0 && !dismissed) {
        setCurrent(list[0]);
      }
    } catch {
      // silent
    }
  }, [dismissed]);

  useEffect(() => {
    fetchUnsummarized();
    const interval = setInterval(fetchUnsummarized, 30_000);
    
    // Listen for simulation events
    window.addEventListener("refresh-calls", fetchUnsummarized);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh-calls", fetchUnsummarized);
    };
  }, [fetchUnsummarized]);

  // Show each call only once ever: record it the moment it is displayed,
  // so reloads / navigation / the 30s poll never bring the same popup back.
  useEffect(() => {
    if (!current) return;
    const handled = loadDismissed();
    if (handled.has(current.id)) return;
    handled.add(current.id);
    saveDismissed(handled);
  }, [current]);

  const handleSave = async () => {
    if (!current || !summary.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/calls/${current.id}/summary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      setSummary("");
      setDismissed(false);
      const remaining = calls.filter((c) => c.id !== current.id);
      setCalls(remaining);
      setCurrent(remaining[0] || null);
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    if (current) {
      const dismissedIds = loadDismissed();
      dismissedIds.add(current.id);
      saveDismissed(dismissedIds);
    }
    setDismissed(true);
    setCurrent(null);
  };

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] w-full max-w-xl px-4"
      >
        <div className="bg-white dark:bg-zinc-900/90 backdrop-blur-2xl border border-amber-200 shadow-[0_8px_40px_rgba(245,158,11,0.2)] rounded-3xl p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 dark:text-zinc-100 text-sm">{t("call_notification.unsummarized_call")}</p>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                <span className="font-bold text-amber-600">{current.phone_number}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(current.duration_seconds)}</span>
                <span>{new Date(current.received_at).toLocaleTimeString()}</span>
              </div>
            </div>
            {calls.length > 1 && (
              <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-full">+{calls.length - 1} {t("call_notification.more")}</span>
            )}
            <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-700 dark:text-zinc-200 transition-colors ml-auto shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("call_notification.add_summary_placeholder")}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-medium text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !summary.trim()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              <Check className="w-4 h-4" />
              {t("call_notification.save")}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
