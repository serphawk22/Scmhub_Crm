import React from 'react';
import { List, LayoutGrid, BarChart2, PieChart } from 'lucide-react';

export type ViewType = 'list' | 'kanban' | 'graph' | 'pivot';

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const views: { id: ViewType; label: string; icon: React.ReactNode }[] = [
    { id: 'list', label: 'List View', icon: <List className="w-4 h-4" /> },
    { id: 'kanban', label: 'Kanban', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'graph', label: 'Graph', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'pivot', label: 'Pivot', icon: <PieChart className="w-4 h-4" /> },
  ];

  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
      {views.map((v) => (
        <button
          key={v.id}
          onClick={() => onViewChange(v.id)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentView === v.id
              ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50'
          }`}
        >
          {v.icon}
          {v.label}
        </button>
      ))}
    </div>
  );
}
