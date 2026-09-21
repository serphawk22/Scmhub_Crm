'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Download, RefreshCw, Layers, CheckCircle, Search, TrendingUp, AlertTriangle, Globe, Zap, Clock } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import PageGuide from '@/components/PageGuide';
import { useLanguage } from "@/context/LanguageContext";

export default function AuditPage() {
  const { t } = useLanguage();
  const { email } = useRole();
  const [domain, setDomain] = useState('');
  const [running, setRunning] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);

  const runAudit = async () => {
    if (!domain.trim() && !email) return;
    setRunning(true);
    setAuditData(null);
    try {
      const res = await fetch(`${API_BASE_URL}/audit/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() || undefined, email: email || undefined })
      });
      const data = await res.json();
      if (data.success) {
        setAuditData(data.audit);
      }
    } catch {
    } finally {
      setRunning(false);
    }
  };

  const downloadReport = () => {
    const d = auditData?.domain || domain || '';
    window.open(`${API_BASE_URL}/audit/export?email=${encodeURIComponent(email || '')}&domain=${encodeURIComponent(d)}`, '_blank');
  };

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = (score: number) =>
    score >= 80 ? 'bg-emerald-50' : score >= 50 ? 'bg-amber-50' : 'bg-red-50';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 dark:bg-black rounded-3xl p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Activity className="w-7 h-7" /></div>
          {t("audit.title")}
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 font-medium mt-1">{t("audit.subtitle")}</p>
      </div>

      <PageGuide
        pageKey="audit"
        title={t("audit.guide_title")}
        description={t("audit.guide_desc")}
        steps={[
          { icon: '🌐', text: t("audit.guide_s1") },
          { icon: '📊', text: t("audit.guide_s2") },
          { icon: '🟢', text: t("audit.guide_s3") },
          { icon: '⬇️', text: t("audit.guide_s4") },
        ]}
      />

      {/* Domain Input + Actions */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Globe className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAudit()}
              placeholder="example.com"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
          <button
            onClick={runAudit}
            disabled={running || (!domain.trim() && !email)}
            className={`px-6 py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-sm ${
              running ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black active:scale-95'
            }`}
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {running ? t("audit.scanning") : t("audit.run_audit")}
          </button>
          <button
            onClick={downloadReport}
            disabled={!auditData}
            className="px-6 py-3 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 font-bold rounded-xl flex items-center gap-2 text-sm hover:bg-gray-50 dark:bg-zinc-950 disabled:opacity-40 transition-all"
          >
            <Download className="w-4 h-4" /> {t("audit.export_pdf")}
          </button>
        </div>
      </div>

      {/* Loading */}
      {running && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-16 flex flex-col items-center text-center space-y-5">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <Search className="w-7 h-7 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-800 dark:text-zinc-100">{t("audit.crawling").replace("{domain}", domain || '')}</h3>
            <p className="text-gray-400 text-sm mt-1.5">{t("audit.crawling_checking")}</p>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {auditData && !running && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Domain badge */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 font-medium">
            <Globe className="w-4 h-4" />
            <span>{auditData.domain}</span>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("audit.health_score"), value: `${auditData.health_score}/100`, icon: TrendingUp, color: scoreColor(auditData.health_score), bg: scoreBg(auditData.health_score) },
              { label: t("audit.page_speed"), value: `${auditData.page_speed_desktop}/100`, icon: Zap, color: scoreColor(auditData.page_speed_desktop), bg: scoreBg(auditData.page_speed_desktop) },
              { label: t("audit.issues_found"), value: auditData.issues_count, icon: AlertTriangle, color: auditData.issues_count > 0 ? 'text-red-600' : 'text-emerald-600', bg: auditData.issues_count > 0 ? 'bg-red-50' : 'bg-emerald-50' },
              { label: t("audit.load_time"), value: `${auditData.load_time}s`, icon: Clock, color: auditData.load_time <= 2 ? 'text-emerald-600' : 'text-amber-600', bg: auditData.load_time <= 2 ? 'bg-emerald-50' : 'bg-amber-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-5 ${s.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">{s.label}</span>
                </div>
                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Technical findings */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
              <h3 className="font-black text-lg text-gray-900 dark:text-zinc-50 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" /> {t("audit.technical_findings")}
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {Object.entries(auditData.tech_seo_issues || {}).map(([key, val]: [string, any]) => {
                const pass = String(val).includes('Pass');
                return (
                  <div key={key} className="flex items-start justify-between px-6 py-4 hover:bg-gray-50 dark:bg-zinc-950 transition-colors">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 dark:text-zinc-100 text-sm">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{String(val)}</p>
                    </div>
                    {pass ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" /> {t("audit.pass")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" /> {t("audit.issue")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
