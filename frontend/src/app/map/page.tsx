"use client";
import { API_BASE_URL } from "@/config";
import React, { useState, useEffect } from "react";
import { Loader2, Map, Building2, Users, TrendingUp, Filter, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/context/LanguageContext";

const MapComponent = dynamic(() => import("./MapComponent"), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-900">
    <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
  </div>
)});

export type MapPin = {
  id: number;
  type: "client" | "lead" | "competitor";
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  status?: string;
  url?: string;
};

export default function MapPage() {
  const { t } = useLanguage();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "client" | "lead" | "competitor">("all");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const results: MapPin[] = [];

      try {
        const [clientsRes, leadsRes, competitorsRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/clients`),
          fetch(`${API_BASE_URL}/leads`),
          fetch(`${API_BASE_URL}/competitors`),
        ]);

        if (clientsRes.status === "fulfilled" && clientsRes.value.ok) {
          const data = await clientsRes.value.json();
          const clients = data.clients || data || [];
          clients.forEach((c: any) => {
            if (c.address || c.city || c.location) {
              results.push({
                id: c.id, type: "client",
                name: c.company_name || c.companyName || c.name || "Client",
                address: c.address || c.city || c.location,
                status: c.status,
              });
            }
          });
        }

        if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
          const data = await leadsRes.value.json();
          const leads = data.leads || data || [];
          leads.forEach((l: any) => {
            if (l.address) {
              results.push({
                id: l.id, type: "lead",
                name: l.company_name || "Lead",
                address: l.address,
                status: l.status,
                url: `/leads/${l.id}`,
              });
            }
          });
        }

        if (competitorsRes.status === "fulfilled" && competitorsRes.value.ok) {
          const data = await competitorsRes.value.json();
          const comps = data.analyses || data.competitors || data || [];
          comps.forEach((c: any) => {
            if (c.address || c.location) {
              results.push({
                id: c.id, type: "competitor",
                name: c.name || c.company_name || "Competitor",
                address: c.address || c.location,
              });
            }
          });
        }
      } catch (e) {
        console.error(e);
      }

      setPins(results);
      setLoading(false);
    };

    loadData();
  }, []);

  const filtered = filter === "all" ? pins : pins.filter(p => p.type === filter);

  const counts = {
    client: pins.filter(p => p.type === "client").length,
    lead: pins.filter(p => p.type === "lead").length,
    competitor: pins.filter(p => p.type === "competitor").length,
  };

  const filterLabels: Record<string, string> = {
    all: t("map.filter_all"),
    client: t("map.filter_clients"),
    lead: t("map.filter_leads"),
    competitor: t("map.filter_competitors"),
  };

  const unGeocoded = filtered.filter(p => !p.lat && !p.lng && p.address).length;

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] dark:bg-black overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("map.title")}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("map.subtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "client", "lead", "competitor"] as const).map(f => {
              const icons: Record<string, any> = { all: Map, client: Building2, lead: TrendingUp, competitor: Users };
              const colors: Record<string, string> = {
                all: "bg-slate-900 dark:bg-white text-white dark:text-black",
                client: "bg-emerald-600 text-white",
                lead: "bg-blue-600 text-white",
                competitor: "bg-red-600 text-white"
              };
              const Icon = icons[f];
              const count = f === "all" ? pins.length : counts[f as keyof typeof counts];
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter === f ? colors[f] : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {filterLabels[f]} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 px-6 py-2 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> {t("map.legend_clients")}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> {t("map.legend_leads")}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> {t("map.legend_competitors")}
        </div>
        <span className="text-xs text-slate-400 ml-auto">
          {t("map.showing_pins")} {filtered.length} {t("map.of_pins")} {pins.length} {t("map.pins_label")}
          {unGeocoded > 0 && (
            <> · {unGeocoded} {t("map.being_geocoded")}</>
          )}
        </span>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
            <p className="text-sm text-slate-500">{t("map.loading")}</p>
          </div>
        ) : (
          <MapComponent pins={filtered} />
        )}
      </div>
    </div>
  );
}
