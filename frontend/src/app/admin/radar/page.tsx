"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar, MapPin, Search, Loader2, Target, TrendingUp, Users,
  Layers, Building2, Star, Globe, ChevronDown, AlertCircle,
  CheckCircle2, BarChart2, Navigation2, Zap, RefreshCw
} from "lucide-react";
import CompetitorTable from "./components/CompetitorTable";
import { API_BASE_URL } from "@/config";
import DemoLimits from "@/components/DemoLimits";
import { useLanguage } from "@/context/LanguageContext";

import dynamic from 'next/dynamic';
const LeafletRadarMap = dynamic(() => import('@/app/admin/clients/[id]/competitors/RadarMap'), { ssr: false });

interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  reviews?: number;
  phone?: string;
  website?: string;
  types?: string[];
  maps_url?: string;
}

interface Competitor {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
  market_size_score: number;
  team_size_estimate: string;
  overlap_pct: number;
  matched_services: string[];
  missing_services: string[];
  pin_color: string;
  rating?: number;
  reviews?: number;
  maps_url?: string;
  website?: string;
  category?: string;
}

interface RadarResult {
  radar_id: number;
  target: PlaceResult & { category: string };
  radius_km: number;
  competitor_count: number;
  market_density_score: number;
  competitors: Competitor[];
  rankings: {
    nearest: Competitor[];
    largest_market: Competitor[];
    largest_team: Competitor[];
    most_similar: Competitor[];
  };
}

