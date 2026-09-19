import React, { useState, useEffect } from "react";
import { useRole } from "@/context/RoleContext";
import { API_BASE_URL } from "@/config";
import { AlertTriangle, ArrowUpCircle, CheckCircle2, Users, UserPlus, Mail, Radar } from "lucide-react";

interface DemoLimitsProps {
  type: "clients" | "emails" | "searches" | "projects";
}

interface LimitData {
  usage: number;
  limit: number;
}

interface Limits {
  clients: LimitData;
  leads: LimitData;
  emails: LimitData;
  searches: LimitData;
}

function LimitPill({ icon, label, usage, limit }: { icon: React.ReactNode; label: string; usage: number; limit: number }) {
  const pct = (usage / limit) * 100;
  const isAtLimit = pct >= 100;
  const isNear = pct >= 80;
  return (
    <div className={`flex flex-col gap-1.5 px-4 py-3 rounded-xl border ${isAtLimit ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30" : isNear ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30" : "bg-slate-50 border-slate-200 dark:bg-zinc-800/50 dark:border-zinc-700"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`${isAtLimit ? "text-red-500" : isNear ? "text-amber-500" : "text-blue-500"}`}>{icon}</span>
          <span className={`text-xs font-bold ${isAtLimit ? "text-red-700 dark:text-red-400" : isNear ? "text-amber-700 dark:text-amber-400" : "text-slate-700 dark:text-zinc-300"}`}>{label}</span>
        </div>
        <span className={`text-xs font-black ${isAtLimit ? "text-red-600" : isNear ? "text-amber-600" : "text-slate-500"}`}>{usage}/{limit}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isAtLimit ? "bg-red-500" : isNear ? "bg-amber-500" : "bg-blue-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function DemoLimits({ type }: DemoLimitsProps) {
  const { user } = useRole();
  const [limits, setLimits] = useState<Limits | null>(null);
  const [upgraded, setUpgraded] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (user?.role !== "Demo") return;

    const fetchLimits = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/demo/limits`, {
          headers: { "X-Tenant-ID": user?.tenant_id?.toString() || "" }
        });
        const data = await res.json();
        if (data.success) setLimits(data.limits);
      } catch {}
    };

    fetchLimits();
  }, [user]);

  if (user?.role !== "Demo" || !limits) return null;

  const current = limits[type];
  const pct = (current.usage / current.limit) * 100;
  const isAtLimit = pct >= 100;
  const isNear = pct >= 80;

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await fetch(`${API_BASE_URL}/demo/upgrade`, {
        method: "POST",
        headers: { "X-Tenant-ID": user?.tenant_id?.toString() || "" }
      });
      setUpgraded(true);
    } catch {}
    setUpgrading(false);
  };

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      {/* Top bar - primary limit for this page */}
      <div className={`px-5 py-3 flex items-center justify-between gap-4 ${isAtLimit ? "bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20" : isNear ? "bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20" : "bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20"}`}>
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isAtLimit ? "text-red-500" : isNear ? "text-amber-500" : "text-blue-500"}`} />
          <div>
            <span className={`text-sm font-bold ${isAtLimit ? "text-red-800 dark:text-red-300" : isNear ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"}`}>
              Demo Account — Usage Limits Active
            </span>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {isAtLimit
                ? `You've reached your ${type} limit (${current.limit}). Upgrade to add more.`
                : `You can add up to ${current.limit} ${type}. ${current.limit - current.usage} remaining.`}
            </p>
          </div>
        </div>
        {upgraded ? (
          <div className="flex-shrink-0 flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-900/30">
            <CheckCircle2 className="w-4 h-4" /> Request Sent!
          </div>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-bold rounded-xl shadow hover:shadow-md transition-all disabled:opacity-50"
          >
            {upgrading ? "Sending..." : <><ArrowUpCircle className="w-4 h-4" /> Upgrade</>}
          </button>
        )}
      </div>

      {/* All 4 limit pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <LimitPill icon={<UserPlus className="w-3.5 h-3.5" />} label="Leads" usage={limits.leads.usage} limit={limits.leads.limit} />
        <LimitPill icon={<Users className="w-3.5 h-3.5" />} label="Clients" usage={limits.clients.usage} limit={limits.clients.limit} />
        <LimitPill icon={<Radar className="w-3.5 h-3.5" />} label="Radar Searches" usage={limits.searches.usage} limit={limits.searches.limit} />
        <LimitPill icon={<Mail className="w-3.5 h-3.5" />} label="Email Agent" usage={limits.emails.usage} limit={limits.emails.limit} />
      </div>
    </div>
  );
}
