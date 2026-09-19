'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CheckCircle2, Clock, AlertCircle, XCircle, CheckSquare, User, Calendar, Flag } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useLanguage } from '@/context/LanguageContext';

interface TasksTabProps {
  clientId: string | string[];
  tasks: any[];
  employees: any[];
  onRefresh: () => void;
}

const STATUS_CFG: Record<string, { icon: any; bg: string; text: string; label: string }> = {
  'Todo':       { icon: Clock,         bg: 'bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800',    text: 'text-slate-600 dark:text-zinc-300 dark:text-slate-400',   label: 'Pending'    },
  'InProgress': { icon: AlertCircle,   bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',     label: 'In Progress' },
  'Done':       { icon: CheckCircle2,  bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Completed' },
  'Overdue':    { icon: XCircle,       bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',       label: 'Overdue'    },
};

const PRIORITY_CFG: Record<string, { bg: string; text: string; dot: string }> = {
  Low:    { bg: 'bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800',   text: 'text-slate-500 dark:text-zinc-400 dark:text-slate-400', dot: 'bg-slate-400'   },
  Medium: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500'  },
  High:   { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  Urgent: { bg: 'bg-red-100 dark:bg-red-900/30',   text: 'text-red-700 dark:text-red-400',     dot: 'bg-red-500'     },
};

function getTranslatedStatusLabel(key: string, language: string) {
  if (language === 'es') {
    if (key === 'Todo') return 'Pendiente';
    if (key === 'InProgress') return 'En Progreso';
    if (key === 'Done') return 'Completado';
    if (key === 'Overdue') return 'Atrasado';
  }
  return STATUS_CFG[key]?.label || key;
}

function getTranslatedPriority(priority: string, language: string) {
  if (language === 'es') {
    if (priority === 'Low') return 'Baja';
    if (priority === 'Medium') return 'Media';
    if (priority === 'High') return 'Alta';
    if (priority === 'Urgent') return 'Urgente';
  }
  return priority;
}

function getTaskStatus(task: any): string {
  if (task.status === 'Done') return 'Done';
  if (task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done') return 'Overdue';
  return task.status || 'Todo';
}

function TaskCard({ task, clientId, employees, onRefresh }: { task: any; clientId: any; employees: any[]; onRefresh: () => void }) {
  const { language } = useLanguage();
  const status = getTaskStatus(task);
  const sCfg = STATUS_CFG[status] || STATUS_CFG.Todo;
  const pCfg = PRIORITY_CFG[task.priority] || PRIORITY_CFG.Medium;
  const Icon = sCfg.icon;
  const assignee = employees.find((e: any) => e.id === task.assigned_to);

  const cycleStatus = async () => {
    const cycle: Record<string, string> = { 'Todo': 'InProgress', 'InProgress': 'Done', 'Done': 'Todo' };
    const next = cycle[task.status] || 'Todo';
    await fetch(`${API_BASE_URL}/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    onRefresh();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60
                 bg-white dark:bg-zinc-900 dark:bg-slate-900 hover:shadow-sm transition-shadow group"
    >
      <button
        onClick={cycleStatus}
        className={`mt-0.5 p-1 rounded-lg flex-shrink-0 transition-colors ${sCfg.bg} ${sCfg.text} hover:opacity-80`}
      >
        <Icon size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${status === 'Done' ? 'line-through text-slate-400 dark:text-slate-600 dark:text-zinc-300' : 'text-slate-800 dark:text-zinc-100 dark:text-slate-200'}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400 mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pCfg.bg} ${pCfg.text}`}>
            {getTranslatedPriority(task.priority, language)}
          </span>
          {task.due_date && (
            <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${status === 'Overdue' ? 'text-red-500' : 'text-slate-400 dark:text-slate-500 dark:text-zinc-400'}`}>
              <Calendar size={10} />
              {new Date(task.due_date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {assignee && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500 dark:text-zinc-400">
              <User size={10} /> {assignee.name}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const COLUMNS = [
  { key: 'Todo',       icon: Clock,        color: 'text-slate-500 dark:text-zinc-400' },
  { key: 'InProgress', icon: AlertCircle,  color: 'text-blue-500'  },
  { key: 'Done',       icon: CheckCircle2, color: 'text-emerald-500' },
  { key: 'Overdue',    icon: XCircle,      color: 'text-red-500'   },
];

export default function TasksTab({ clientId, tasks, employees, onRefresh }: TasksTabProps) {
  const { language } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', priority: 'Medium', due_date: '',
    assigned_to: '', status: 'Todo',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        client_id: Number(clientId),
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      }),
    });
    setForm({ title: '', description: '', priority: 'Medium', due_date: '', assigned_to: '', status: 'Todo' });
    setShowForm(false);
    setSubmitting(false);
    onRefresh();
  };

  // Progress bar
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      {total > 0 && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60 bg-white dark:bg-zinc-900 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 dark:text-slate-400">{language === 'es' ? 'Progreso de Tareas' : 'Task Progress'}</span>
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 dark:text-slate-300">{done}/{total} {language === 'es' ? 'completado' : 'completed'}</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400 mt-1">{pct}% {language === 'es' ? 'completado' : 'complete'}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-700 dark:text-zinc-200 dark:text-slate-300">{total} {language === 'es' ? 'Tareas' : 'Tasks'}</h3>
        <button
          onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white
                     text-xs font-bold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> {showForm ? (language === 'es' ? 'Cancelar' : 'Cancel') : (language === 'es' ? 'Crear Tarea' : 'Create Task')}
        </button>
      </div>

      {/* Add Task Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/50
                            bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
              <h4 className="font-black text-sm text-slate-800 dark:text-zinc-100 dark:text-white">{language === 'es' ? 'Nueva Tarea' : 'New Task'}</h4>
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder={language === 'es' ? 'Título de la tarea...' : 'Task title...'}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                           bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder={language === 'es' ? 'Descripción (opcional)...' : 'Description (optional)...'}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                           bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Prioridad' : 'Priority'}</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                               bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="Low">{language === 'es' ? 'Baja' : 'Low'}</option>
                    <option value="Medium">{language === 'es' ? 'Media' : 'Medium'}</option>
                    <option value="High">{language === 'es' ? 'Alta' : 'High'}</option>
                    <option value="Urgent">{language === 'es' ? 'Urgente' : 'Urgent'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Fecha de Entrega' : 'Due Date'}</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                               bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Asignar a' : 'Assign To'}</label>
                  <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                               bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">{language === 'es' ? 'Sin asignar' : 'Unassigned'}</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 dark:border-slate-700 text-slate-600 dark:text-zinc-300 dark:text-slate-400">{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                <button onClick={handleSubmit} disabled={submitting || !form.title.trim()}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  {submitting ? (language === 'es' ? 'Creando…' : 'Creating…') : (language === 'es' ? 'Crear Tarea' : 'Create Task')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban Columns */}
      {tasks.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 dark:border-slate-700">
          <CheckSquare size={32} className="mx-auto text-slate-300 dark:text-slate-600 dark:text-zinc-300 mb-3" />
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 dark:text-zinc-400">{language === 'es' ? 'Aún no hay tareas' : 'No tasks yet'}</p>
          <p className="text-xs text-slate-300 dark:text-slate-600 dark:text-zinc-300 mt-1">{language === 'es' ? 'Crea tu primera tarea para este cliente' : 'Create your first client task'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(({ key, icon: Icon, color }) => {
            const colTasks = tasks.filter(t => getTaskStatus(t) === key);
            const label = getTranslatedStatusLabel(key, language);
            return (
              <div key={key} className="rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60
                                        bg-slate-50 dark:bg-zinc-950/50 dark:bg-slate-800/20 overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-zinc-700 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={color} />
                    <span className="text-xs font-black text-slate-700 dark:text-zinc-200 dark:text-slate-300">{label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 dark:text-zinc-400">{colTasks.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-24">
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} clientId={clientId} employees={employees} onRefresh={onRefresh} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
