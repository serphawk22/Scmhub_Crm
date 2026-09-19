"use client";
import React, { useState } from 'react';
import { Plus, Users, UserPlus, CheckSquare, Calendar, X } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useRouter, usePathname } from 'next/navigation';

export default function QuickAddFab() {
  const [isOpen, setIsOpen] = useState(false);
  const { role } = useRole();
  const router = useRouter();
  const pathname = usePathname();

  // Hide on public pages or for Client/Supplier
  if (!role || role === 'Client' || role === 'Supplier' || pathname?.startsWith('/login') || pathname?.startsWith('/demo_showcase')) {
    return null;
  }

  const actions = [];

  if (['Admin', 'SalesManager', 'Sales', 'Demo'].includes(role)) {
    actions.push({ icon: <UserPlus className="w-4 h-4" />, label: 'New Lead', route: '/leads?action=add', color: 'bg-emerald-500' });
    actions.push({ icon: <Users className="w-4 h-4" />, label: 'New Client', route: '/clients?action=add', color: 'bg-blue-500' });
  }

  if (['Admin', 'Employee', 'ProjectMember', 'Developer', 'SalesManager', 'Sales', 'Demo'].includes(role)) {
    actions.push({ icon: <CheckSquare className="w-4 h-4" />, label: 'New Task', route: '/tasks?action=add', color: 'bg-violet-500' });
  }

  if (['Admin', 'SalesManager', 'Sales', 'Employee', 'Demo'].includes(role)) {
    actions.push({ icon: <Calendar className="w-4 h-4" />, label: 'New Meeting', route: '/meetings?action=add', color: 'bg-orange-500' });
  }

  if (actions.length === 0) {
    return null;
  }

  const handleAction = (route: string) => {
    setIsOpen(false);
    router.push(route);
  };

  return (
    <div className="fixed bottom-6 right-[88px] z-[9000] flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200 mb-2">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleAction(action.route)}
              className="flex items-center gap-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-4 py-2.5 rounded-full shadow-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all hover:-translate-x-1 group"
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{action.label}</span>
              <div className={`${action.color} text-white p-1.5 rounded-full shadow-sm group-hover:scale-110 transition-transform`}>
                {action.icon}
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          isOpen ? 'bg-slate-800 text-white rotate-45' : 'bg-black text-white hover:scale-110'
        }`}
        title="Quick Add"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
