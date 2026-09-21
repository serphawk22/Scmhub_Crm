'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface TimelineTabProps {
  timeline: any[];
  timelineFilter: string;
  onFilterChange: (f: string) => void;
}

const EVENT_COLORS: Record<string, { bg: string; ring: string; icon: string; line: string }> = {
  email:     { bg: 'bg-violet-100 dark:bg-violet-900/30', ring: 'ring-violet-300 dark:ring-violet-700', icon: '✉️', line: 'border-violet-200 dark:border-violet-800' },
  call:      { bg: 'bg-amber-100 dark:bg-amber-900/30',   ring: 'ring-amber-300 dark:ring-amber-700',   icon: '📞', line: 'border-amber-200 dark:border-amber-800'   },
  invoice:   { bg: 'bg-emerald-100 dark:bg-emerald-900/30', ring: 'ring-emerald-300 dark:ring-emerald-700', icon: '💰', line: 'border-emerald-200 dark:border-emerald-800' },
  milestone: { bg: 'bg-pink-100 dark:bg-pink-900/30',     ring: 'ring-pink-300 dark:ring-pink-700',     icon: '🎯', line: 'border-pink-200 dark:border-pink-800'     },
  file:      { bg: 'bg-sky-100 dark:bg-sky-900/30',       ring: 'ring-sky-300 dark:ring-sky-700',       icon: '📁', line: 'border-sky-200 dark:border-sky-800'       },
  activity:  { bg: 'bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800',      ring: 'ring-slate-300 dark:ring-slate-600',   icon: '⚡', line: 'border-slate-200 dark:border-zinc-700 dark:border-slate-700'   },
  note:      { bg: 'bg-indigo-100 dark:bg-indigo-900/30', ring: 'ring-indigo-300 dark:ring-indigo-700', icon: '📝', line: 'border-indigo-200 dark:border-indigo-800' },
  meeting:   { bg: 'bg-teal-100 dark:bg-teal-900/30',     ring: 'ring-teal-300 dark:ring-teal-700',     icon: '🤝', line: 'border-teal-200 dark:border-teal-800'     },
};

function groupByDate(events: any[], locale: string) {
  const groups: Record<string, any[]> = {};
  events.forEach(ev => {
    const d = ev.date ? new Date(ev.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : (locale === 'es' ? 'Fecha Desconocida' : 'Unknown Date');
    if (!groups[d]) groups[d] = [];
    groups[d].push(ev);
  });
  return groups;
}

export default function TimelineTab({ timeline, timelineFilter, onFilterChange }: TimelineTabProps) {
  const { t, language } = useLanguage();

  const FILTERS = [
    { key: 'all',       label: t('timeline.all_events') },
    { key: 'email',     label: t('timeline.emails')     },
    { key: 'call',      label: t('timeline.calls')      },
    { key: 'invoice',   label: t('timeline.invoices')   },
    { key: 'milestone', label: t('timeline.milestones') },
    { key: 'file',      label: t('timeline.files')      },
    { key: 'activity',  label: t('timeline.activities') },
  ];

  const filtered = timelineFilter === 'all'
    ? timeline
    : timeline.filter(e => e.type === timelineFilter);

  const grouped = groupByDate(filtered, language);

  return (
    <div className="space-y-4">
      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
              ${timelineFilter === f.key
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                : 'bg-white dark:bg-zinc-900 dark:bg-slate-800 border border-slate-200 dark:border-zinc-700 dark:border-slate-700 text-slate-500 dark:text-zinc-400 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-slate-700'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 dark:border-slate-700">
          <History size={32} className="text-slate-300 dark:text-slate-600 dark:text-zinc-300 mb-3" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 dark:text-zinc-400">{t('timeline.no_events')}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-300 mt-1">{t('timeline.no_events_desc')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, events]) => (
            <div key={date}>
              {/* Date Label */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700 dark:bg-slate-700" />
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 dark:text-zinc-400 uppercase tracking-wider px-2">{date}</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700 dark:bg-slate-700" />
              </div>

              {/* Events */}
              <div className="relative pl-10 space-y-3">
                {/* Vertical line */}
                <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 dark:from-indigo-700 via-purple-200 dark:via-purple-900 to-transparent" />

                {events.map((ev: any, idx: number) => {
                  const c = EVENT_COLORS[ev.type] || EVENT_COLORS.activity;
                  return (
                    <motion.div
                      key={`${ev.type}-${ev.id}-${idx}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="relative flex items-start gap-3"
                    >
                      {/* Dot */}
                      <div className={`absolute -left-[26px] w-5 h-5 rounded-full ${c.bg} ring-2 ${c.ring}
                                       flex items-center justify-center text-[9px] flex-shrink-0 shadow-sm`}>
                        {c.icon}
                      </div>

                      {/* Card */}
                      <div className={`flex-1 p-3 rounded-xl border ${c.line} bg-white dark:bg-zinc-900 dark:bg-slate-900
                                       hover:shadow-md transition-shadow`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 dark:text-zinc-400">
                                {ev.type}
                              </span>
                              {ev.user && (
                                <span className="text-[9px] text-slate-400 dark:text-slate-600 dark:text-zinc-300">• {ev.user}</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 dark:text-slate-200 truncate">{ev.title}</p>
                            {ev.detail && (
                              <p className="text-xs text-slate-500 dark:text-zinc-400 dark:text-slate-400 mt-0.5 line-clamp-2">{ev.detail}</p>
                            )}
                          </div>
                          {ev.date && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-zinc-400 font-medium flex-shrink-0">
                              {new Date(ev.date).toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
