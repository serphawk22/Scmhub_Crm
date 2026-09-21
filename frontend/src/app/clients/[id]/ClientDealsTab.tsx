"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, DollarSign, Kanban, Loader2, MapPin } from "lucide-react";
import { API_BASE_URL } from "@/config";

type Deal = {
  id: number;
  title: string;
  value: number;
  stage: string;
  expected_close_date: string | null;
  created_at: string;
};

const STAGES = ["Lead", "Discovery", "Demo", "Negotiation", "Closed Won", "Closed Lost"];

export default function ClientDealsTab({ clientId }: { clientId: string }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  const fetchDeals = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/deals?client_id=${clientId}`);
      if (!response.ok) throw new Error("Failed to fetch client deals");
      const data = await response.json();
      setDeals(data.deals || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const dealsByStage = useMemo(() => STAGES.reduce((groups, stage) => {
    groups[stage] = deals.filter(deal => deal.stage === stage);
    return groups;
  }, {} as Record<string, Deal[]>), [deals]);

  const handleDrop = async (stage: string) => {
    if (!draggedDeal || draggedDeal.stage === stage) {
      setDraggedDeal(null);
      return;
    }

    setDeals(current => current.map(deal => deal.id === draggedDeal.id ? { ...deal, stage } : deal));
    try {
      const response = await fetch(`${API_BASE_URL}/deals/${draggedDeal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) throw new Error("Failed to update deal stage");
    } catch (error) {
      console.error(error);
      fetchDeals();
    } finally {
      setDraggedDeal(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading deals...
      </div>
    );
  }

  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

  return (
    <section className="space-y-6 pb-16">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <Kanban className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-black uppercase tracking-wide text-slate-800 dark:text-zinc-100">Deals</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Client-specific deal pipeline</p>
        </div>
        <div className="rounded-2xl bg-indigo-50 px-5 py-3 text-right dark:bg-indigo-950/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Total pipeline</p>
          <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">${totalValue.toLocaleString()}</p>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-16 text-center text-sm font-semibold text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No deals are associated with this client.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {STAGES.map(stage => (
            <div
              key={stage}
              onDragOver={event => event.preventDefault()}
              onDrop={() => handleDrop(stage)}
              className="flex min-h-[360px] min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800/50"
            >
              <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-slate-100 p-4 dark:border-zinc-700 dark:bg-zinc-800/80">
                <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-zinc-200">
                  {stage}
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">{dealsByStage[stage].length}</span>
                </h3>
                <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                  ${dealsByStage[stage].reduce((sum, deal) => sum + (deal.value || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="max-h-[calc(100vh-330px)] flex-1 space-y-3 overflow-y-auto p-3">
                {dealsByStage[stage].map(deal => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDraggedDeal(deal)}
                    className="cursor-grab rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <h4 className="line-clamp-2 font-semibold text-slate-800 dark:text-zinc-100">{deal.title}</h4>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                      <MapPin className="h-3.5 w-3.5" /> Client deal
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-zinc-800">
                      <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600"><DollarSign className="h-4 w-4" />{deal.value.toLocaleString()}</span>
                      {deal.expected_close_date && <span className="flex items-center gap-1 text-xs font-medium text-slate-400"><Calendar className="h-3.5 w-3.5" />{new Date(deal.expected_close_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
