'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Search, MousePointerClick, TrendingUp, BarChart3, LineChart, Users, Eye, DollarSign, FolderKanban, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import PageGuide from '@/components/PageGuide';
import { useLanguage } from "@/context/LanguageContext";

interface MonitorData {
  total_keywords: number;
  avg_position: number;
  keyword_rows: { keyword: string; position: number; url: string; search_engine: string; recorded_at: string }[];
  total_projects: number;
  completed_projects: number;
  avg_progress: number;
  total_revenue: number;
  paid_revenue: number;
  pending_revenue: number;
  weekly_activity: { week: string; count: number }[];
}

export default function MonitorPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/monitor-stats`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const kpis = [
    { title: t("monitor.keywords_tracked"), val: data?.total_keywords ?? 0, sub: t("monitor.recent_entries").replace("{count}", String(data?.keyword_rows?.length ?? 0)), icon: Search, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: t("monitor.avg_position"), val: data?.avg_position ?? '—', sub: t("monitor.across_keywords"), icon: TrendingUp, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
    { title: t("monitor.total_revenue"), val: `$${(data?.total_revenue ?? 0).toLocaleString()}`, sub: t("monitor.paid_amount").replace("{amount}", `$${(data?.paid_revenue ?? 0).toLocaleString()}`), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: t("monitor.projects"), val: `${data?.completed_projects ?? 0}/${data?.total_projects ?? 0}`, sub: t("monitor.avg_progress").replace("{percent}", String(data?.avg_progress ?? 0)), icon: FolderKanban, color: 'text-sky-600', bg: 'bg-sky-50' },
  ];

  const maxActivity = Math.max(...(data?.weekly_activity?.map(w => w.count) || [1]), 1);

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-8">
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-slate-200 dark:border-zinc-700 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
             <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Activity className="w-8 h-8"/></div>
             {t("monitor.title")}
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 font-medium mt-2">{t("monitor.subtitle")}</p>
        </div>
        <div className="flex gap-3">
             <div className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-slate-600 dark:text-zinc-300">{t("monitor.live_data")}</span>
             </div>
        </div>
      </div>

      <PageGuide
        pageKey="monitor"
        title={t("monitor.guide_title")}
        description={t("monitor.guide_desc")}
        steps={[
          { icon: '📊', text: t("monitor.guide_s1") },
          { icon: '📈', text: t("monitor.guide_s2") },
          { icon: '🔍', text: t("monitor.guide_s3") },
          { icon: '🟢', text: t("monitor.guide_s4") },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid lg:grid-cols-4 gap-6">
         {kpis.map((kpi, i) => (
           <motion.div key={i} initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{delay: i * 0.1}} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-700 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                 <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color}`}>
                    <kpi.icon className="w-6 h-6" />
                 </div>
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{kpi.title}</p>
                 <p className="text-3xl font-black text-slate-800 dark:text-zinc-100">{kpi.val}</p>
                 <p className="text-xs font-bold text-emerald-500 mt-2">{kpi.sub}</p>
              </div>
           </motion.div>
         ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
         {/* Live Ranking Tracker */}
         <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950/50">
                 <h3 className="font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                   <TrendingUp className="w-5 h-5 text-indigo-500"/> {t("monitor.seo_ranking")}
               </h3>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b border-slate-100 dark:border-zinc-800">
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest pl-6">{t("monitor.keyword")}</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t("monitor.position")}</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t("monitor.engine")}</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest pr-6">{t("monitor.recorded")}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {(data?.keyword_rows || []).length === 0 ? (
                     <tr><td colSpan={4} className="p-6 text-center text-sm text-slate-400">{t("monitor.no_rankings")}</td></tr>
                   ) : (
                     data!.keyword_rows.map((k, i) => (
                       <tr key={i} className="hover:bg-slate-50 dark:bg-zinc-950 transition-colors">
                         <td className="p-4 pl-6 font-bold text-slate-800 dark:text-zinc-100 text-sm">{k.keyword}</td>
                         <td className="p-4 font-black text-slate-700 dark:text-zinc-200">{k.position}</td>
                         <td className="p-4 text-sm text-slate-500 dark:text-zinc-400">{k.search_engine}</td>
                         <td className="p-4 pr-6 text-xs text-slate-400">{k.recorded_at ? new Date(k.recorded_at).toLocaleDateString() : '—'}</td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
            </div>
         </motion.div>

         {/* Weekly Activity Chart */}
         <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-700 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                   <BarChart3 className="w-5 h-5 text-indigo-500"/> {t("monitor.weekly_activity")}
               </h3>
            </div>
            
            <div className="relative h-64 w-full flex items-end gap-2 border-b border-l border-slate-100 dark:border-zinc-800 p-4">
               {(data?.weekly_activity || []).map((w, i) => (
                  <div key={i} className="relative flex-1 group flex flex-col justify-end items-center h-full">
                     <motion.div 
                       initial={{ height: 0 }} 
                       animate={{ height: `${(w.count / maxActivity) * 100}%` }} 
                       transition={{ delay: i * 0.05 }}
                       className="w-full bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t-lg hover:from-fuchsia-500 hover:to-fuchsia-300 transition-colors cursor-pointer min-h-[3px]"
                       title={`${w.count} activities`}
                     />
                     <span className="text-[9px] font-bold text-slate-400 mt-2">{w.week}</span>
                  </div>
               ))}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
               <div className="p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl text-center">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("monitor.total_revenue_label")}</p>
                   <p className="text-xl font-black text-slate-800 dark:text-zinc-100 mt-1">${(data?.total_revenue ?? 0).toLocaleString()}</p>
               </div>
               <div className="p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl text-center">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("monitor.paid")}</p>
                   <p className="text-xl font-black text-emerald-600 mt-1">${(data?.paid_revenue ?? 0).toLocaleString()}</p>
               </div>
               <div className="p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl text-center">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("monitor.pending")}</p>
                  <p className="text-xl font-black text-amber-600 mt-1">${(data?.pending_revenue ?? 0).toLocaleString()}</p>
               </div>
            </div>
         </motion.div>
      </div>
    </div>
  );
}
