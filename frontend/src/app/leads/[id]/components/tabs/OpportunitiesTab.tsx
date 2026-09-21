'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ArrowRight, CheckCircle2, Clock, XCircle, Target, Brain, Calendar, Wand2, Loader2, Store, AlertCircle, MessageCircle, Phone } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { ResultCard } from '@/components/email-agent/ResultCard';
import { API_BASE_URL } from '@/config';

interface OpportunitiesTabProps {
  lead: any;
  timeline: any[];
  serviceRequests: any[];
  research?: any;
  emails?: any[];
}

const STAGES = ['Lead', 'Qualified', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'];

const STAGE_CFG: Record<string, { bg: string; text: string; border: string }> = {
  Lead:        { bg: 'bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800',      text: 'text-slate-600 dark:text-zinc-300 dark:text-slate-400',   border: 'border-slate-300 dark:border-zinc-600 dark:border-slate-600'   },
  Qualified:   { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',     border: 'border-blue-300 dark:border-blue-700'     },
  Discovery:   { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-300 dark:border-violet-700' },
  Proposal:    { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   border: 'border-amber-300 dark:border-amber-700'   },
  Negotiation: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-700' },
  Won:         { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700' },
  Lost:        { bg: 'bg-red-100 dark:bg-red-900/30',       text: 'text-red-700 dark:text-red-400',       border: 'border-red-300 dark:border-red-700'       },
};

function getTranslatedStage(stage: string, language: string) {
  if (language === 'es') {
    const map: Record<string, string> = {
      Lead: 'Prospecto', Qualified: 'Calificado', Discovery: 'Descubrimiento',
      Proposal: 'Propuesta', Negotiation: 'Negociación', Won: 'Ganado', Lost: 'Perdido'
    };
    return map[stage] || stage;
  }
  return stage;
}

function StagePipeline({ current, language }: { current: string, language: string }) {
  const currentIdx = STAGES.indexOf(current);
  const isTerminal = current === 'Won' || current === 'Lost';

  return (
    <div className="relative">
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {STAGES.filter(s => s !== 'Lost').map((stage, idx) => {
          const active = stage === current;
          const passed = currentIdx > idx && !isTerminal;
          const cfg = STAGE_CFG[stage];
          return (
            <React.Fragment key={stage}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.06 }}
                className={`relative flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold
                            whitespace-nowrap transition-all flex-shrink-0
                            ${active ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-1 ${cfg.border} shadow-sm` :
                              passed ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500' :
                              'bg-slate-50 dark:bg-zinc-950 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 dark:text-zinc-300'}`}
              >
                {passed && <CheckCircle2 size={12} className="mr-1 text-emerald-500" />}
                {getTranslatedStage(stage, language)}
                {active && (
                  <span className="ml-1.5 w-2 h-2 rounded-full bg-current animate-pulse" />
                )}
              </motion.div>
              {idx < STAGES.filter(s => s !== 'Lost').length - 1 && (
                <ArrowRight size={12} className={`flex-shrink-0 mx-0.5 ${passed || active ? 'text-emerald-400' : 'text-slate-300 dark:text-slate-700 dark:text-zinc-200'}`} />
              )}
            </React.Fragment>
          );
        })}
        {/* Lost option */}
        {current === 'Lost' && (
          <>
            <ArrowRight size={12} className="flex-shrink-0 mx-0.5 text-red-300" />
            <div className="px-3 py-2 rounded-xl text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-2 ring-red-200 dark:ring-red-800 shadow-sm">
              <XCircle size={12} className="inline mr-1" />{getTranslatedStage('Lost', language)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProbabilityBar({ stage, language }: { stage: string, language: string }) {
  const probs: Record<string, number> = {
    Lead: 10, Qualified: 25, Discovery: 40, Proposal: 60, Negotiation: 75, Won: 100, Lost: 0
  };
  const pct = probs[stage] ?? 0;
  const color = pct >= 70 ? 'from-emerald-500 to-teal-500' : pct >= 40 ? 'from-amber-500 to-orange-500' : 'from-slate-400 to-slate-500';
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 dark:text-slate-400">{language === 'es' ? 'Probabilidad de Ganar' : 'Win Probability'}</span>
        <span className="text-xs font-black text-slate-800 dark:text-zinc-100 dark:text-slate-200">{pct}%</span>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
    </div>
  );
}

export default function OpportunitiesTab({ lead, timeline, serviceRequests, research, emails = [] }: OpportunitiesTabProps) {
  const { language } = useLanguage();
  // Derive current stage from lead status + service requests
  const hasAcceptedProposal = serviceRequests.some(r => r.status === 'Accepted');
  const hasProposal = serviceRequests.some(r => ['Quoted', 'Pending'].includes(r.status));
  const isWon = lead?.status === 'Won' || serviceRequests.some(r => r.status === 'In Progress' || r.status === 'Delivered');
  const isLost = lead?.status === 'Lost';

  let currentStage = 'Lead';
  if (isWon) currentStage = 'Won';
  else if (isLost) currentStage = 'Lost';
  else if (hasAcceptedProposal) currentStage = 'Negotiation';
  else if (hasProposal) currentStage = 'Proposal';
  else if (serviceRequests.length > 0) currentStage = 'Discovery';
  else if (lead?.status === 'Active') currentStage = 'Qualified';

  const dealValue = lead?.deal_value ? `$${Number(lead.deal_value).toLocaleString()}` : '—';

  // Milestones from timeline
  const milestoneEvents = timeline.filter(e => e.type === 'milestone').slice(0, 5);

  const [activeSubTab, setActiveSubTab] = React.useState('presales');

  let leadAgentData: any = null;
  if (lead?.ai_analysis_results) {
    try {
      leadAgentData = typeof lead.ai_analysis_results === 'string'
        ? JSON.parse(lead.ai_analysis_results)
        : lead.ai_analysis_results;
    } catch (e) {}
  }

  let eaData: any = leadAgentData || null;
  if (research?.email_agent_data) {
    try { eaData = typeof research.email_agent_data === 'string' ? JSON.parse(research.email_agent_data) : research.email_agent_data; } catch (e) {}
  }
  
  if (lead?.ai_analysis_results?.product_portfolio) {
    if (!eaData) eaData = {};
    const extractedServices = lead.ai_analysis_results.product_portfolio;
    if (Array.isArray(extractedServices) && extractedServices.length > 0) {
      eaData.product_portfolio = extractedServices.map((s: any) => ({
        name: s.name || s.title,
        description: s.brief || s.description,
        pricing_tier: s.approx_cost ? `$${s.approx_cost}` : undefined,
        target_customer: s.category || "General"
      }));
    }
  }

  // researchData feeds ResultCard — eaData already has company_info + draft
  const [researchData, setResearchData] = React.useState<any>(null);
  React.useEffect(() => {
    if (research?.email_agent_data || leadAgentData) {
      try {
        const parsedResearch = research?.email_agent_data ? (typeof research.email_agent_data === 'string'
          ? JSON.parse(research.email_agent_data)
          : research.email_agent_data) : null;
        setResearchData(parsedResearch || leadAgentData);
      } catch (e) {
        console.error('Failed to parse research data', e);
      }
    }
  }, [research, leadAgentData]);

  let parsedPainPoints: any = null;
  if (research?.pain_points) {
    try { parsedPainPoints = JSON.parse(research.pain_points); } catch(e) { parsedPainPoints = research.pain_points; }
  }
  let parsedCompetitors: any = null;
  if (research?.competitors) {
    try { parsedCompetitors = JSON.parse(research.competitors); } catch(e) { parsedCompetitors = research.competitors; }
  }
  let parsedBusinessGoals: any = null;
  if (research?.business_goals) {
    try { parsedBusinessGoals = JSON.parse(research.business_goals); } catch(e) { parsedBusinessGoals = research.business_goals; }
  }

  const [isAutoResearching, setIsAutoResearching] = React.useState(false);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [extractResult, setExtractResult] = React.useState<{ count: number; marketplace: number } | null>(null);
  const [extractError, setExtractError] = React.useState<string | null>(null);
  const [autoResearchMsg, setAutoResearchMsg] = React.useState<string | null>(null);
  const handleAutoResearch = async () => {
    try {
      setIsAutoResearching(true);
      setAutoResearchMsg(null);
      const res = await fetch(`${API_BASE_URL}/leads/${lead?.id}/auto-research`, {
        method: 'POST'
      });
      if (res.ok) {
        setAutoResearchMsg('running');
        setIsAutoResearching(false);
        return;
      } else {
        const text = await res.text().catch(() => "");
        let err: any = {};
        try { err = JSON.parse(text); } catch (e) {}
        setAutoResearchMsg(`error:${err.detail || text || 'Failed to start research'}`);
      }
    } catch (e: any) {
      setAutoResearchMsg(`error:Network error`);
    }
    setIsAutoResearching(false);
  };

  const handleExtractServices = async () => {
    setIsExtracting(true);
    setExtractResult(null);
    setExtractError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/leads/${lead?.id}/extract-services`, { 
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const text = await res.text().catch(() => "");
      let data: any = {};
      try { data = JSON.parse(text); } catch (e) {}
      
      if (!res.ok) {
        setExtractError(data.detail || text || 'Failed to extract services');
      } else {
        setExtractResult({ count: data.services?.length ?? data.extracted_count ?? 0, marketplace: data.marketplace_entries_added ?? data.marketplace_count ?? 0 });
        // No auto-refresh — results shown in-place
      }
    } catch (e: any) {
      setExtractError(e.message || 'Network error');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-700 dark:border-slate-800 pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('presales')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'presales' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Brain size={16} /> {language === 'es' ? 'Análisis del Agente IA' : 'AI Agent Analysis'}
        </button>
      </div>

      {activeSubTab === 'presales' && (
        <div className="space-y-6">
          {/* Pre-Sales Research Section */}
        <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 p-6 shadow-sm relative overflow-hidden mt-6">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Brain size={120} />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-600 rounded-xl text-white">
                <Brain size={16} />
              </div>
              <h4 className="text-lg font-black text-slate-800 dark:text-zinc-100 dark:text-white">Pre-Sales Research</h4>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <button
                onClick={handleAutoResearch}
                disabled={isAutoResearching}
                className="flex-1 py-2 px-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {isAutoResearching ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {isAutoResearching ? (language === 'es' ? 'Investigando Empresa...' : 'Researching Company...') : (language === 'es' ? 'Analizar Cliente con IA' : 'Analyze Client with AI')}
              </button>
              <button
                onClick={handleExtractServices}
                disabled={isExtracting || !lead?.website}
                title={!lead?.website ? 'Add a website URL first' : 'Extract services from website'}
                className="flex-1 py-2 px-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
                {isExtracting ? 'Extracting Services...' : 'Extract Services from Website'}
              </button>
            </div>

            {extractResult && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <p className="text-xs font-bold text-emerald-700">
                  Found {extractResult.count} services · {extractResult.marketplace} added to Marketplace
                </p>
              </div>
            )}
            {extractError && (
              <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600">{extractError}</p>
              </div>
            )}
            {autoResearchMsg === 'running' && (
              <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <p className="text-xs font-bold text-indigo-700">⏳ Analysis running in background (~2 min). Click below when ready.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Check Results
                </button>
              </div>
            )}
            {autoResearchMsg && autoResearchMsg.startsWith('error:') && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs font-bold text-red-600">{autoResearchMsg.replace('error:', '')}</p>
              </div>
            )}
            {research ? (
            <div className="space-y-4">
              {research.company_overview && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1">Company Overview</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-300 dark:text-slate-300 leading-relaxed">{research.company_overview}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {research.pain_points && (
                  <div className="p-4 bg-white dark:bg-zinc-900 dark:bg-slate-800/80 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-2">Pain Points</p>
                    {Array.isArray(parsedPainPoints) ? (
                      <ul className="space-y-3">
                        {parsedPainPoints.map((p: any, i: number) => (
                          <li key={i} className="text-sm">
                            <span className="font-bold text-slate-800 dark:text-zinc-100">{p.name || p.persona || "Target"}:</span>
                            <span className="text-slate-600 dark:text-zinc-300 ml-1">{p.pain}</span>
                            {p.desire && <div className="text-xs text-indigo-600 mt-1 flex items-center gap-1"><ArrowRight size={12}/>{p.desire}</div>}
                            {p.best_message && <div className="text-xs text-emerald-600 mt-1 italic">"{p.best_message}"</div>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-zinc-300">{research.pain_points}</p>
                    )}
                  </div>
                )}
                {research.competitors && (
                  <div className="p-4 bg-white dark:bg-zinc-900 dark:bg-slate-800/80 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                    <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-2">Competitors</p>
                    {typeof parsedCompetitors === 'object' && parsedCompetitors !== null && !Array.isArray(parsedCompetitors) ? (
                      <div className="space-y-3">
                        {parsedCompetitors.competitive_positioning && <p className="text-sm text-slate-600 dark:text-zinc-300">{parsedCompetitors.competitive_positioning}</p>}
                        {parsedCompetitors.main_competitors && Array.isArray(parsedCompetitors.main_competitors) && (
                           <ul className="space-y-3 mt-3">
                             {parsedCompetitors.main_competitors.map((c: any, i: number) => (
                               <li key={i} className="text-sm border-l-2 border-rose-200 pl-3">
                                 <span className="font-bold text-slate-800 dark:text-zinc-100">{c.name}</span>
                                 <span className="text-xs text-rose-500 font-bold ml-2">({c.overlap || "Medium"} Overlap)</span>
                                 <p className="text-slate-600 dark:text-zinc-300 mt-1 text-xs">{c.how_they_compete}</p>
                               </li>
                             ))}
                           </ul>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-zinc-300">{research.competitors}</p>
                    )}
                  </div>
                )}
                {research.business_goals && (
                  <div className="p-4 bg-white dark:bg-zinc-900 dark:bg-slate-800/80 rounded-xl border border-indigo-50 dark:border-indigo-900/30 md:col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500 mb-2">Business Goals</p>
                    {typeof parsedBusinessGoals === 'object' && parsedBusinessGoals !== null && !Array.isArray(parsedBusinessGoals) ? (
                      <div className="space-y-3">
                        {parsedBusinessGoals.positioning_statement && <p className="text-sm text-slate-600 dark:text-zinc-300 font-medium">{parsedBusinessGoals.positioning_statement}</p>}
                        {parsedBusinessGoals.quick_wins && Array.isArray(parsedBusinessGoals.quick_wins) && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {parsedBusinessGoals.quick_wins.map((w: string, i: number) => (
                              <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">✨ {w}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-zinc-300">{research.business_goals}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div className="text-center py-8 bg-white dark:bg-zinc-900/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-indigo-200 mt-4">
                <p className="text-sm text-indigo-400 font-medium">{language === 'es' ? 'No se ha realizado investigación. Haz clic en analizar arriba.' : 'No research found. Click analyze above to start.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
