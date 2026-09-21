'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, Star, Zap, Users, CheckCircle, ArrowRight, 
  Sparkles, Shield, Clock, ChevronRight, ExternalLink, FileText, Send,
  TrendingUp, Award, Gem
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { fetchWithCache } from '@/lib/cache';
import PageGuide from '@/components/PageGuide';
import { useRole } from '@/context/RoleContext';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { label: string; color: string; border: string; dot: string; glow: string }> = {
  Pending:       { label: 'Under Review',   color: 'text-amber-500',   border: 'border-amber-500/25',   dot: 'bg-amber-500',   glow: '' },
  Quoted:        { label: 'Quote Ready',    color: 'text-amber-400',   border: 'border-amber-400/30',   dot: 'bg-amber-400',   glow: '' },
  Accepted:      { label: 'Active',         color: 'text-emerald-500', border: 'border-emerald-500/25', dot: 'bg-emerald-500', glow: '' },
  Delivered:     { label: 'Delivered',      color: 'text-stone-400',   border: 'border-stone-500/25',   dot: 'bg-stone-400',   glow: '' },
  'In Progress': { label: 'In Progress',    color: 'text-sky-400',     border: 'border-sky-500/25',     dot: 'bg-sky-400',     glow: '' },
};

export default function ClientStorePage() {
  const { t } = useLanguage();
  const { role, email } = useRole();
  const isClient = role === 'Client';
  const [services, setServices] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'store' | 'requests'>('store');
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  // Fetch services (cached) — does NOT cache my-requests so quotes show immediately
  const loadServices = async () => {
    const svcsUrl = `${API_BASE_URL}/services`;
    await fetchWithCache<{ services: any[] }>(
      svcsUrl,
      (data) => { setServices(data.services || []); setLoading(false); },
      60_000
    ).catch(() => setLoading(false));
  };

  // Always fetch my-requests fresh — no cache so quotes appear immediately
  const loadRequests = async () => {
    if (!email) return;
    try {
      const res = await fetch(`${API_BASE_URL}/services/my-requests?client_email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setMyRequests(data.requests || []);
    } catch (e) { console.error('loadRequests error:', e); }
  };

  const loadData = async () => {
    await Promise.all([loadServices(), loadRequests()]);
  };

  // Initial load when email is available
  useEffect(() => {
    if (email) loadData();
  }, [email]);

  // Refresh requests every time user switches to the My Requests tab
  useEffect(() => {
    if (tab === 'requests' && email) loadRequests();
  }, [tab, email]);

  const alreadyRequested = (svcId: number) => myRequests.some(r => r.service_name === services.find(s => s.id === svcId)?.name);

  const handleRequest = async (serviceId: number) => {
    if (!email) {
      showToast(t('store.error_login'));
      return;
    }
    setRequestingId(serviceId);
    try {
      const res = await fetch(`${API_BASE_URL}/services/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, clientEmail: email })
      });
      if (res.ok) { showToast(t('store.request_sent')); await loadRequests(); setTab('requests'); }
    } catch (e) { console.error(e); }
    setRequestingId(null);
  };

  const handleAcceptQuote = async (requestId: number) => {
    setAcceptingId(requestId);
    try {
      const res = await fetch(`${API_BASE_URL}/services/accept-quote/${requestId}`, { method: 'POST' });
      if (res.ok) { showToast(t('store.quote_accepted')); await loadRequests(); window.dispatchEvent(new Event('refresh-messages')); }
    } catch (e) { console.error(e); }
    setAcceptingId(null);
  };

  const quotedCount = myRequests.filter(r => r.status === 'Quoted').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-32 relative overflow-x-hidden">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -28, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -28, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-xl font-bold text-sm
              bg-emerald-600 text-white shadow-lg">
            <CheckCircle className="w-5 h-5 shrink-0" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════ HERO — Editorial Style ══════════════════ */}
      <section className="relative min-h-[70vh] flex items-center bg-zinc-950 overflow-hidden">
        {/* Architectural light beam */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
          <div className="absolute top-[10%] left-[25%] w-[500px] h-[700px] bg-gradient-to-br from-amber-700/20 via-amber-600/8 to-transparent rotate-[-25deg] blur-[2px]" />
          <div className="absolute top-[5%] left-[30%] w-[200px] h-[800px] bg-gradient-to-b from-amber-500/12 via-amber-400/4 to-transparent rotate-[-20deg] blur-[1px]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'}} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16 py-24 md:py-32 w-full">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-16">
            {/* Left — Editorial copy */}
            <div className="space-y-8 max-w-2xl">
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="text-amber-500/80 text-[11px] font-bold tracking-[0.35em] uppercase">
                {t('store.growth_services')}
              </motion.p>
              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 60, damping: 20 }}
                className="text-6xl md:text-8xl font-black text-white tracking-[-0.02em] leading-[0.85]"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                {t('store.hero_title_1')}{'\n'}
                <span className="text-amber-500">{t('store.hero_title_2')}</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="text-stone-400 text-lg max-w-lg leading-relaxed font-medium">
                {t('store.hero_desc')}
              </motion.p>

              {/* Social proof */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="flex items-center gap-5">
                <div className="flex -space-x-3">
                  {['from-amber-500 to-amber-600','from-emerald-500 to-teal-600','from-stone-500 to-stone-600','from-amber-600 to-yellow-600'].map((g, i) => (
                    <div key={i} className={`w-10 h-10 bg-gradient-to-br ${g} rounded-full border-2 border-zinc-950 flex items-center justify-center text-xs font-black shadow-lg`}>
                      {String.fromCharCode(65+i)}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm text-stone-500 font-medium">
                    {t('store.trusted_by')} <span className="text-white font-black">100+</span> {t('store.businesses_worldwide')}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-amber-500 fill-amber-500" />)}
                    <span className="text-stone-600 text-xs ml-1">{t('store.rating')}</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right — Account card */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
              className="shrink-0 lg:mt-6 w-72">
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-7 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
                      <Gem className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">{t('store.your_account')}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="h-px bg-white dark:bg-zinc-900/5" />

                <div className="space-y-4">
                  {[
                    { label: t('store.total_requests'), value: myRequests.length, color: 'text-white' },
                    { label: t('store.new_quotes'), value: quotedCount, color: quotedCount > 0 ? 'text-amber-500' : 'text-white' },
                    { label: t('store.active_services'), value: myRequests.filter(r => r.status === 'Accepted' || r.status === 'In Progress').length, color: 'text-emerald-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-sm text-stone-500 font-medium">{label}</span>
                      <span className={`text-2xl font-black tabular-nums ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-white dark:bg-zinc-900/5" />

                <button onClick={() => setTab('requests')}
                  className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all
                    bg-amber-600 hover:bg-amber-500 text-white">
                  {t('store.view_my_requests')} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>

          <div className="mt-8">
            <PageGuide
              pageKey="store"
              variant="dark"
              title={t('store.guide_title')}
              description={t('store.guide_desc')}
              steps={[
                { icon: '🛒', text: t('store.guide_s1') },
                { icon: '📝', text: t('store.guide_s2') },
                { icon: '📩', text: t('store.guide_s3') },
                { icon: '✅', text: t('store.guide_s4') },
              ]}
            />
          </div>

          {/* ── Tabs ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="mt-14 flex items-center gap-1.5 p-1.5 rounded-xl w-fit bg-white dark:bg-zinc-900/[0.03] border border-white/5">
            {[
              { key: 'store', label: t('store.tab_catalog'), icon: ShoppingBag },
              { key: 'requests', label: `${t('store.tab_requests')}${quotedCount > 0 ? ` · ${quotedCount} ${t('store.tab_new')}` : ''}`, icon: FileText },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key as any)}
                className={`relative flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-all duration-300 ${
                  tab === key
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-500 hover:text-stone-300 hover:bg-white dark:bg-zinc-900/5'
                }`}>
                <Icon className="w-4 h-4" /> {label}
                {key === 'requests' && quotedCount > 0 && tab !== 'requests' && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-black flex items-center justify-center text-black dark:text-white">{quotedCount}</span>
                )}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════ CONTENT ══════════════════ */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
        <AnimatePresence mode="wait">

          {/* ── STORE TAB ── */}
          {tab === 'store' && (
            <motion.div key="store" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-zinc-900 border border-white/5 rounded-2xl h-[400px] animate-pulse" />
                  ))}
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-32">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                    <ShoppingBag className="w-9 h-9 text-stone-600" />
                  </div>
                  <h3 className="text-2xl font-black text-stone-500" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{t('store.no_services')}</h3>
                  <p className="text-stone-600 mt-2">{t('store.no_services_desc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {services.map((svc, i) => {
                    const requested = alreadyRequested(svc.id);
                    return (
                      <motion.div key={svc.id}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.5 }}
                        whileHover={{ y: -4 }}
                        className="group relative flex flex-col rounded-2xl overflow-hidden
                          bg-zinc-900 border border-white/5
                          hover:border-amber-600/30
                          transition-all duration-500">

                        {/* ── Card image ── */}
                        <div className="h-52 relative overflow-hidden shrink-0">
                          {svc.image_url ? (
                            <img src={svc.image_url} alt={svc.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-850 to-zinc-900 flex items-center justify-center">
                              <Zap className="w-14 h-14 text-stone-700" />
                            </div>
                          )}
                          {/* gradient fade */}
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/30 to-transparent" />

                          {/* price badge */}
                          <div className="absolute top-4 right-4 z-20">
                            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-lg font-black text-sm
                              bg-amber-600 text-white">
                              ${svc.cost?.toFixed(2)}
                            </span>
                          </div>

                          {/* title overlay */}
                          <div className="absolute bottom-4 left-5 right-5 z-20">
                            <h2 className="text-xl font-black text-white leading-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{svc.name}</h2>
                          </div>
                        </div>

                        {/* ── Card body ── */}
                        <div className="flex-1 flex flex-col gap-5 p-6">
                          <p className="text-stone-400 text-sm leading-relaxed">{svc.intro_description}</p>

                          {svc.past_results && (
                            <div className="p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 space-y-1.5">
                              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                                <TrendingUp className="w-3 h-3" /> {t('store.proven_results')}
                              </p>
                              <p className="text-sm text-stone-300 italic leading-relaxed">"{svc.past_results}"</p>
                            </div>
                          )}

                          {/* divider + CTA */}
                          <div className="mt-auto pt-5 border-t border-white/5">
                            {requested ? (
                              <div className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-black
                                bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                <CheckCircle className="w-4 h-4" /> {t('store.already_requested')}
                              </div>
                            ) : (
                              <button onClick={() => handleRequest(svc.id)} disabled={requestingId === svc.id}
                                className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-300
                                  bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50">
                                {requestingId === svc.id ? (
                                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t('store.sending')}</>
                                ) : (
                                  <><Send className="w-4 h-4" /> {t('store.request_service')}</>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── MY REQUESTS TAB ── */}
          {tab === 'requests' && (
            <motion.div key="requests" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}
              className="space-y-4">
              {myRequests.length === 0 ? (
                <div className="text-center py-32">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                    <FileText className="w-9 h-9 text-stone-600" />
                  </div>
                  <h3 className="text-2xl font-black text-stone-500" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{t('store.no_requests')}</h3>
                  <p className="text-stone-600 mt-2">{t('store.no_requests_desc')}</p>
                  <button onClick={() => setTab('store')}
                    className="mt-8 px-8 py-3.5 rounded-xl font-bold text-sm transition-all bg-amber-600 hover:bg-amber-500 text-white">
                    {t('store.explore_services')}
                  </button>
                </div>
              ) : (
                myRequests.map((req, i) => {
                  const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG['Pending'];
                  const isQuoted = req.status === 'Quoted';
                  return (
                    <motion.div key={req.id}
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.45 }}
                      className={`relative bg-zinc-900 border rounded-2xl overflow-hidden transition-all duration-300
                        ${isQuoted ? 'border-amber-600/30' : 'border-white/5'}`}>

                      {/* top accent line for Quoted */}
                      {isQuoted && (
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                      )}

                      {/* ── Header ── */}
                      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 shrink-0 rounded-xl bg-amber-600/10 border border-amber-600/20 flex items-center justify-center">
                            <Award className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{req.service_name}</h3>
                            <p className="text-stone-500 text-sm font-medium mt-0.5">
                              {!isClient && `${req.handler_role} ${t('store.handler_team_suffix')} `}
                              {t('store.requested_on')} {new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            {!isClient && req.assigned_employee && (
                              <p className="text-amber-500 text-sm font-bold mt-1.5 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" /> {t('store.handler_label')} {req.assigned_employee}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* status pill */}
                        <div className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-black bg-white dark:bg-zinc-900/[0.03] ${cfg.border} ${cfg.color}`}>
                          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          {t(`store.status_${req.status.toLowerCase().replace(/\s+/g, '_')}`) || cfg.label}
                        </div>
                      </div>

                      {/* ── Quote card ── */}
                      {isQuoted && (
                        <div className="mx-6 mb-6 rounded-xl overflow-hidden border border-amber-600/20 bg-zinc-800/50">
                          <div className="p-6 space-y-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
                                  <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="font-black text-white text-base">{t('store.your_quote')}</p>
                                  <p className="text-stone-500 text-xs font-medium">{t('store.review_accept')}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-4xl font-black text-amber-500"
                                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                  ${req.quoted_amount?.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {req.quote_message && (
                              <div className="p-4 rounded-xl bg-zinc-900 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-2">{t('store.message_from_team')}</p>
                                <p className="text-stone-300 text-sm leading-relaxed">{req.quote_message}</p>
                              </div>
                            )}

                            {req.team_info && (
                              <div className="p-4 rounded-xl bg-zinc-900 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2 flex items-center gap-1.5">
                                  <Users className="w-3 h-3" /> {t('store.your_dedicated_team')}
                                </p>
                                <p className="text-stone-300 text-sm leading-relaxed">{req.team_info}</p>
                              </div>
                            )}

                            {req.quote_doc_url && (
                              <a href={req.quote_doc_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/5 bg-zinc-900 hover:bg-zinc-800 transition-colors group/doc">
                                <div className="w-9 h-9 rounded-lg bg-amber-600/15 border border-amber-600/25 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-amber-500" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-white">{t('store.view_proposal')}</p>
                                  <p className="text-xs text-stone-500">{t('store.click_download')}</p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-stone-600 group-hover/doc:text-stone-400 transition-colors" />
                              </a>
                            )}

                            <button onClick={() => handleAcceptQuote(req.id)} disabled={acceptingId === req.id}
                              className="w-full py-4 rounded-xl font-black text-base flex items-center justify-center gap-3 transition-all duration-300
                                bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50">
                              {acceptingId === req.id ? (
                                <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t('store.processing')}</>
                              ) : (
                                <><CheckCircle className="w-5 h-5" /> {t('store.accept_start')}</>
                              )}
                            </button>
                            <p className="text-center text-xs text-stone-600 font-medium">{t('store.accept_confirm')}</p>
                          </div>
                        </div>
                      )}

                      {req.status === 'Accepted' && (
                        <div className="mx-6 mb-6 flex items-center gap-4 px-5 py-4 rounded-xl
                          bg-emerald-500/[0.06] border border-emerald-500/15">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                            <Shield className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-emerald-500 text-sm">{t('store.service_active')}</p>
                            <p className="text-stone-500 text-xs mt-0.5">{t('store.service_active_desc')}</p>
                          </div>
                          <Link href="/messages"
                            className="shrink-0 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all
                              bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-500">
                            {t('store.open_chat')} <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      )}

                      {req.status === 'Pending' && (
                        <div className="mx-6 mb-6 flex items-center gap-4 px-5 py-4 rounded-xl
                          bg-amber-500/[0.06] border border-amber-500/15">
                          <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                            <Clock className="w-5 h-5 text-amber-500" />
                          </div>
                          <p className="text-stone-400 text-sm font-medium leading-relaxed">
                            {t('store.reviewing_request')}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
