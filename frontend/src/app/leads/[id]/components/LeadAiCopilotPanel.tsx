'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Zap, AlertTriangle, TrendingUp, RefreshCw, Activity,
  CheckCircle2, ArrowRight
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useLanguage } from '@/context/LanguageContext';

interface LeadAiCopilotPanelProps {
  leadId: string | string[];
  lead: any;
}

function HealthGauge({ score }: { score: number }) {
  const { language } = useLanguage();
  const pct = Math.min(100, Math.max(0, score));
  const radius = 40;
  const circ = Math.PI * radius; // half circle
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  
  let label = '';
  if (language === 'es') {
    label = pct >= 70 ? 'Saludable' : pct >= 40 ? 'En Riesgo' : 'Crítico';
  } else {
    label = pct >= 70 ? 'Healthy' : pct >= 40 ? 'At Risk' : 'Critical';
  }

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative w-28 h-16 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full" style={{ overflow: 'visible' }}>
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="8"
            className="text-slate-200 dark:text-slate-700 dark:text-zinc-200" strokeLinecap="round" />
          <motion.path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            initial={{ strokeDasharray: '0 200' }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-3xl font-black" style={{ color }}>{pct}</span>
        </div>
      </div>
      <span className="text-xs font-bold mt-1" style={{ color }}>{label}</span>
    </div>
  );
}

export default function LeadAiCopilotPanel({ leadId, lead }: LeadAiCopilotPanelProps) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${leadId}/ai-insights`, { method: 'POST' });
      const data = await res.json();
      setInsights(data.insights);
    } catch {
      setError(language === 'es' ? 'El análisis falló. Revisa tu configuración de IA.' : 'Analysis failed. Check your AI configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-800/50
                    bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/30 dark:to-slate-900
                    overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-violet-100 dark:border-violet-900/50
                      bg-gradient-to-r from-violet-600 to-indigo-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-white" />
            <span className="font-black text-sm text-white">{language === 'es' ? 'Copiloto IA de Ventas' : 'AI Sales Copilot'}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-zinc-900/20 text-white">GPT-4o</span>
        </div>
        <p className="text-xs text-violet-200 mt-1">{language === 'es' ? 'Analiza notas, conversaciones y actividad' : 'Analyzes notes, conversations & activity'}</p>
      </div>

      <div className="p-4">
        {!insights && !loading && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30
                            flex items-center justify-center mx-auto mb-3">
              <Brain size={32} className="text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300 dark:text-slate-400 mb-1">{language === 'es' ? 'Listo para Analizar' : 'Ready to Analyze'}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400 mb-4">
              {language === 'es' ? 'Obtenga estado de salud, riesgos y próximas acciones por IA' : 'Get AI-powered deal health, risks, and next best actions'}
            </p>
            <button
              onClick={analyze}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                         text-white text-sm font-bold hover:opacity-90 transition-opacity
                         shadow-lg shadow-violet-500/25"
            >
              {language === 'es' ? 'Analizar Leade' : 'Analyze Lead'}
            </button>
          </div>
        )}

        {loading && (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-3 border-violet-200 dark:border-violet-800" />
              <div className="absolute inset-0 rounded-full border-3 border-violet-600 border-t-transparent animate-spin" style={{ borderWidth: 3 }} />
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 dark:text-slate-400 animate-pulse">{language === 'es' ? 'Analizando datos del leade…' : 'Analyzing lead data…'}</p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <AnimatePresence>
          {insights && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Health Score Gauge */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-white dark:bg-zinc-900 dark:bg-slate-800 overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-zinc-400 px-3 pt-3">{language === 'es' ? 'Salud del Trato' : 'Deal Health'}</p>
                <HealthGauge score={insights.deal_health_score ?? 50} />
                <div className="px-3 pb-3 text-center">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
                    {insights.deal_health_label}
                  </span>
                </div>
              </div>

              {/* Lead Summary */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-zinc-400 mb-1.5">{language === 'es' ? 'Resumen del Leade' : 'Lead Summary'}</p>
                <p className="text-xs text-slate-600 dark:text-zinc-300 dark:text-slate-400 leading-relaxed">{insights.lead_summary}</p>
              </div>

              {/* Risks */}
              {insights.risks?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={12} className="text-amber-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-500">{language === 'es' ? 'Factores de Riesgo' : 'Risk Factors'}</p>
                  </div>
                  <div className="space-y-1.5">
                    {insights.risks.map((risk: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-amber-800 dark:text-amber-400">{risk}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Best Action */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20
                              border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-500">{language === 'es' ? 'Siguiente Mejor Acción' : 'Next Best Action'}</p>
                </div>
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">{insights.next_best_action}</p>
              </div>

              {/* Follow-up Recommendations */}
              {insights.follow_up_recommendations?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp size={12} className="text-indigo-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-500">{language === 'es' ? 'Recomendaciones' : 'Recommendations'}</p>
                  </div>
                  <div className="space-y-1.5">
                    {insights.follow_up_recommendations.map((rec: string, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <ArrowRight size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-slate-600 dark:text-zinc-300 dark:text-slate-400">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-analyze */}
              <button
                onClick={analyze}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl
                           text-xs font-bold text-violet-600 dark:text-violet-400
                           border border-violet-200 dark:border-violet-800
                           hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
              >
                <RefreshCw size={12} /> {language === 'es' ? 'Re-Analizar' : 'Re-Analyze'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
