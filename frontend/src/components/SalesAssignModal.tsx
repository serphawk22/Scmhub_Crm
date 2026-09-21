'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Zap, UserCheck, X, ChevronDown, Briefcase, TrendingUp,
  AlertCircle, CheckCircle2, Loader2, BarChart2
} from 'lucide-react';
import { API_BASE_URL } from '@/config';

interface SalesPerson {
  id: number;
  name: string;
  email?: string;
  role: string;
  active_clients: number;
  active_leads: number;
  total_active: number;
}

interface SalesAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (employeeId: number | null, employeeName: string | null) => void;
  entityType: 'client' | 'lead';
}

function getWorkloadColor(total: number): { bar: string; badge: string; label: string } {
  if (total === 0) return { bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Available' };
  if (total <= 5) return { bar: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Light' };
  if (total <= 10) return { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Moderate' };
  return { bar: 'bg-red-400', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Heavy' };
}

export default function SalesAssignModal({ isOpen, onClose, onAssign, entityType }: SalesAssignModalProps) {
  const [employees, setEmployees] = useState<SalesPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  const fetchWorkload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/employees/workload`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (e) {
      console.error('Failed to fetch employee workload:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchWorkload();
      setSelected(null);
    }
  }, [isOpen, fetchWorkload]);

  const handleAutoAssign = () => {
    // Auto-assign: pick the sales person with the fewest total active items
    // Tie-break: prioritise Employee role over Admin, then by name alphabetically
    const sorted = [...employees].sort((a, b) => {
      if (a.total_active !== b.total_active) return a.total_active - b.total_active;
      const roleRank = (r: string) => r === 'Employee' ? 0 : r === 'SalesManager' ? 1 : 2;
      if (roleRank(a.role) !== roleRank(b.role)) return roleRank(a.role) - roleRank(b.role);
      return (a.name || '').localeCompare(b.name || '');
    });
    if (sorted.length > 0) {
      setSelected(sorted[0].id);
    }
  };

  const handleConfirm = async () => {
    setAssigning(true);
    try {
      const emp = employees.find(e => e.id === selected);
      onAssign(selected, emp?.name || null);
    } finally {
      setAssigning(false);
    }
  };

  const handleSkip = () => {
    onAssign(null, null);
  };

  const maxWorkload = Math.max(...employees.map(e => e.total_active), 1);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-7 pt-7 pb-5 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-zinc-900 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Users size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 leading-tight">
                      Assign to Sales Team?
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Assign this {entityType} to a salesperson
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-7 py-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Auto-Assign Banner */}
              <button
                type="button"
                onClick={handleAutoAssign}
                disabled={loading || employees.length === 0}
                className="w-full flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <Zap size={18} className="shrink-0 group-hover:animate-pulse" />
                <div className="text-left">
                  <p className="font-black">Auto Assign</p>
                  <p className="text-[10px] opacity-80 font-medium">
                    Picks the least-loaded salesperson based on active client &amp; lead count
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">or choose manually</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
              </div>

              {/* Workload Table */}
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={28} className="animate-spin text-violet-400" />
                </div>
              ) : employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-zinc-500">
                  <AlertCircle size={32} className="mb-2" />
                  <p className="text-sm font-bold">No sales team members found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {employees.map(emp => {
                    const wl = getWorkloadColor(emp.total_active);
                    const isSelected = selected === emp.id;
                    const barWidth = Math.max((emp.total_active / maxWorkload) * 100, 4);
                    return (
                      <motion.button
                        key={emp.id}
                        type="button"
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelected(isSelected ? null : emp.id)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                          isSelected
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-md shadow-violet-500/10'
                            : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black ${isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'}`}>
                              {(emp.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-sm text-slate-800 dark:text-zinc-100 leading-tight">{emp.name || 'Unnamed'}</p>
                              <p className="text-[10px] text-slate-400 dark:text-zinc-500 capitalize">{emp.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${wl.badge}`}>
                              {wl.label}
                            </span>
                            {isSelected && <CheckCircle2 size={16} className="text-violet-500 shrink-0" />}
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400 mb-2">
                          <span className="flex items-center gap-1.5">
                            <Briefcase size={11} className="text-blue-400" />
                            <span><strong className="text-slate-700 dark:text-zinc-200">{emp.active_clients}</strong> clients</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <TrendingUp size={11} className="text-violet-400" />
                            <span><strong className="text-slate-700 dark:text-zinc-200">{emp.active_leads}</strong> leads</span>
                          </span>
                          <span className="ml-auto flex items-center gap-1 text-[10px] font-black text-slate-400">
                            <BarChart2 size={11} />
                            {emp.total_active} total
                          </span>
                        </div>

                        {/* Workload bar */}
                        <div className="h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className={`h-full rounded-full ${wl.bar}`}
                          />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 py-5 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl font-bold text-sm transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={selected === null || assigning}
                className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {assigning ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                {assigning ? 'Assigning…' : 'Assign & Create'}
              </button>
            </div>

            {/* Criteria explainer */}
            <div className="px-7 pb-5">
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 text-center">
                <strong>Auto-assign criteria:</strong> Selects the salesperson with the lowest combined active clients + leads. Tie-breaks: Employee &gt; SalesManager &gt; Admin, then alphabetically.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