export default function RadarAnalysisPage() {
  const { t } = useLanguage();
  const colorConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    red:    { bg: "bg-red-500/10",    text: "text-red-600 dark:text-red-400",    dot: "bg-red-500",    label: t("radar.direct_competitor") },
    orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500", label: t("radar.strong_competitor") },
    yellow: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500", label: t("radar.moderate") },
    green:  { bg: "bg-green-500/10",  text: "text-green-600 dark:text-green-400",  dot: "bg-green-500",  label: t("radar.weak_competitor") },
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [category, setCategory] = useState("digital marketing agency");
  const [radiusKm, setRadiusKm] = useState(5);
  const [searchLoading, setSearchLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [foundPlace, setFoundPlace] = useState<PlaceResult | null>(null);
  const [radarResult, setRadarResult] = useState<RadarResult | null>(null);
  const [addedPlaceIds, setAddedPlaceIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sourceClientId, setSourceClientId] = useState<number | null>(null);
  const [clients, setClients] = useState<{ id: number; companyName: string }[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Load Google Maps Script (Removed)
  useEffect(() => {
    setMapReady(true);
  }, []);

  // Load clients for source selection
  useEffect(() => {
    fetch(`${API_BASE_URL}/clients?limit=100`)
      .then(r => r.json())
      .then(d => setClients(Array.isArray(d.clients) ? d.clients : []))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setError(null);
    setFoundPlace(null);
    setRadarResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/radar/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, location_hint: locationHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Search failed");
      setFoundPlace(data.place);
    } catch (e: any) {
      setError(e.message || "Search failed");
    }
    setSearchLoading(false);
  };

  const handleAnalyze = async () => {
    if (!foundPlace) return;
    setAnalyzeLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/radar/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: foundPlace.place_id,
          target_name: foundPlace.name,
          target_lat: foundPlace.lat,
          target_lng: foundPlace.lng,
          target_address: foundPlace.address,
          target_phone: foundPlace.phone,
          target_website: foundPlace.website,
          target_rating: foundPlace.rating,
          target_reviews: foundPlace.reviews,
          target_category: category,
          radius_km: radiusKm,
          client_id: sourceClientId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Analysis failed");
      setRadarResult(data);
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    }
    setAnalyzeLoading(false);
  };

  const handleAddToClients = useCallback(async (c: Competitor) => {
    if (!radarResult) return;
    try {
      const res = await fetch(`${API_BASE_URL}/radar/add-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor: c,
          source_client_id: sourceClientId || radarResult.radar_id,
          source_client_name: foundPlace?.name || "Radar Analysis",
          radar_id: radarResult.radar_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setAddedPlaceIds(prev => new Set([...prev, c.place_id || c.name]));
      setAddSuccess(`${c.name} ${t("radar.added_lead")}`);
      setTimeout(() => setAddSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message || "Failed to add lead");
    }
  }, [radarResult, sourceClientId, foundPlace]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-50 dark:bg-zinc-950 p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20">
          <Radar className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-900 dark:text-zinc-100">{t("radar.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-zinc-400">{t("radar.subtitle")}</p>
        </div>
      </div>

      <DemoLimits type="searches" />

      {/* Search Form */}
      <div className="bg-white dark:bg-white dark:bg-zinc-900 border border-slate-200 dark:border-gray-300 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">{t("radar.phase1_title")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1 block">{t("radar.business_name")}</label>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={t("radar.ph_business")}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-gray-300 dark:border-zinc-700 text-slate-800 dark:text-slate-900 dark:text-zinc-100 text-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
              <span>{t("radar.city_region")} <span className="text-red-500">*</span></span>
              <span className="text-[9px] lowercase text-slate-400 dark:text-zinc-500">({t("radar.required_gmaps")})</span>
            </label>
            <input
              value={locationHint}
              onChange={e => setLocationHint(e.target.value)}
              placeholder={t("radar.ph_city")}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 text-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1 block">{t("radar.business_category")}</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder={t("radar.ph_category")}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-gray-300 dark:border-zinc-700 text-slate-800 dark:text-slate-900 dark:text-zinc-100 text-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={searchLoading || !searchQuery.trim() || !locationHint.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95">
            {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {t("radar.find_on_gmaps")}
          </button>
          {foundPlace && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                {RADIUS_OPTIONS.map(r => (
                  <button key={r} onClick={() => setRadiusKm(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${radiusKm === r ? "bg-indigo-600 text-white shadow" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"}`}>
                    {r} km
                  </button>
                ))}
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzeLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-95">
                {analyzeLoading ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
                {analyzeLoading ? t("radar.scanning") : t("radar.run_analysis")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-500">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">{error}</span>
          </motion.div>
        )}
        {addSuccess && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-500">
            <CheckCircle2 size={16} />
            <span className="text-sm font-medium">{addSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Found Place Card */}
      <AnimatePresence>
        {foundPlace && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-white dark:bg-zinc-900 border border-indigo-500/30 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">{t("radar.target_located")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                  {foundPlace.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-900 dark:text-zinc-100">{foundPlace.name}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-zinc-400 mt-0.5">{foundPlace.address}</p>
                  {foundPlace.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={11} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs text-amber-400 font-bold">{foundPlace.rating}</span>
                      <span className="text-xs text-slate-400">({foundPlace.reviews || 0} {t("radar.reviews")})</span>
                    </div>
                  )}
                </div>
              </div>
              {[
                { label: t("radar.latitude"), value: foundPlace.lat?.toFixed(6), icon: Navigation2 },
                { label: t("radar.longitude"), value: foundPlace.lng?.toFixed(6), icon: Navigation2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-gray-300 dark:border-zinc-700">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={10} className="text-slate-400" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                  </div>
                  <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-900 dark:text-zinc-100">{value}</p>
                </div>
              ))}
            </div>
            {foundPlace.place_id && (
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                  <span className="text-[9px] text-slate-500 dark:text-slate-500 dark:text-zinc-400 uppercase font-bold">{t("radar.place_id")} </span>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-700 dark:text-zinc-300">{foundPlace.place_id}</span>
                </div>
                {foundPlace.maps_url && (
                  <a href={foundPlace.maps_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-colors">
                    <MapPin size={11} /> {t("radar.view_on_maps")}
                  </a>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Radar Results */}
      <AnimatePresence>
        {radarResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t("radar.competitors_found"), value: radarResult.competitor_count, icon: Building2, color: "text-indigo-500" },
                { label: t("radar.market_density"), value: `${radarResult.market_density_score}/100`, icon: BarChart2, color: "text-violet-500" },
                { label: t("radar.radius_scanned"), value: `${radarResult.radius_km} km`, icon: Target, color: "text-blue-500" },
                { label: t("radar.analysis_id"), value: `#${radarResult.radar_id}`, icon: Zap, color: "text-amber-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white dark:bg-white dark:bg-zinc-900 border border-slate-200 dark:border-gray-300 dark:border-zinc-700 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className={color} />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                  </div>
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-900 dark:text-zinc-100">{value}</p>
                </div>
              ))}
            </div>

            {/* Map + Legend */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Map */}
              <div className="lg:col-span-3 bg-white dark:bg-white dark:bg-zinc-900 border border-slate-200 dark:border-gray-300 dark:border-zinc-700 rounded-2xl shadow-sm overflow-hidden" style={{ minHeight: "520px" }}>
                {mapReady ? (
                  <div id="radar-google-map" className="w-full h-full" style={{ minHeight: "520px" }}>
                    <RadarMapLoader target={radarResult.target} competitors={radarResult.competitors} radiusKm={radarResult.radius_km} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <Loader2 className="animate-spin mr-2" size={20} /> {t("radar.loading_map")}...
                  </div>
                )}
              </div>

              {/* Legend + Source */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-white dark:bg-zinc-900 border border-slate-200 dark:border-gray-300 dark:border-zinc-700 rounded-2xl p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 dark:text-zinc-400 mb-3">{t("radar.pin_legend")}</p>
                  <div className="space-y-2.5">
                    {Object.entries(colorConfig).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-2.5">
                        <div className={`w-3 h-3 rounded-full ${cfg.dot} shrink-0`} />
                        <span className="text-xs text-slate-600 dark:text-slate-700 dark:text-zinc-300">{cfg.label}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
                      <span className="text-xs text-slate-600 dark:text-slate-700 dark:text-zinc-300">{t("radar.target_business")}</span>
                    </div>
                  </div>
                </div>

                {/* Source Client Attribution */}
                <div className="bg-white dark:bg-white dark:bg-zinc-900 border border-slate-200 dark:border-gray-300 dark:border-zinc-700 rounded-2xl p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 dark:text-zinc-400 mb-3">{t("radar.attribution_source")}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-zinc-400 mb-2">{t("radar.attribution_desc")}</p>
                  <select
                    value={sourceClientId || ""}
                    onChange={e => setSourceClientId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-gray-300 dark:border-zinc-700 text-slate-800 dark:text-slate-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">{t("radar.no_attribution")}</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>

                {/* Market Summary */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-4 text-white shadow-lg">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">{t("radar.market_overview")}</p>
                  <p className="text-3xl font-black mb-1">{radarResult.competitors.filter(c => c.pin_color === "red" || c.pin_color === "orange").length}</p>
                  <p className="text-xs text-indigo-200">{t("radar.strong_direct_in_radius")} {radarResult.radius_km}km</p>
                </div>
              </div>
            </div>

            {/* Competitor Rankings Table */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">{t("radar.rankings_title")}</p>
              <CompetitorTable
                rankings={radarResult.rankings}
                onAddToClients={handleAddToClients}
                addedPlaceIds={addedPlaceIds}
              />
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!foundPlace && !searchLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-violet-600/20 border border-indigo-500/20 flex items-center justify-center mb-6">
            <Radar className="w-10 h-10 text-indigo-500 opacity-60" />
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-900 dark:text-zinc-100 mb-2">{t("radar.start_scan")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-zinc-400 max-w-md">
            {t("radar.start_scan_desc")}
          </p>
        </div>
      )}
    </div>
  );
}

// Lazy-loaded map component using vanilla Google Maps API
function RadarMapLoader({ target, competitors, radiusKm }: { target: any; competitors: any[]; radiusKm: number }) {
  return <LeafletRadarMap clientLat={target.lat} clientLng={target.lng} competitors={competitors} clientName={target.name} />;
}
