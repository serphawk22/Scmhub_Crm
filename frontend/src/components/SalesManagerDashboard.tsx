"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Users, UserPlus, PhoneCall, Calendar, ArrowRight, TrendingUp, Target, DollarSign, Percent } from 'lucide-react';
import Link from 'next/link';

interface Activity {
  type: string;
  title: string;
  date: string;
  status: string;
}

interface SalesManagerStats {
  metrics: {
    assigned_leads: number;
    assigned_contacts: number;
    assigned_clients: number;
    deals_won?: number;
    revenue_won?: number;
    conversion_percentage?: number;
    deal_win_rate?: number;
  };
  recent_activity: Activity[];
}

export function SalesManagerDashboard({ stats, name }: { stats: SalesManagerStats; name: string }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Just now';
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(d);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 rounded-3xl p-8 text-white shadow-2xl border border-indigo-700"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Target className="w-64 h-64 -rotate-12" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-indigo-200 text-sm font-bold mb-4 border border-white/10">
            <TrendingUp className="w-4 h-4" />
            SALES MANAGER DB
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
            Ready to close some deals, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-100">{name.split(' ')[0]}</span>?
          </h1>
          <p className="text-indigo-200 text-lg md:text-xl font-medium max-w-xl">
            Here's a breakdown of your assigned pipeline, active contacts, and recent activities. Keep the momentum going!
          </p>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-blue-900/5 dark:shadow-none border border-slate-100 dark:border-zinc-800 relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <UserPlus className="w-32 h-32 transform translate-x-4 -translate-y-4" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 ring-4 ring-blue-50/50 dark:ring-blue-900/10">
              <UserPlus className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Assigned Leads</p>
            <h2 className="text-4xl font-black text-slate-800 dark:text-white">{stats.metrics?.assigned_leads || 0}</h2>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-indigo-900/5 dark:shadow-none border border-slate-100 dark:border-zinc-800 relative overflow-hidden group hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-colors">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-32 h-32 transform translate-x-4 -translate-y-4" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 ring-4 ring-indigo-50/50 dark:ring-indigo-900/10">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Assigned Contacts</p>
            <h2 className="text-4xl font-black text-slate-800 dark:text-white">{stats.metrics?.assigned_contacts || 0}</h2>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-violet-900/5 dark:shadow-none border border-slate-100 dark:border-zinc-800 relative overflow-hidden group hover:border-violet-200 dark:hover:border-violet-900/50 transition-colors">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Briefcase className="w-32 h-32 transform translate-x-4 -translate-y-4" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center mb-6 ring-4 ring-violet-50/50 dark:ring-violet-900/10">
              <Briefcase className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Assigned Clients</p>
            <h2 className="text-4xl font-black text-slate-800 dark:text-white">{stats.metrics?.assigned_clients || 0}</h2>
          </div>
        </motion.div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-5"><p className="text-xs font-bold text-slate-400 uppercase">Deals Won</p><p className="text-2xl font-black dark:text-white">{stats.metrics?.deals_won || 0}</p></div>
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-5"><p className="text-xs font-bold text-slate-400 uppercase">Revenue Won</p><p className="text-2xl font-black dark:text-white">${stats.metrics?.revenue_won || 0}</p></div>
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-5"><p className="text-xs font-bold text-slate-400 uppercase">Lead Conversion</p><p className="text-2xl font-black dark:text-white">{stats.metrics?.conversion_percentage || 0}%</p></div>
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-5"><p className="text-xs font-bold text-slate-400 uppercase">Deal Win Rate</p><p className="text-2xl font-black dark:text-white">{stats.metrics?.deal_win_rate || 0}%</p></div>
      </motion.div>

    </div>
  );
}
