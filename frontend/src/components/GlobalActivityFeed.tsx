"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Clock, Timer, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import { useLanguage } from "@/context/LanguageContext";

export default function GlobalActivityFeed({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { t } = useLanguage();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { role } = useRole();

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch(`${API_BASE_URL}/activities/global`)
        .then(async res => { if (!res.ok) throw new Error("Activity fetch failed"); return res.json(); })
        .then(data => {
          setActivities(data.activities || []);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!role || role === 'Client' || role === 'Supplier') return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[400px] bg-white dark:bg-zinc-950 shadow-2xl z-[9999] border-l border-slate-200 dark:border-zinc-800 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">{t("activity_feed.title")}</h2>
                  <p className="text-xs text-slate-500">{t("activity_feed.subtitle")}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-zinc-950/50">
              {loading ? (
                <div className="flex items-center justify-center h-full text-slate-500">{t("activity_feed.loading")}</div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                  <Timer className="w-12 h-12 mb-3" />
                  <p>{t("activity_feed.no_activity")}</p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-zinc-800 before:to-transparent">
                  {activities.map((act, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={idx}
                      className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-zinc-900 bg-indigo-50 dark:bg-zinc-800 text-indigo-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{act.action}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-2">
                          {act.content}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                          <Clock className="w-3 h-3" />
                          {new Date(act.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
