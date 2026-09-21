"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, Send, Briefcase, Target, Activity, ShieldAlert,
  ArrowUpRight, FolderKanban, Shield, Lock, Eye, AlertTriangle, UserPlus, LockKeyhole, Mail, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import PageGuide from "@/components/PageGuide";
import { useRole } from "@/context/RoleContext";
import { API_BASE_URL } from "@/config";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

export function DemoDashboard({ demoStats, NAV_CARDS, language }: any) {
  const { user, email } = useRole();
  const [upgrading, setUpgrading] = useState(false);
  const [upgraded, setUpgraded] = useState(false);

  const usage = demoStats?.usage || { clients_leads: 0, email_agent: 0, radar: 0 };
  const limits = demoStats?.limits || { clients_leads: 15, email_agent: 5, radar: 5 };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/demo/request-upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
      });
      if (res.ok) {
        setUpgraded(true);
      } else {
        alert("There was an issue sending your request. Please contact support.");
      }
    } catch (err) {
      alert("Network error.");
    }
    setUpgrading(false);
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-6 max-w-[1600px] mx-auto w-full">
      
      {/* DEMO BANNER */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-rose-500/20 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-500 text-sm tracking-wide uppercase">Sandbox Environment</h3>
            <p className="text-sm font-medium text-amber-700/80 dark:text-amber-500/80">You are currently exploring a limited demo account. Any data generated may be cleared periodically.</p>
          </div>
        </div>
        {!upgraded ? (
          <button 
            onClick={handleUpgrade}
            disabled={upgrading}
            className="shrink-0 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center gap-2"
          >
            {upgrading ? "Sending..." : "Request Full Access"}
            {!upgrading && <LockKeyhole className="w-4 h-4" />}
          </button>
        ) : (
          <div className="shrink-0 px-6 py-2.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Request Sent to Admin!
          </div>
        )}
      </motion.div>

      {/* HEADER SECTION */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Welcome, {user?.name || 'Demo User'}
          </h1>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-1">
            Explore the platform and monitor your demo usage limits below.
          </p>
        </div>
      </motion.div>

      {/* LIMITS METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Clients & Leads */}
        <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-indigo-500">
              <Users className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wide uppercase">Clients & Leads</span>
            </div>
            <span className="text-[10px] font-black px-2 py-1 bg-indigo-500/10 text-indigo-600 rounded-md">
              {usage.clients_leads} / {limits.clients_leads}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${Math.min((usage.clients_leads / limits.clients_leads) * 100, 100)}%` }} 
              transition={{ duration: 1 }} 
              className={`h-full rounded-full ${usage.clients_leads >= limits.clients_leads ? 'bg-rose-500' : 'bg-indigo-500'}`} 
            />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-3">You can create up to {limits.clients_leads} CRM records during the demo.</p>
        </motion.div>

        {/* Email Agent */}
        <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-violet-500">
              <Mail className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wide uppercase">AI Email Agent</span>
            </div>
            <span className="text-[10px] font-black px-2 py-1 bg-violet-500/10 text-violet-600 rounded-md">
              {usage.email_agent} / {limits.email_agent}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${Math.min((usage.email_agent / limits.email_agent) * 100, 100)}%` }} 
              transition={{ duration: 1 }} 
              className={`h-full rounded-full ${usage.email_agent >= limits.email_agent ? 'bg-rose-500' : 'bg-violet-500'}`} 
            />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-3">Trigger the AI Email Agent up to {limits.email_agent} times.</p>
        </motion.div>

        {/* Radar Analysis */}
        <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-emerald-500">
              <Activity className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wide uppercase">Radar Scans</span>
            </div>
            <span className="text-[10px] font-black px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-md">
              {usage.radar} / {limits.radar}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${Math.min((usage.radar / limits.radar) * 100, 100)}%` }} 
              transition={{ duration: 1 }} 
              className={`h-full rounded-full ${usage.radar >= limits.radar ? 'bg-rose-500' : 'bg-emerald-500'}`} 
            />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-3">Perform deep competitor analyses up to {limits.radar} times.</p>
        </motion.div>
      </div>

      {/* QUICK LINKS GRID */}
      <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm h-max">
        <div className="p-5 border-b border-[var(--border)]">
          <h3 className="font-bold text-[var(--text-primary)]">Explore Platform Features</h3>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {NAV_CARDS.map((card: any) => (
            <Link key={card.href} href={card.href} className="p-4 border border-[var(--border)] rounded-xl hover:border-[var(--primary)] hover:bg-[var(--sidebar-hover)] transition-all group flex flex-col items-center justify-center text-center gap-3">
              <card.icon className="w-7 h-7 text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors" />
              <span className="text-xs font-bold text-[var(--text-primary)]">{card.title}</span>
            </Link>
          ))}
        </div>
      </motion.div>

    </motion.div>
  );
}
