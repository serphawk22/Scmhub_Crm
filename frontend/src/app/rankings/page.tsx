"use client";

import { useState, useEffect } from "react";
import {
  Plus, X, Loader2, TrendingUp, TrendingDown, Minus,
  Search, BarChart2, Target, RefreshCw, Trash2
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';
import { useLanguage } from "@/context/LanguageContext";

interface RankEntry {
  id: number;
  client_id: number;
  keyword: string;
  position?: number;
  url?: string;
  search_engine: string;
  notes?: string;
  recorded_at: string;
}

interface Client { id: number; companyName?: string; name?: string; }

function positionBadge(pos?: number) {
  if (!pos) return <span className="text-gray-400 text-sm">N/A</span>;
  const color = pos <= 3 ? "text-emerald-700 bg-emerald-100" :
    pos <= 10 ? "text-blue-700 bg-blue-100" :
    pos <= 20 ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100";
  return <span className={cn("text-sm font-black px-2 py-0.5 rounded-full", color)}>#{pos}</span>;
}

export default function RankingsPage() {
  const { t } = useLanguage();
  const { role, user } = useRole();
  const isClient = role === "Client";
  const clientId = user?.client_id;
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterClient, setFilterClient] = useState<string>("all");
  const [searchKw, setSearchKw] = useState("");

  const [form, setForm] = useState({
    client_id: "", keyword: "", position: "",
    url: "", search_engine: "Google", notes: "",
  });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const rankUrl = isClient && clientId
      ? `${API_BASE_URL}/rankings?client_id=${clientId}`
      : `${API_BASE_URL}/rankings`;
    const [r, c] = await Promise.all([
      fetch(rankUrl).then(async res => { if (!res.ok) throw new Error("Rankings fetch failed"); return res.json(); }).catch(() => ({ rankings: [] })),
      isClient ? Promise.resolve({ clients: [] }) : fetch(`${API_BASE_URL}/clients`).then(async res => { if (!res.ok) throw new Error("Clients fetch failed"); return res.json(); }).catch(() => ({ clients: [] })),
    ]);
    setRankings(r.rankings || []);
    setClients(c.clients || []);
    setLoading(false);
  }

  async function addRanking(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/rankings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Number(form.client_id),
        keyword: form.keyword,
        position: form.position ? Number(form.position) : null,
        url: form.url || null,
        search_engine: form.search_engine,
        notes: form.notes || null,
      }),
    });
    setShowModal(false);
    setForm({ client_id: "", keyword: "", position: "", url: "", search_engine: "Google", notes: "" });
    fetchAll();
    setSubmitting(false);
  }

  async function deleteEntry(id: number) {
    await fetch(`${API_BASE_URL}/rankings/${id}`, { method: "DELETE" });
    setRankings(prev => prev.filter(r => r.id !== id));
  }

  const clientName = (id: number) => {
    const c = clients.find(c => c.id === id);
    return c?.companyName || c?.name || `Client #${id}`;
  };

  const filtered = rankings.filter(r =>
    (filterClient === "all" || r.client_id === Number(filterClient)) &&
    (!searchKw || r.keyword.toLowerCase().includes(searchKw.toLowerCase()))
  );

  const latestByKey: Record<string, RankEntry> = {};
  [...rankings].reverse().forEach(r => {
    const k = `${r.client_id}::${r.keyword}`;
    if (!latestByKey[k]) latestByKey[k] = r;
  });

  const top10 = Object.values(latestByKey).filter(r => r.position && r.position <= 10).length;
  const top3  = Object.values(latestByKey).filter(r => r.position && r.position <= 3).length;
  const avgPos = Object.values(latestByKey).filter(r => r.position).reduce((s, r) => s + (r.position || 0), 0) /
    (Object.values(latestByKey).filter(r => r.position).length || 1);

  const stats = [
    { label: t("rankings.stat_keywords"), value: Object.keys(latestByKey).length, icon: Target, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: t("rankings.stat_top3"), value: top3, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: t("rankings.stat_top10"), value: top10, icon: BarChart2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: t("rankings.stat_avg"), value: isNaN(avgPos) ? "—" : avgPos.toFixed(1), icon: Minus, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  const tableHeaders = ["Keyword", "Client", "Position", "Search Engine", "URL", "Date", ""];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight">{isClient ? t("rankings.title_client") : t("rankings.title_staff")}</h1>
          <p className="text-gray-500 dark:text-zinc-400 font-medium">{isClient ? t("rankings.subtitle_client") : t("rankings.subtitle_staff")}</p>
        </div>
        {!isClient && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg transition-all active:scale-95">
            <Plus className="w-4 h-4" /> {t("rankings.log_ranking")}
          </button>
        )}
      </div>

      <PageGuide
        pageKey="rankings"
        title={isClient ? t("rankings.guide_title_client") : t("rankings.guide_title_staff")}
        description={isClient ? t("rankings.guide_desc_client") : t("rankings.guide_desc_staff")}
        steps={isClient ? [
          { icon: '📍', text: t("rankings.guide_cs1") },
          { icon: '🟢', text: t("rankings.guide_cs2") },
          { icon: '🟡', text: t("rankings.guide_cs3") },
          { icon: '📈', text: t("rankings.guide_cs4") },
        ] : [
          { icon: '➕', text: t("rankings.guide_s1") },
          { icon: '📊', text: t("rankings.guide_s2") },
          { icon: '🔍', text: t("rankings.guide_s3") },
          { icon: '📈', text: t("rankings.guide_s4") },
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={cn("rounded-2xl p-4 flex items-center gap-3", s.bg)}>
            <s.icon className={cn("w-6 h-6", s.color)} />
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">{s.label}</p>
              <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchKw} onChange={e => setSearchKw(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={t("rankings.search_ph")} />
        </div>
        {!isClient && (
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">{t("rankings.all_clients")}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name || `Client #${c.id}`}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-950 border-b">
              <tr>
                {tableHeaders.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-400">{t("rankings.empty")}</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 dark:bg-zinc-950 transition-colors">
                  <td className="px-4 py-4 font-semibold text-gray-900 dark:text-zinc-50">{r.keyword}</td>
                  <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{clientName(r.client_id)}</td>
                  <td className="px-4 py-4">{positionBadge(r.position)}</td>
                  <td className="px-4 py-4 text-gray-500 dark:text-zinc-400">{r.search_engine}</td>
                  <td className="px-4 py-4">
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline text-xs truncate max-w-[140px] block">
                        {r.url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-xs">{new Date(r.recorded_at).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    {!isClient && (
                      <button onClick={() => deleteEntry(r.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">{t("rankings.modal_title")}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={addRanking} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("rankings.field_client")}</label>
                <select required value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">{t("rankings.select_client")}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name || `Client #${c.id}`}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("rankings.field_keyword")}</label>
                  <input required value={form.keyword} onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t("rankings.keyword_ph")} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("rankings.field_position")}</label>
                  <input type="number" min="1" max="200" value={form.position}
                    onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t("rankings.position_ph")} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("rankings.field_url")}</label>
                <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t("rankings.url_ph")} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("rankings.field_engine")}</label>
                <select value={form.search_engine} onChange={e => setForm(p => ({ ...p, search_engine: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {["Google", "Bing", "Yahoo", "DuckDuckGo"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("rankings.field_notes")}</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t("rankings.notes_ph")} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-sm text-gray-600 dark:text-zinc-300">{t("rankings.cancel")}</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("rankings.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
