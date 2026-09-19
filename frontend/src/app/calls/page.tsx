"use client";

import { useEffect, useState } from "react";
import { Phone, Clock3, MessageSquareText } from "lucide-react";
import { API_BASE_URL } from "@/config";

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCalls = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/calls`);
        const data = await res.json();
        setCalls(data.calls || []);
      } catch (err) {
        console.error("Failed to load calls", err);
      } finally {
        setLoading(false);
      }
    };

    loadCalls();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-slate-500 dark:text-zinc-400">Loading call center…</div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-black text-amber-500">Call Center</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Recent calls</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 text-xs font-bold">
          <Phone className="w-3.5 h-3.5" />
          {calls.length} total
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No calls have been recorded yet. Once a call is received, it will appear here.
        </div>
      ) : (
        <div className="grid gap-4">
          {calls.map((call) => (
            <div key={call.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{call.phone_number}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {call.duration_seconds ? `${call.duration_seconds}s` : "—"}</span>
                      <span>{call.received_at ? new Date(call.received_at).toLocaleString() : "Recently"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  Logged call
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                <div className="mb-2 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <MessageSquareText className="h-4 w-4 text-indigo-500" />
                  Summary
                </div>
                <p>{call.summary || "No summary recorded yet."}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
