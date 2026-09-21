"use client";

import React, { useEffect, useState, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Radar, Loader2, Target, Building2, MapPin, Star,
  CheckCircle2, AlertCircle, BarChart2, Navigation2, Zap
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import CompetitorTable from '@/app/admin/radar/components/CompetitorTable';
import { useLanguage } from '@/context/LanguageContext';

import dynamic from 'next/dynamic';
const LeafletRadarMap = dynamic(() => import('@/app/admin/clients/[id]/competitors/RadarMap'), { ssr: false });

function RadarMapLoader({ target, competitors, radiusKm }: { target: any; competitors: any[]; radiusKm: number }) {
  return <LeafletRadarMap clientLat={target.lat} clientLng={target.lng} competitors={competitors} clientName={target.name} />;
}

export default function CompetitorRadarPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = use(params);
  
  const [client, setClient] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState<'fetching_client' | 'locating_target' | 'scanning_radar' | 'complete' | 'error'>('fetching_client');
  const [error, setError] = useState<string | null>(null);
  
  const [foundPlace, setFoundPlace] = useState<any>(null);
  const [radarResult, setRadarResult] = useState<any>(null);
  const [addedPlaceIds, setAddedPlaceIds] = useState<Set<string>>(new Set());
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const autoFlowRanRef = useRef(false);

  useEffect(() => {
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!id) return;
    const runFullRadarFlow = async (overrideQuery?: string) => {
      try {
        setLoadingStep('fetching_client');
        let clientData = client;
        if (!clientData) {
          const res = await fetch(`${API_BASE_URL}/clients/${id}`);
          if (!res.ok) throw new Error("Failed to load client.");
          const data = await res.json();
          clientData = data.client;
          setClient(clientData);
        }

        // Step 1: Locate Target on Google Maps
        setLoadingStep('locating_target');
        const query = overrideQuery || `${clientData.companyName || clientData.projectName} ${clientData.websiteUrl || clientData.website || ''} ${clientData.address || clientData.city || ''}`.trim();
        const searchRes = await fetch(`${API_BASE_URL}/radar/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            query, 
            location_hint: clientData.city,
            company_name: clientData.companyName || clientData.projectName,
            website: clientData.websiteUrl || clientData.website
          }),
        });
        
        if (!searchRes.ok) {
          const errData = await searchRes.json().catch(() => null);
          const msg = errData?.detail?.message || errData?.detail || "Failed to pinpoint client on Google Maps.";
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
        const searchData = await searchRes.json();
        setFoundPlace(searchData.place);

        // Step 2: Scan Radius
        setLoadingStep('scanning_radar');
        const analyzeRes = await fetch(`${API_BASE_URL}/radar/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            place_id: searchData.place.place_id,
            target_name: searchData.place.name,
            target_lat: searchData.place.lat,
            target_lng: searchData.place.lng,
            target_address: searchData.place.address,
            target_phone: searchData.place.phone,
            target_website: searchData.place.website,
            target_rating: searchData.place.rating,
            target_reviews: searchData.place.reviews,
            target_category: clientData.industry || "Business",
            radius_km: 10, // Default to 10km scan
            client_id: parseInt(id),
          }),
        });

        if (!analyzeRes.ok) {
          const errData = await analyzeRes.json().catch(() => null);
          const msg = errData?.detail?.message || errData?.detail || "Failed to analyze competitors.";
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
        const analyzeData = await analyzeRes.json();
        setRadarResult(analyzeData);
        setLoadingStep('complete');

      } catch (e: any) {
        console.error(e);
        setError(e.message || "An error occurred.");
        setLoadingStep('error');
      }
    };

    if (id && loadingStep === 'fetching_client' && !autoFlowRanRef.current) {
      autoFlowRanRef.current = true;
      runFullRadarFlow();
    }
  }, [id, client, loadingStep]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;
    setLoadingStep('locating_target');
    setError(null);
  };

  useEffect(() => {
    // If the manual search triggered a re-evaluation
    if (loadingStep === 'locating_target' && manualQuery && client) {
        // We reuse the effect logic above by extracting the function out, but let's just do it directly:
        const doManual = async () => {
            try {
                const searchRes = await fetch(`${API_BASE_URL}/radar/search`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ query: manualQuery, location_hint: client.city }),
                });
                if (!searchRes.ok) {
                  const errData = await searchRes.json().catch(() => null);
                  const msg = errData?.detail?.message || errData?.detail || "Failed to pinpoint on Google Maps.";
                  throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
                }
                const searchData = await searchRes.json();
                setFoundPlace(searchData.place);
                
                setLoadingStep('scanning_radar');
                const analyzeRes = await fetch(`${API_BASE_URL}/radar/analyze`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    place_id: searchData.place.place_id,
                    target_name: searchData.place.name,
                    target_lat: searchData.place.lat,
                    target_lng: searchData.place.lng,
                    target_address: searchData.place.address,
                    target_phone: searchData.place.phone,
                    target_website: searchData.place.website,
                    target_rating: searchData.place.rating,
                    target_reviews: searchData.place.reviews,
                    target_category: client.industry || "Business",
                    radius_km: 10,
                    client_id: parseInt(id),
                  }),
                });
                if (!analyzeRes.ok) {
                  const errData = await analyzeRes.json().catch(() => null);
                  const msg = errData?.detail?.message || errData?.detail || "Failed to analyze competitors.";
                  throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
                }
                const analyzeData = await analyzeRes.json();
                setRadarResult(analyzeData);
                setLoadingStep('complete');
            } catch(e: any) {
                setError(e.message || "Manual search failed");
                setLoadingStep('error');
            }
        };
        doManual();
    }
  }, [loadingStep, manualQuery, client, id]);

  const handleAddToClients = useCallback(async (c: any) => {
    if (!radarResult || !client) return;
    try {
      const res = await fetch(`${API_BASE_URL}/radar/add-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor: c,
          source_client_id: parseInt(id),
          source_client_name: client.companyName || "Radar Analysis",
          radar_id: radarResult.radar_id,
          websiteUrl: c.website,
          phone: c.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setAddedPlaceIds(prev => new Set([...prev, c.place_id || c.name]));
      setAddSuccess(`${c.name} added to CRM!`);
      setTimeout(() => setAddSuccess(null), 4000);
    } catch (e: any) {
      console.error(e);
    }
  }, [radarResult, id, client]);

  const colorConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    red:    { bg: "bg-red-500/10",    text: "text-red-400",    dot: "bg-red-500",    label: t("admin_client_competitors.direct_competitor") },
    orange: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-500", label: t("admin_client_competitors.strong_competitor") },
    yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-500", label: t("admin_client_competitors.moderate") },
    green:  { bg: "bg-green-500/10",  text: "text-green-400",  dot: "bg-green-500",  label: t("admin_client_competitors.weak_competitor") },
  };

  return (
    <div className="max-w-[1500px] mx-auto space-y-8 pb-20 dark">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-white transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 flex items-center gap-3">
            {t("admin_client_competitors.title")} <Radar className="w-7 h-7 text-indigo-400" />
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 font-medium text-sm mt-1">
            {t("admin_client_competitors.subtitle")} {client?.companyName || t("admin_client_competitors.target_client")}
          </p>
        </div>
      </div>

      {/* Loading States */}
      {loadingStep !== 'complete' && loadingStep !== 'error' && (
        <div className="h-[60vh] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-[2rem] flex flex-col items-center justify-center p-10 text-center shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-900 to-zinc-900"></div>
          
          <div className="relative mb-8 z-10">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="w-24 h-24 rounded-full border-4 border-gray-200 dark:border-zinc-800 border-t-indigo-500 animate-spin flex items-center justify-center relative">
              <Radar className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mb-2 relative z-10">
            {loadingStep === 'fetching_client' && t("admin_client_competitors.loading_client")}
            {loadingStep === 'locating_target' && t("admin_client_competitors.locating_target")}
            {loadingStep === 'scanning_radar' && t("admin_client_competitors.scanning_radius")}
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 max-w-md relative z-10">
            {t("admin_client_competitors.ai_mapping_desc")}
          </p>
        </div>
      )}

      {/* Error State with Fallback */}
      {loadingStep === 'error' && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-8 max-w-2xl mx-auto shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mb-2">{t("admin_client_competitors.target_not_found")}</h2>
            <p className="text-slate-500 dark:text-zinc-400 mb-6 max-w-md">
              {error && error !== "An error occurred." && error !== "Manual search failed" ? (
                error
              ) : (
                <>{t("admin_client_competitors.not_found_desc")} <strong>{client?.companyName}</strong> {t("admin_client_competitors.not_found_desc_2")}</>
              )}
            </p>
            
            <div className="w-full bg-black/40 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-4 text-left">{t("admin_client_competitors.manual_override")}</h3>
              <form onSubmit={handleManualSearch} className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  value={manualQuery}
                  onChange={e => setManualQuery(e.target.value)}
                  placeholder={t("admin_client_competitors.ph_manual_query")} 
                  className="flex-1 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition-colors whitespace-nowrap">
                  {t("admin_client_competitors.force_search")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      <AnimatePresence>
        {addSuccess && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-24 right-8 z-50 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 shadow-xl backdrop-blur-md">
            <CheckCircle2 size={16} />
            <span className="text-sm font-bold">{addSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis Results */}
      {loadingStep === 'complete' && radarResult && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("admin_client_competitors.competitors_discovered"), value: radarResult.competitor_count, icon: Building2, color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { label: t("admin_client_competitors.market_density"), value: `${radarResult.market_density_score}/100`, icon: BarChart2, color: "text-violet-400", bg: "bg-violet-500/10" },
              { label: t("admin_client_competitors.radius_scanned"), value: `${radarResult.radius_km} km`, icon: Target, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: t("admin_client_competitors.exact_coordinates"), value: t("admin_client_competitors.verified"), icon: MapPin, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}><stat.icon size={16} className={stat.color} /></div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{stat.label}</p>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-zinc-100">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Map Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden" style={{ minHeight: "500px" }}>
              {mapReady ? (
                <RadarMapLoader target={radarResult.target} competitors={radarResult.competitors} radiusKm={radarResult.radius_km} />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  <Loader2 className="animate-spin mr-2" size={20} /> {t("admin_client_competitors.loading_maps")}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Target Identification */}
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">{t("admin_client_competitors.target_identified")}</p>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-lg shadow-indigo-500/20">
                    {foundPlace?.name?.charAt(0) || "T"}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-zinc-100">{foundPlace?.name}</h2>
                    <p className="text-xs text-zinc-500 mt-1">{foundPlace?.address}</p>
                    {foundPlace?.rating && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Star size={10} className="text-amber-400 fill-amber-400" />
                        <span className="text-[10px] text-amber-400 font-bold">{foundPlace.rating}</span>
                        <span className="text-[10px] text-zinc-600">({foundPlace.reviews} {t("admin_client_competitors.reviews")})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pin Legend */}
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">{t("admin_client_competitors.pin_legend")}</p>
                <div className="space-y-3">
                  {Object.entries(colorConfig).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${cfg.dot} shadow-sm shadow-${key}-500/50 shrink-0`} />
                      <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">{cfg.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-zinc-800">
                    <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50 shrink-0" />
                    <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">{t("admin_client_competitors.target_business")}</span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">{t("admin_client_competitors.crm_attribution")}</p>
                <p className="text-sm font-bold mb-3 leading-snug">{t("admin_client_competitors.attribution_desc")} <strong>{client?.companyName}</strong> {t("admin_client_competitors.attribution_desc_2")}</p>
                <div className="flex items-center gap-2 text-xs font-black text-white/90 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-md">
                   <Zap size={14} className="text-yellow-400" /> {t("admin_client_competitors.active")}
                </div>
              </div>
            </div>
          </div>

          {/* Deep Analytics Tables */}
          <div className="pt-4">
             <div className="flex items-center gap-3 mb-6 px-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><Building2 className="w-5 h-5" /></div>
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100">{t("admin_client_competitors.rankings_title")}</h3>
             </div>
             
             {/* Using the shared CompetitorTable which handles the 4 sorting modes automatically */}
            <div className="[&>div]:bg-white dark:[&>div]:bg-zinc-900 [&>div]:border-gray-200 dark:[&>div]:border-zinc-800 [&_th]:bg-gray-50 dark:[&_th]:bg-zinc-950 [&_th]:border-gray-200 dark:[&_th]:border-zinc-800 [&_th]:text-zinc-500 [&_td]:border-gray-200 dark:[&_td]:border-zinc-800 [&_td]:text-slate-700 dark:[&_td]:text-zinc-300 [&_button:not(.bg-indigo-600)]:bg-white dark:[&_button:not(.bg-indigo-600)]:bg-zinc-800 [&_button:not(.bg-indigo-600)]:border-gray-300 dark:[&_button:not(.bg-indigo-600)]:border-zinc-700 hover:[&_button:not(.bg-indigo-600)]:bg-gray-50 dark:hover:[&_button:not(.bg-indigo-600)]:bg-zinc-700 [&_button.bg-indigo-600]:text-white [&_button.bg-indigo-600]:border-transparent">
               <CompetitorTable
                  rankings={radarResult.rankings}
                  onAddToClients={handleAddToClients}
                  addedPlaceIds={addedPlaceIds}
               />
             </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
