'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Users, TrendingUp, DollarSign, Clock, Activity } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface HealthTabProps {
  client: any;
  activities: any[];
  emails: any[];
  timeline: any[];
  serviceRequests: any[];
}

function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60 bg-white dark:bg-zinc-900 dark:bg-slate-900 shadow-sm overflow-hidden relative"
    >
      <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-30 ${color}`} />
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color.replace('bg-', 'bg-').replace('/30', '/20')}`}>
        <Icon size={18} className={color.replace('bg-', 'text-').replace('/30', '')} />
      </div>
      <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-zinc-400 mb-0.5">{label}</p>
      <p className="text-3xl font-black text-slate-900 dark:text-zinc-50 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

function SimpleBarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / max) * 80}%` }}
            transition={{ delay: i * 0.05, duration: 0.5, ease: 'easeOut' }}
            className={`w-full rounded-t-lg min-h-1 ${color}`}
            style={{ maxHeight: '80px' }}
          />
          <span className="text-[9px] text-slate-400 dark:text-slate-600 dark:text-zinc-300 font-bold">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function HealthTab({ client, activities, emails, timeline, serviceRequests }: HealthTabProps) {
  const { language } = useLanguage();
  // Compute metrics from real data
  const emailsSent = emails.length;
  const callsMade = activities.filter(a => a.method === 'Phone' || a.method === 'Call').length;
  const meetings = activities.filter(a => a.method === 'In-person' || a.method === 'Meeting').length;
  const openOpps = serviceRequests.filter(r => !['Delivered', 'Cancelled'].includes(r.status)).length;
  const revenue = client?.customFields?.total_revenue || '—';

  // Activity by day of week (last 7 days)
  const now = new Date();
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const label = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' });
    const count = timeline.filter(e => {
      const evDate = new Date(e.date || 0);
      return evDate.toDateString() === d.toDateString();
    }).length;
    return { label, value: count };
  });

  // Activity by type
  const typeData = [
    { label: language === 'es' ? 'Email' : 'Email', value: emailsSent },
    { label: language === 'es' ? 'Llamada' : 'Call', value: callsMade },
    { label: language === 'es' ? 'Reunión' : 'Meeting', value: meetings },
    { label: language === 'es' ? 'Actividad' : 'Activity', value: activities.length },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard icon={Mail}       label={language === 'es' ? 'Emails Enviados' : 'Emails Sent'}       value={emailsSent} color="bg-violet-300"  />
        <MetricCard icon={Phone}      label={language === 'es' ? 'Llamadas Realizadas' : 'Calls Made'}        value={callsMade}  color="bg-amber-300"   />
        <MetricCard icon={Users}      label={language === 'es' ? 'Reuniones' : 'Meetings'}          value={meetings}   color="bg-blue-300"    />
        <MetricCard icon={TrendingUp} label={language === 'es' ? 'Oportunidades Abiertas' : 'Open Opportunities'} value={openOpps} color="bg-emerald-300" />
        <MetricCard icon={DollarSign} label={language === 'es' ? 'Ingresos Generados' : 'Revenue Generated'} value={revenue}    color="bg-indigo-300"  />
        <MetricCard icon={Activity}   label={language === 'es' ? 'Total Actividades' : 'Total Activities'}  value={activities.length} color="bg-pink-300" />
      </div>

      {/* Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60 bg-white dark:bg-zinc-900 dark:bg-slate-900 shadow-sm">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 dark:text-slate-400 mb-4">{language === 'es' ? 'Actividad Esta Semana' : 'Activity This Week'}</h4>
          <SimpleBarChart data={weekData} color="bg-indigo-400 dark:bg-indigo-500" />
          <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400 mt-2 text-center">{language === 'es' ? 'Eventos por día (últimos 7 días)' : 'Events per day (last 7 days)'}</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60 bg-white dark:bg-zinc-900 dark:bg-slate-900 shadow-sm">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 dark:text-slate-400 mb-4">{language === 'es' ? 'Desglose de Comunicación' : 'Communication Breakdown'}</h4>
          <SimpleBarChart data={typeData} color="bg-violet-400 dark:bg-violet-500" />
          <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400 mt-2 text-center">{language === 'es' ? 'Por tipo de canal' : 'By channel type'}</p>
        </div>
      </div>

      {/* NPS & Engagement */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60 bg-white dark:bg-zinc-900 dark:bg-slate-900 shadow-sm">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 dark:text-slate-400 mb-4">{language === 'es' ? 'Métricas de Interacción' : 'Engagement Metrics'}</h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: language === 'es' ? 'Visitantes Totales' : 'Total Visitors',   value: client?.customFields?.total_visitors   || '—' },
            { label: language === 'es' ? 'Tasa de Interacción' : 'Engagement Rate',  value: client?.customFields?.engagement_rate  || '—' },
            { label: language === 'es' ? 'Tiempo Prom. en Sitio' : 'Avg. Time on Site',value: client?.customFields?.avg_time_on_site || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 dark:bg-slate-800/50 border border-slate-100 dark:border-zinc-800 dark:border-slate-700/50">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-zinc-400">{label}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-zinc-50 dark:text-white mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline summary */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60 bg-white dark:bg-zinc-900 dark:bg-slate-900 shadow-sm">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 dark:text-slate-400 mb-3">{language === 'es' ? 'Actividad Reciente' : 'Recent Activity Feed'}</h4>
        {timeline.slice(0, 5).length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-zinc-400 text-center py-4">{language === 'es' ? 'No hay actividad reciente' : 'No recent activity'}</p>
        ) : (
          <div className="space-y-2">
            {timeline.slice(0, 5).map((ev: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                <span className="text-sm">{['email','call','invoice','milestone','file','activity'][ev.type === 'email' ? 0 : ev.type === 'call' ? 1 : ev.type === 'invoice' ? 2 : ev.type === 'milestone' ? 3 : ev.type === 'file' ? 4 : 5] !== undefined ? { email: '✉️', call: '📞', invoice: '💰', milestone: '🎯', file: '📁', activity: '⚡' }[ev.type as string] || '⚡' : '⚡'}</span>
                <p className="flex-1 text-xs text-slate-600 dark:text-zinc-300 dark:text-slate-400 truncate">{ev.title}</p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-zinc-400 flex-shrink-0">
                  {ev.date ? new Date(ev.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
