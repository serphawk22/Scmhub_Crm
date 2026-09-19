"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCheck, Trash2, ExternalLink, RefreshCw,
  Info, CheckCircle, AlertTriangle, XCircle, Filter,
  CalendarDays, Inbox, BellOff, Loader2, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/context/NotificationContext";
import PageGuide from "@/components/PageGuide";

// ── Config ─────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string; badge: string }> = {
  info:    { icon: Info,          color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    border: "border-blue-100 dark:border-blue-800",    badge: "bg-blue-500" },
  success: { icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-100 dark:border-emerald-800", badge: "bg-emerald-500" },
  warning: { icon: AlertTriangle, color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20",   border: "border-amber-100 dark:border-amber-800",   badge: "bg-amber-500" },
  error:   { icon: XCircle,       color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/20",       border: "border-red-100 dark:border-red-800",       badge: "bg-red-500" },
  alert:   { icon: AlertTriangle, color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20",   border: "border-amber-100 dark:border-amber-800",   badge: "bg-amber-500" },
};

const TABS = [
  { key: "all", label: "All", icon: Inbox },
  { key: "unread", label: "Unread", icon: Flame },
  { key: "info", label: "Info", icon: Info },
  { key: "success", label: "Success", icon: CheckCircle },
  { key: "warning", label: "Warning", icon: AlertTriangle },
  { key: "error", label: "Error", icon: XCircle },
] as const;

type Tab = typeof TABS[number]["key"];

// ── Date grouping helper ────────────────────────────────────────────────────
function getGroup(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const notifDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (notifDay.getTime() === today.getTime()) return "Today";
  if (notifDay.getTime() === yesterday.getTime()) return "Yesterday";
  if (notifDay >= weekAgo) return "This Week";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Older"];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const {
    notifications, unreadCount, loading,
    markRead, markAllRead, deleteNotification, clearAll, refresh,
  } = useNotifications();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("all");
  const [clearing, setClearing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Filter by tab
  const filtered = useMemo(() => {
    if (tab === "all") return notifications;
    if (tab === "unread") return notifications.filter(n => !n.is_read);
    return notifications.filter(n => n.type === tab || (tab === "warning" && n.type === "alert"));
  }, [notifications, tab]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const n of filtered) {
      const g = getGroup(n.created_at);
      if (!groups[g]) groups[g] = [];
      groups[g].push(n);
    }
    return groups;
  }, [filtered]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    await markAllRead();
    setMarkingAll(false);
  };

  const handleClearAll = async () => {
    setClearing(true);
    await clearAll();
    setClearing(false);
  };

  // Tab counts
  const tabCounts: Record<string, number> = {
    all: notifications.length,
    unread: notifications.filter(n => !n.is_read).length,
    info: notifications.filter(n => n.type === "info").length,
    success: notifications.filter(n => n.type === "success").length,
    warning: notifications.filter(n => n.type === "warning" || n.type === "alert").length,
    error: notifications.filter(n => n.type === "error").length,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 max-w-3xl">
      
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
            <div className="relative">
              <Bell className="w-7 h-7" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full px-1">
                  {unreadCount}
                </span>
              )}
            </div>
            Notifications
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm mt-1">
            Real-time alerts for every important event in your CRM.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} disabled={markingAll}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl font-semibold text-sm hover:bg-indigo-100 transition-all"
            >
              {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={handleClearAll} disabled={clearing}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 rounded-xl font-semibold text-sm hover:bg-red-100 transition-all"
            >
              {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Page Guide ── */}
      <PageGuide
        pageKey="notifications"
        title="How Notifications work"
        description="Stay informed with real-time alerts about every CRM event."
        steps={[
          { icon: "🔔", text: "Notifications fire automatically for: new leads, clients, tickets, tasks, invoices, projects, demo signups, and upgrade requests." },
          { icon: "🏷️", text: "Use the filter tabs to view by type: Info, Success, Warning, or Error." },
          { icon: "📅", text: "Notifications are grouped by date: Today, Yesterday, This Week, and Older." },
          { icon: "🗑️", text: "Dismiss individual notifications or clear all at once. The bell in the top bar shows your live unread count." },
        ]}
      />

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all",
              tab === key
                ? "bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200 dark:border-zinc-700"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {tabCounts[key] > 0 && (
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded-full ml-0.5",
                tab === key ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" : "bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400"
              )}>
                {tabCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <BellOff className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-500 dark:text-zinc-400">
            {tab === "unread" ? "No unread notifications!" : "No notifications here."}
          </p>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-1">
            {tab === "all" ? "You're all caught up 🎉" : "Try switching to a different filter."}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(group => (
            <div key={group}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-3">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  {group}
                </span>
                <div className="flex-1 h-px bg-slate-100 dark:bg-zinc-800" />
                <span className="text-xs text-slate-400">{grouped[group].length}</span>
              </div>

              {/* Notifications in group */}
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {grouped[group].map((n, i) => {
                    const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40, scale: 0.95 }}
                        transition={{ delay: i * 0.04 }}
                        className={cn(
                          "group relative rounded-2xl border p-4 transition-all cursor-pointer",
                          n.is_read
                            ? "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 opacity-60 hover:opacity-80"
                            : cn(cfg.bg, cfg.border, "hover:shadow-md border-l-4", cfg.border.split(" ")[0])
                        )}
                        onClick={() => {
                          if (!n.is_read) markRead(n.id);
                          if (n.link) router.push(n.link);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={cn(
                            "p-2 rounded-xl shrink-0",
                            n.is_read ? "bg-gray-100 dark:bg-zinc-800" : cfg.bg
                          )}>
                            <cfg.icon className={cn("w-4 h-4", n.is_read ? "text-gray-400" : cfg.color)} />
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className={cn(
                                "font-bold text-sm",
                                n.is_read ? "text-gray-500 dark:text-zinc-400" : "text-gray-900 dark:text-zinc-50"
                              )}>
                                {n.title}
                              </p>
                              {!n.is_read && (
                                <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.badge)} />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
                              {n.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-400">
                                {timeAgo(n.created_at)} · {new Date(n.created_at).toLocaleDateString()}
                              </span>
                              {n.link && (
                                <Link
                                  href={n.link}
                                  onClick={(e) => { e.stopPropagation(); if (!n.is_read) markRead(n.id); }}
                                  className={cn("flex items-center gap-1 text-xs font-semibold hover:underline", cfg.color)}
                                >
                                  View <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="absolute top-3 right-3 p-1.5 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                          title="Dismiss"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
