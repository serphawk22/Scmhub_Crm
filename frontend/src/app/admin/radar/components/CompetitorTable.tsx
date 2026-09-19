'use client';
import React, { useState } from 'react';
import { MapPin, TrendingUp, Users, Layers, ExternalLink, Plus, Check, Star, Globe, Info } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

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

interface CompetitorTableProps {
  rankings: {
    nearest: Competitor[];
    largest_market: Competitor[];
    largest_team: Competitor[];
    most_similar: Competitor[];
  };
  onAddToClients: (c: Competitor) => Promise<void>;
  addedPlaceIds: Set<string>;
}

const PIN_COLORS: Record<string, string> = {
  red:    'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
  orange: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  green:  'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
};

function CompetitorRow({ c, onAdd, isAdded }: { c: Competitor; onAdd: (c: Competitor) => Promise<void>; isAdded: boolean }) {
  const { t } = useLanguage();
  const LABELS: Record<string, string> = {
    red: t('radar.direct_competitor'),
    orange: t('radar.strong_competitor'),
    yellow: t('radar.moderate'),
    green: t('radar.weak_competitor'),
  };
  const [loading, setLoading] = useState(false);
  const colorClass = PIN_COLORS[c.pin_color] || PIN_COLORS.green;

  const handleAdd = async () => {
    if (isAdded || loading) return;
    setLoading(true);
    await onAdd(c);
    setLoading(false);
  };

  return (
    <tr className="border-b border-slate-100 dark:border-zinc-800 last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors">
      <td className="py-4 px-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${colorClass}`}>
            {LABELS[c.pin_color] || t('radar.competitor')}
          </div>
          <div>
            <div className="font-bold text-sm text-slate-800 dark:text-zinc-100">{c.name}</div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{c.address}</div>
            {c.rating && (
              <div className="flex items-center gap-1 mt-1">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                <span className="text-xs text-amber-400 font-bold">{c.rating}</span>
                <span className="text-xs text-slate-400">({c.reviews || 0})</span>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-sm font-mono text-indigo-500 dark:text-indigo-400">{c.distance_km} km</td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${c.market_size_score}%` }} />
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">{c.market_size_score}</span>
        </div>
      </td>
      <td className="py-4 px-4">
        <span className="text-sm text-slate-600 dark:text-zinc-300 font-mono">{c.team_size_estimate}</span>
      </td>
      <td className="py-4 px-4">
        <div className="flex flex-wrap gap-1">
          {c.matched_services.slice(0, 3).map(s => (
            <span key={s} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded uppercase tracking-wide border border-indigo-500/20">{s}</span>
          ))}
          {c.matched_services.length > 3 && (
            <span className="text-[9px] text-slate-400">+{c.matched_services.length - 3}</span>
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-500 mt-1">{c.overlap_pct}% {t('radar.overlap')}</div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          {c.maps_url && (
            <a href={c.maps_url} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
              <MapPin size={12} />
            </a>
          )}
          {c.website && (
            <a href={c.website} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
              <Globe size={12} />
            </a>
          )}
          <button
            onClick={handleAdd}
            disabled={isAdded || loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isAdded
                ? 'bg-green-500/20 text-green-500 border border-green-500/30 cursor-default'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md active:scale-95'
            }`}>
            {loading ? (
              <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
            ) : isAdded ? (
              <><Check size={10} /> {t('radar.added')}</>
            ) : (
              <><Plus size={10} /> {t('radar.add_to_crm')}</>
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CompetitorTable({ rankings, onAddToClients, addedPlaceIds }: CompetitorTableProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'nearest' | 'largest_market' | 'largest_team' | 'most_similar'>('nearest');

  const TABS = [
    { key: 'nearest', label: t('radar.tab_nearest'), icon: MapPin, subtitle: t('radar.tab_nearest_sub') },
    { key: 'largest_market', label: t('radar.tab_largest_market'), icon: TrendingUp, subtitle: t('radar.tab_largest_market_sub') },
    { key: 'largest_team', label: t('radar.tab_largest_teams'), icon: Users, subtitle: t('radar.tab_largest_teams_sub') },
    { key: 'most_similar', label: t('radar.tab_most_similar'), icon: Layers, subtitle: t('radar.tab_most_similar_sub') },
  ] as const;

  const currentList = rankings[activeTab] || [];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-700 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}>
              <Icon size={14} />
              {tab.label}
              <span className="text-[9px] font-black bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">
                {t('radar.top')} {rankings[tab.key]?.length || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="text-4xl mb-3">📍</div>
          <p className="text-sm font-medium">{t('radar.no_competitors')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-widest bg-slate-50 dark:bg-zinc-950">
                <th className="py-3 px-4 font-bold">{t('radar.business')}</th>
                <th className="py-3 px-4 font-bold">{t('radar.distance')}</th>
                <th className="py-3 px-4 font-bold">
                  <div className="flex items-center gap-1 group relative">
                    {t('radar.market_score')}
                    <Info size={12} className="text-slate-400 cursor-help" />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-zinc-800 dark:bg-zinc-700 text-zinc-200 text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case tracking-normal font-normal border border-zinc-700">
                      {t('radar.market_score_tip')}
                    </div>
                  </div>
                </th>
                <th className="py-3 px-4 font-bold">
                  <div className="flex items-center gap-1 group relative">
                    {t('radar.team_size')}
                    <Info size={12} className="text-slate-400 cursor-help" />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-40 p-2 bg-zinc-800 dark:bg-zinc-700 text-zinc-200 text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case tracking-normal font-normal border border-zinc-700">
                      {t('radar.team_size_tip')}
                    </div>
                  </div>
                </th>
                <th className="py-3 px-4 font-bold">{t('radar.services')}</th>
                <th className="py-3 px-4 font-bold">{t('radar.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map(c => (
                <CompetitorRow
                  key={c.place_id || c.name}
                  c={c}
                  onAdd={onAddToClients}
                  isAdded={addedPlaceIds.has(c.place_id || c.name)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
