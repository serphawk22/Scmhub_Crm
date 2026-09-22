'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ArrowRight, CheckCircle2, Clock, XCircle, Target, Brain, Mail, Calendar, Wand2, Loader2, Store, AlertCircle, MessageCircle, Phone, Radar, FileText } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { API_BASE_URL } from '@/config';
import { ResultCard } from '@/components/email-agent/ResultCard';

interface OpportunitiesTabProps {
  client: any;
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

export default function OpportunitiesTab({ client, timeline, serviceRequests, research, emails = [] }: OpportunitiesTabProps) {
  const { language } = useLanguage();
  // Derive current stage from client status + service requests
  const hasAcceptedProposal = serviceRequests.some(r => r.status === 'Accepted');
  const hasProposal = serviceRequests.some(r => ['Quoted', 'Pending'].includes(r.status));
  const isWon = client?.status === 'Won' || serviceRequests.some(r => r.status === 'In Progress' || r.status === 'Delivered');
  const isLost = client?.status === 'Lost';

  let currentStage = 'Lead';
  if (isWon) currentStage = 'Won';
  else if (isLost) currentStage = 'Lost';
  else if (hasAcceptedProposal) currentStage = 'Negotiation';
  else if (hasProposal) currentStage = 'Proposal';
  else if (serviceRequests.length > 0) currentStage = 'Discovery';
  else if (client?.status === 'Active') currentStage = 'Qualified';

  const dealValue = client?.deal_value ? `$${Number(client.deal_value).toLocaleString()}` : '—';

  // Milestones from timeline
  const milestoneEvents = timeline.filter(e => e.type === 'milestone').slice(0, 5);

  const [activeSubTab, setActiveSubTab] = React.useState('presales');

  // Parse research data
  const [researchData, setResearchData] = React.useState<any>(null);
  React.useEffect(() => {
    if (research?.email_agent_data) {
      try {
        setResearchData(typeof research.email_agent_data === 'string' ? JSON.parse(research.email_agent_data) : research.email_agent_data);
      } catch (e) {
        console.error("Failed to parse research data", e);
      }
    }
  }, [research]);

  const [expandedEmailId, setExpandedEmailId] = React.useState<number | null>(null);

  let eaData: any = null;
  if (research?.email_agent_data) {
    try { eaData = typeof research.email_agent_data === 'string' ? JSON.parse(research.email_agent_data) : research.email_agent_data; } catch (e) {}
  }

  const hasEmailAgentData = Boolean(
    (client?.lead_source === 'Email Agent' || eaData?.company_info || eaData?.draft) && eaData
  );
  
  if (client?.services_offered) {
    try {
      const extractedServices = typeof client.services_offered === 'string' ? JSON.parse(client.services_offered) : client.services_offered;
      if (Array.isArray(extractedServices) && extractedServices.length > 0) {
        if (!eaData) eaData = {};
        // Use extracted services for the portfolio
        eaData.product_portfolio = extractedServices.map(s => ({
          name: s.name || s.title,
          description: s.brief || s.description,
          pricing_tier: s.approx_cost ? `$${s.approx_cost}` : undefined,
          target_customer: s.category || "General"
        }));
      }
    } catch (e) {
      console.error("Failed to parse client.services_offered", e);
    }
  }

  const [isAutoResearching, setIsAutoResearching] = React.useState(false);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [extractResult, setExtractResult] = React.useState<{ count: number; marketplace: number } | null>(null);
  const [extractError, setExtractError] = React.useState<string | null>(null);

  const toErrorMessage = (data: any, fallback: string): string => {
    const d = data?.detail ?? data?.message ?? data?.error ?? data;
    if (typeof d === "string") return d || fallback;
    if (Array.isArray(d)) return d.map((x: any) => x?.msg || x || "").filter(Boolean).join(" · ") || fallback;
    if (d && typeof d === "object") return d.message || d.msg || fallback;
    return fallback;
  };

  const [isGeneratingDraft, setIsGeneratingDraft] = React.useState(false);
  const [isAnalyzingCompetitor, setIsAnalyzingCompetitor] = React.useState(false);

  // Radar Discovery Graph State
  const [radarData, setRadarData] = React.useState<any>(null);
  const [competitorAnalyses, setCompetitorAnalyses] = React.useState<any[]>([]);
  const [loadingRadar, setLoadingRadar] = React.useState(false);

  React.useEffect(() => {
    if (!client?.id) return;
    setLoadingRadar(true);
    fetch(`${API_BASE_URL}/radar/relationships/${client.id}`)
      .then(async res => {
        if (!res.ok) throw new Error("Failed to fetch radar");
        return res.json();
      })
      .then(data => setRadarData(data))
      .catch(e => console.error("Radar fetch error:", e))
      .finally(() => setLoadingRadar(false));
      
    fetch(`${API_BASE_URL}/competitors/${client.id}`)
      .then(async res => {
        if (!res.ok) throw new Error("Failed to fetch competitors");
        return res.json();
      })
      .then(data => setCompetitorAnalyses(data.competitors || []))
      .catch(e => console.error("Competitor fetch error:", e));
  }, [client?.id]);

  const handleGenerateDraft = async () => {
    try {
      setIsGeneratingDraft(true);
      const res = await fetch(`${API_BASE_URL}/clients/${client?.id}/generate-outbound-draft`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(toErrorMessage(errData, "Failed to generate draft."));
      }
      // Draft generated — no auto page refresh
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleRunCompetitorAnalysis = async (domain: string) => {
    try {
      setIsAnalyzingCompetitor(true);
      const res = await fetch(`${API_BASE_URL}/competitors/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client?.id, competitor_domain: domain })
      });
      if (res.ok) {
        const rRes = await fetch(`${API_BASE_URL}/radar/relationships/${client?.id}`);
        const rData = await rRes.json();
        setRadarData(rData);
        
        const cRes = await fetch(`${API_BASE_URL}/competitors/${client?.id}`);
        const cData = await cRes.json();
        setCompetitorAnalyses(cData.competitors || []);
        
        (document.getElementById('compDomain') as HTMLInputElement).value = '';
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(toErrorMessage(errData, "Failed to run competitor analysis."));
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    } finally {
      setIsAnalyzingCompetitor(false);
    }
  };

  const handleAutoResearch = async () => {
    try {
      setIsAutoResearching(true);
      const res = await fetch(`${API_BASE_URL}/clients/${client?.id}/auto-research`, {
        method: 'POST'
      });
      // Research fires in background — no auto-refresh
      setIsAutoResearching(false);
    } catch (e) {
      setIsAutoResearching(false);
    }
  };

  // Removed: polling interval that auto-refreshed the page

  const handleExtractServices = async () => {
    setIsExtracting(true);
    setExtractResult(null);
    setExtractError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${client?.id}/extract-services`, { method: 'POST' });
      const text = await res.text().catch(() => "");
      let data: any = {};
      try { data = JSON.parse(text); } catch(e) {}
      
      if (!res.ok) {
        setExtractError(toErrorMessage(data, 'Failed to extract services'));
      } else if (data.ok === false) {
        setExtractError(toErrorMessage(data, 'Failed to extract services'));
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
      {/* ── New Opportunities Header ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
        <div className="p-6 bg-white dark:bg-zinc-900 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100 dark:text-slate-200 tracking-tight">Sales Pipeline</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 dark:text-slate-400 mt-1">Current deal stage and progression.</p>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 dark:text-slate-500 mb-1">Deal Value</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-500">{dealValue}</span>
            </div>
          </div>
          <StagePipeline current={currentStage} language={language} />
        </div>
        <div className="p-6 bg-white dark:bg-zinc-900 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <ProbabilityBar stage={currentStage} language={language} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-700 dark:border-slate-800 pb-4 overflow-x-auto">
        {[
          { id: 'presales', label: language === 'es' ? 'Investigación IA' : 'AI Research', icon: Brain },
          ...(hasEmailAgentData ? [{ id: 'emails', label: language === 'es' ? 'Correos Salientes' : 'Outbound Emails', icon: Mail }] : []),

        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeSubTab === t.id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
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
                {isAutoResearching ? (language === 'es' ? 'Investigando Empresa...' : 'Researching Company...') : (language === 'es' ? 'Ejecutar investigacion IA' : 'Run AI Research')}
              </button>
              <button
                onClick={handleExtractServices}
                disabled={isExtracting || !(client?.websiteUrl || client?.website)}
                title={!(client?.websiteUrl || client?.website) ? 'Add a website URL first' : 'Extract services from website'}
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
                  Services extracted and added to Marketplace.
                </p>
              </div>
            )}
            {extractError && (
              <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600">{extractError}</p>
              </div>
            )}
            {research ? (
            <div className="space-y-5">
              {/* Executive Verdict / Overview */}
              {(eaData?.executive_verdict || research.company_overview) && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-800/40">
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1.5">⚡ Executive Verdict</p>
                  <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed font-medium">{eaData?.executive_verdict || research.company_overview}</p>
                </div>
              )}

              {eaData?.company_overview && eaData?.executive_verdict && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Company Overview</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">{eaData.company_overview}</p>
                </div>
              )}

              {/* Key Stats Row */}
              {eaData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {eaData.industry && <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 text-center"><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Industry</p><p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{eaData.industry}</p></div>}
                  {eaData.business_model && <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 text-center"><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Model</p><p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{eaData.business_model}</p></div>}
                  {eaData.years_in_business && <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 text-center"><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Years Active</p><p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{eaData.years_in_business}</p></div>}
                  {eaData.geographic_presence && <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 text-center"><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Geography</p><p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{eaData.geographic_presence}</p></div>}
                </div>
              )}

              {/* Opportunities & Weaknesses */}
              {(eaData?.biggest_opportunities?.length > 0 || eaData?.key_weaknesses?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {eaData?.biggest_opportunities?.length > 0 && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1">🚀 Growth Opportunities</p>
                      <ul className="space-y-1.5">
                        {eaData.biggest_opportunities.map((op: string, i: number) => (
                          <li key={i} className="text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">•</span>{op}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {eaData?.key_weaknesses?.length > 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1">⚠️ Key Weaknesses</p>
                      <ul className="space-y-1.5">
                        {eaData.key_weaknesses.map((w: string, i: number) => (
                          <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5"><span className="text-amber-500 mt-0.5 shrink-0">•</span>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Proof Points */}
              {eaData?.strongest_proof_points?.length > 0 && (
                <div className="p-4 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-100 dark:border-violet-900/30">
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-600 mb-3 flex items-center gap-1">⭐ Proof Points</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {eaData.strongest_proof_points.map((p: any, i: number) => (
                      <div key={i} className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-violet-100 dark:border-violet-900/30">
                        <p className="text-[9px] font-black uppercase text-violet-500 mb-1">{p.type}</p>
                        <p className="text-sm font-black text-slate-800 dark:text-zinc-100">{p.value}</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">{p.why_it_matters}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Portfolio */}
              {eaData?.product_portfolio?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">📦 Product / Service Portfolio</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {eaData.product_portfolio.map((p: any, i: number) => (
                      <div key={i} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <p className="text-xs font-black text-slate-800 dark:text-zinc-100">{p.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{p.description}</p>
                        <div className="flex gap-2 mt-1.5">
                          {p.pricing_tier && <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[9px] font-bold text-slate-500">{p.pricing_tier}</span>}
                          {p.target_customer && <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-[9px] font-bold text-blue-600 dark:text-blue-400">{p.target_customer}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitive Landscape */}
              {eaData?.competitive_landscape && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 mb-2 flex items-center gap-1">🥊 Competitive Landscape</p>
                  {eaData.competitive_landscape.competitive_positioning && (
                    <p className="text-xs text-rose-800 dark:text-rose-300 mb-3">{eaData.competitive_landscape.competitive_positioning}</p>
                  )}
                  {eaData.competitive_landscape.main_competitors?.length > 0 && (
                    <div className="space-y-2">
                      {eaData.competitive_landscape.main_competitors.map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-lg">
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">{c.name}</span>
                            {c.how_they_compete && <p className="text-[10px] text-slate-500 dark:text-zinc-400">{c.how_they_compete}</p>}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${c.overlap === 'High' ? 'bg-red-100 text-red-700' : c.overlap === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{c.overlap}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ICPs */}
              {eaData?.ideal_customer_profiles?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">🎯 Ideal Customer Profiles</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {eaData.ideal_customer_profiles.map((icp: any, i: number) => (
                      <div key={i} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <p className="text-xs font-black text-slate-800 dark:text-zinc-100 mb-1">{icp.name}</p>
                        {icp.pain && <p className="text-[10px] text-rose-600 dark:text-rose-400"><span className="font-bold">Pain:</span> {icp.pain}</p>}
                        {icp.desire && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5"><span className="font-bold">Wants:</span> {icp.desire}</p>}
                        {icp.best_message && <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5 italic">"{icp.best_message}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GTM Recommendations */}
              {eaData?.gtm_recommendations && (
                <div className="p-4 bg-sky-50 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900/30">
                  <p className="text-[10px] font-black uppercase tracking-wider text-sky-600 mb-2 flex items-center gap-1">📈 GTM Recommendations</p>
                  {eaData.gtm_recommendations.positioning_statement && (
                    <p className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-3 italic">"{eaData.gtm_recommendations.positioning_statement}"</p>
                  )}
                  {eaData.gtm_recommendations.quick_wins?.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-sky-500 mb-1.5">Quick Wins</p>
                      <ul className="space-y-1">
                        {eaData.gtm_recommendations.quick_wins.map((w: string, i: number) => (
                          <li key={i} className="text-xs text-sky-800 dark:text-sky-300 flex items-start gap-1.5"><span className="text-sky-500 shrink-0">→</span>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* SERP Hawk Opportunity */}
              {eaData?.serphawk_opportunity && (
                <div className="p-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 rounded-xl border border-violet-100 dark:border-violet-900/30">
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-600 mb-2 flex items-center gap-1">💡 SERP Hawk Opportunity</p>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-3xl font-black text-violet-600">{eaData.serphawk_opportunity.fit_score}<span className="text-sm text-violet-400">/10</span></p>
                      <p className="text-[9px] text-violet-500 font-bold uppercase">Fit Score</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-violet-800 dark:text-violet-300">{eaData.serphawk_opportunity.pitch_angle}</p>
                      {eaData.serphawk_opportunity.estimated_deal_value && (
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1">Est. Value: {eaData.serphawk_opportunity.estimated_deal_value}</p>
                      )}
                    </div>
                  </div>
                  {eaData.serphawk_opportunity.recommended_services?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {eaData.serphawk_opportunity.recommended_services.map((s: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-[10px] font-bold text-violet-700 dark:text-violet-300">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fallback plain text fields if no rich eaData */}
              {!eaData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {research.pain_points && (
                    <div className="p-4 bg-white dark:bg-zinc-900 dark:bg-slate-800/80 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-1">Pain Points</p>
                      <p className="text-sm text-slate-600 dark:text-zinc-300 dark:text-slate-300">{research.pain_points}</p>
                    </div>
                  )}
                  {research.competitors && (
                    <div className="p-4 bg-white dark:bg-zinc-900 dark:bg-slate-800/80 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                      <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-1">Competitors</p>
                      <p className="text-sm text-slate-600 dark:text-zinc-300 dark:text-slate-300">{research.competitors}</p>
                    </div>
                  )}
                  {research.business_goals && (
                    <div className="p-4 bg-white dark:bg-zinc-900 dark:bg-slate-800/80 rounded-xl border border-indigo-50 dark:border-indigo-900/30 md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500 mb-1">Business Goals</p>
                      <p className="text-sm text-slate-600 dark:text-zinc-300 dark:text-slate-300">{research.business_goals}</p>
                    </div>
                  )}
                </div>
              )}
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

      {hasEmailAgentData && activeSubTab === 'emails' && (
        <div className="space-y-6">
          
          {/* Research Data (ResultCard & PDF Download) */}
          {(researchData || eaData) && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-black text-slate-800 dark:text-zinc-100 dark:text-white">AI Agent Output</h4>
                {false && <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>AI Investigation Report - ${client?.company_name || 'Client'}</title>
                          <style>
                            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                            h1 { color: #4f46e5; margin-bottom: 8px; font-size: 28px; }
                            .meta { color: #64748b; font-size: 14px; margin-bottom: 40px; }
                            h2 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 40px; font-size: 20px; }
                            h3 { color: #334155; font-size: 16px; margin-top: 24px; }
                            p { color: #334155; font-size: 14px; }
                            ul { font-size: 14px; color: #334155; padding-left: 20px; }
                            li { margin-bottom: 8px; }
                            .badge { display: inline-block; padding: 4px 8px; background: #f1f5f9; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
                            .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-top: 16px; }
                          </style>
                        </head>
                        <body>
                          <h1>AI Deep Investigation Report</h1>
                          <div class="meta">Generated for ${client?.company_name || 'Client'} • ${new Date().toLocaleDateString()}</div>
                          
                          <h2>⚡ Executive Verdict</h2>
                          <p>${eaData?.executive_verdict || research?.company_overview || 'N/A'}</p>
                          
                          <h2>📦 Product & Service Portfolio</h2>
                          ${(eaData?.product_portfolio || []).map((p: any) => `
                            <div class="box">
                              <h3>${p.name}</h3>
                              <p>${p.description}</p>
                              ${p.pricing_tier ? `<span class="badge">${p.pricing_tier}</span>` : ''}
                              ${p.target_customer ? `<span class="badge">${p.target_customer}</span>` : ''}
                            </div>
                          `).join('')}

                          <h2>🎯 Ideal Customer Profiles (ICPs)</h2>
                          ${(eaData?.ideal_customer_profiles || []).map((icp: any) => `
                            <div class="box">
                              <h3>${icp.name}</h3>
                              <p><strong>Pain:</strong> ${icp.pain}</p>
                              <p><strong>Desires:</strong> ${icp.desire}</p>
                              <p><strong>Hook:</strong> <em>"${icp.best_message}"</em></p>
                            </div>
                          `).join('')}

                          <h2>🥊 Competitive Landscape</h2>
                          <p>${eaData?.competitive_landscape?.competitive_positioning || ''}</p>
                          <ul>
                            ${(eaData?.competitive_landscape?.main_competitors || []).map((c: any) => `
                              <li><strong>${c.name}</strong> (${c.overlap} Overlap) - ${c.how_they_compete || ''}</li>
                            `).join('')}
                          </ul>

                          <h2>📈 GTM Recommendations</h2>
                          <p><strong>Positioning:</strong> ${eaData?.gtm_recommendations?.positioning_statement || 'N/A'}</p>
                          <ul>
                            ${(eaData?.gtm_recommendations?.quick_wins || []).map((w: string) => `<li>${w}</li>`).join('')}
                          </ul>

                          <script>
                            setTimeout(() => {
                              window.print();
                            }, 500);
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
                >
                  <FileText size={16} />
                  Download PDF Report
                </button>}
              </div>
              <ResultCard
                historyId="research"
                result={researchData || eaData}
                companyName={client?.company_name || ""}
                companyUrl={client?.website || ""}
                onSendManually={async () => { throw new Error("Not implemented here"); }}
                onSendAutomatically={async () => { throw new Error("Not implemented here"); }}
                onSaveFollowUp={async () => { return true; }}
                onRemove={() => setResearchData(null)}
              />
            </div>
          )}

          {/* Outbound Emails / Round 1 */}
          {emails && emails.length > 0 ? (
        <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-white dark:bg-zinc-900 dark:bg-slate-900 p-6 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-500 rounded-xl text-white">
              <Mail size={16} />
            </div>
            <h4 className="text-lg font-black text-slate-800 dark:text-zinc-100 dark:text-white">Outbound Communications</h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 ml-auto">
              {emails.length} Emails
            </span>
          </div>
          
          <div className="space-y-3">
            {emails.map((em: any, idx: number) => {
              const isExpanded = expandedEmailId === idx;
              let whatsappDraft = '';
              try {
                if (em.draft_json) {
                  const draftData = typeof em.draft_json === 'string' ? JSON.parse(em.draft_json) : em.draft_json;
                  whatsappDraft = draftData.whatsapp_draft || (draftData.outreach && draftData.outreach.whatsapp_draft) || '';
                }
              } catch (e) {}
              
              const phone = client?.phone || '';
              const waLink = phone && whatsappDraft ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappDraft)}` : `https://wa.me/?text=${encodeURIComponent(whatsappDraft)}`;

              return (
              <div key={idx} className="p-4 border border-slate-100 dark:border-zinc-800 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-zinc-950/50 dark:bg-slate-800/30 hover:shadow-md transition-shadow cursor-pointer relative" onClick={() => setExpandedEmailId(isExpanded ? null : idx)}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <Mail size={10} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 dark:text-slate-200 line-clamp-1">{em.subject || 'No Subject'}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-white dark:bg-zinc-900 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-zinc-700 dark:border-slate-700 shrink-0">
                    <Calendar size={10} />
                    {em.sent_at ? new Date(em.sent_at).toLocaleDateString() : 'Draft'}
                  </div>
                </div>
                {em.english_body && (
                  <div className="ml-8">
                    {!isExpanded ? (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {em.english_body}
                      </p>
                    ) : (
                      <div className={`mt-4 grid grid-cols-1 gap-4 ${whatsappDraft ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                        <div className="p-3 bg-white dark:bg-zinc-900 dark:bg-slate-900 border border-slate-200 dark:border-zinc-700 dark:border-slate-700 rounded-xl">
                          <p className="text-[10px] font-black uppercase text-blue-600 mb-2">English</p>
                          <p className="text-xs text-slate-600 dark:text-zinc-300 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{em.english_body}</p>
                        </div>
                        {em.spanish_body && (
                          <div className="p-3 bg-white dark:bg-zinc-900 dark:bg-slate-900 border border-slate-200 dark:border-zinc-700 dark:border-slate-700 rounded-xl">
                            <p className="text-[10px] font-black uppercase text-blue-600 mb-2">Spanish</p>
                            <p className="text-xs text-slate-600 dark:text-zinc-300 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{em.spanish_body}</p>
                          </div>
                        )}
                        {whatsappDraft && (
                          <div className="p-3 bg-white dark:bg-zinc-900 dark:bg-slate-900 border border-slate-200 dark:border-zinc-700 dark:border-slate-700 rounded-xl relative flex flex-col">
                            <p className="text-[10px] font-black uppercase text-emerald-600 mb-2">WhatsApp Draft</p>
                            <p className="text-xs text-slate-600 dark:text-zinc-300 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed mb-10 flex-1">{whatsappDraft}</p>
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 right-3 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase rounded-lg transition-colors flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); }}>
                              <MessageCircle size={12} /> Send
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {em.manual && (
                  <span className="inline-block ml-8 mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider rounded-md">
                    Manual Draft
                  </span>
                )}
                {!isExpanded && (
                  <p className="ml-8 mt-1 text-[10px] text-indigo-500 font-medium">Click to view full email</p>
                )}
              </div>
            )})}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm mt-6 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-800">
            <Mail className="text-blue-500 dark:text-blue-400" size={24} />
          </div>
          <p className="text-slate-800 dark:text-zinc-100 font-bold mb-2">No outbound communications found</p>
          <p className="text-slate-500 dark:text-zinc-400 text-sm max-w-md mb-6">Trigger the AI Email Agent to automatically write highly personalized outreach sequences based on the CRM context.</p>
          <button
            onClick={handleGenerateDraft}
            disabled={isGeneratingDraft}
            className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${isGeneratingDraft ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isGeneratingDraft ? (
              <><Loader2 size={16} className="animate-spin" /> Generating...</>
            ) : (
              <><Wand2 size={16} /> Trigger Email Agent</>
            )}
          </button>
        </div>
      )}
      </div>
      )}



    </div>
  );
}
