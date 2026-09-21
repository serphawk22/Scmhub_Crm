"use client";

import { useState, useEffect } from "react";
import {
  Plus, X, Loader2, CheckCircle2, Clock, AlertCircle, Zap,
  User, Calendar, Tag, Trash2, MessageSquare, ChevronDown
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';
import { useLanguage } from "@/context/LanguageContext";

interface Task {
  id: number;
  title: string;
  description?: string;
  status: "Todo" | "InProgress" | "Done";
  priority: "Low" | "Medium" | "High" | "Urgent";
  due_date?: string;
  client_id?: number;
  project_id?: number;
  assigned_to?: number;
  assignee_name?: string;
  client_name?: string;
  creator_name?: string;
  created_at: string;
}

interface Employee { id: number; name: string; email: string; }
interface Client { id: number; companyName?: string; name?: string; }

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

export default function TasksPage() {
  const { t } = useLanguage();
  const { user, role } = useRole();
  const userId = user?.id;
  const isClient = role === "Client";
  const clientId = user?.client_id;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", priority: "Medium",
    due_date: "", assigned_to: "", client_id: "", project_id: "",
  });

  const COLUMNS: { key: Task["status"]; label: string; color: string; bg: string; icon: any }[] = [
    { key: "Todo", label: t("tasks.col_todo"), color: "text-amber-500", bg: "bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-white/5", icon: Clock },
    { key: "InProgress", label: t("tasks.col_in_progress"), color: "text-sky-400", bg: "bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-white/5", icon: Zap },
    { key: "Done", label: t("tasks.col_done"), color: "text-emerald-500", bg: "bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-white/5", icon: CheckCircle2 },
  ];

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    let taskUrl = isClient && clientId
      ? `${API_BASE_URL}/tasks?client_id=${clientId}`
      : `${API_BASE_URL}/tasks`;
    if (!isClient && role === 'Employee' && userId) {
      taskUrl += (taskUrl.includes('?') ? '&' : '?') + `assigned_to=${userId}`;
    }
    const [tasksData, e, c] = await Promise.all([
      fetch(taskUrl).then(r => r.json()),
      isClient ? Promise.resolve({ employees: [] }) : fetch(`${API_BASE_URL}/employees`).then(r => r.json()),
      isClient ? Promise.resolve({ clients: [] }) : fetch(`${API_BASE_URL}/clients`).then(r => r.json()),
    ]);
    setTasks(tasksData.tasks || []);
    setEmployees(e.employees || []);
    setClients(c.clients || []);
    setLoading(false);
  }

  async function openDetail(task: Task) {
    setSelectedTask(task);
    setShowDetailModal(true);
    const res = await fetch(`${API_BASE_URL}/tasks/${task.id}`);
    const data = await res.json();
    setTaskComments(data.task?.comments || []);
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        client_id: form.client_id ? Number(form.client_id) : null,
        project_id: form.project_id ? Number(form.project_id) : null,
        created_by: userId || null,
      }),
    });
    setShowModal(false);
    setForm({ title: "", description: "", priority: "Medium", due_date: "", assigned_to: "", client_id: "", project_id: "" });
    fetchAll();
    setSubmitting(false);
  }

  async function moveTask(taskId: number, newStatus: Task["status"]) {
    await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  }

  async function deleteTask(taskId: number) {
    await fetch(`${API_BASE_URL}/tasks/${taskId}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setShowDetailModal(false);
  }

  async function addComment() {
    if (!newComment.trim() || !selectedTask) return;
    const res = await fetch(`${API_BASE_URL}/tasks/${selectedTask.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment, author_id: userId || null }),
    });
    const data = await res.json();
    setTaskComments(prev => [...prev, data]);
    setNewComment("");
  }

  const columnTasks = (status: Task["status"]) => tasks.filter(t => t.status === status);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight">{isClient ? t("tasks.title_client") : t("tasks.title_staff")}</h1>
          <p className="text-gray-500 dark:text-zinc-400 font-medium">{isClient ? t("tasks.subtitle_client") : t("tasks.subtitle_staff")}</p>
        </div>
        {!isClient && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> {t("tasks.new_task")}
          </button>
        )}
      </div>

      <PageGuide
        pageKey="tasks"
        title={isClient ? t("tasks.guide_title_client") : t("tasks.guide_title_staff")}
        description={isClient ? t("tasks.guide_desc_client") : t("tasks.guide_desc_staff")}
        steps={isClient ? [
          { icon: '📋', text: t("tasks.guide_cs1") },
          { icon: '🏷️', text: t("tasks.guide_cs2") },
          { icon: '📅', text: t("tasks.guide_cs3") },
          { icon: '💬', text: t("tasks.guide_cs4") },
        ] : [
          { icon: '➕', text: t("tasks.guide_s1") },
          { icon: '🔄', text: t("tasks.guide_s2") },
          { icon: '🏷️', text: t("tasks.guide_s3") },
          { icon: '🗑️', text: t("tasks.guide_s4") },
        ]}
      />

      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <div key={col.key} className={cn("rounded-2xl border p-4", col.bg)}>
            <div className="flex items-center gap-2 mb-1">
              <col.icon className={cn("w-4 h-4", col.color)} />
              <span className={cn("font-bold text-sm", col.color)}>{col.label}</span>
            </div>
            <span className="text-2xl font-black text-gray-900 dark:text-white">{columnTasks(col.key).length}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map(col => (
            <div
              key={col.key}
              className="rounded-2xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 p-4 min-h-[400px]"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (dragging !== null) moveTask(dragging, col.key);
                setDragging(null);
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <col.icon className={cn("w-4 h-4", col.color)} />
                <h3 className={cn("font-bold text-sm uppercase tracking-wide", col.color)}>{col.label}</h3>
                <span className="ml-auto bg-white dark:bg-zinc-900 border text-gray-500 dark:text-zinc-400 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {columnTasks(col.key).length}
                </span>
              </div>

              <div className="space-y-3">
                {columnTasks(col.key).map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => openDetail(task)}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-gray-900 dark:text-zinc-50 text-sm leading-snug">{task.title}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold shrink-0", PRIORITY_STYLES[task.priority])}>
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 mb-3">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      {task.assignee_name && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                          <User className="w-3 h-3" />{task.assignee_name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                          <Calendar className="w-3 h-3" />{task.due_date}
                        </span>
                      )}
                      {task.client_name && (
                        <span className="flex items-center gap-1 text-xs text-indigo-600">
                          <Tag className="w-3 h-3" />{task.client_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {columnTasks(col.key).length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">{t("tasks.drop_here")}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-zinc-50">{t("tasks.create_task")}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("tasks.field_title")}</label>
                <input
                  required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t("tasks.ph_title")}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("tasks.field_description")}</label>
                <textarea
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder={t("tasks.ph_description")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("tasks.field_priority")}</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {["Low", "Medium", "High", "Urgent"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("tasks.field_due_date")}</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("tasks.field_assign_to")}</label>
                  <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">{t("tasks.unassigned")}</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">{t("tasks.field_client")}</label>
                  <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">{t("tasks.no_client")}</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.companyName || c.name || `Client #${c.id}`}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 dark:bg-zinc-950">{t("tasks.cancel")}</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("tasks.create_btn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold", PRIORITY_STYLES[selectedTask.priority])}>
                    {selectedTask.priority}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 px-2 py-0.5 rounded-full font-semibold">{selectedTask.status}</span>
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-zinc-50">{selectedTask.title}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 ml-4"><X className="w-5 h-5" /></button>
            </div>

            {selectedTask.description && (
              <p className="text-sm text-gray-600 mb-4 bg-gray-50 dark:bg-zinc-950 p-3 rounded-xl">{selectedTask.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              {selectedTask.assignee_name && (
                <div className="flex items-center gap-2 text-gray-600"><User className="w-4 h-4" />{selectedTask.assignee_name}</div>
              )}
              {selectedTask.due_date && (
                <div className="flex items-center gap-2 text-gray-600"><Calendar className="w-4 h-4" />{selectedTask.due_date}</div>
              )}
              {selectedTask.client_name && (
                <div className="flex items-center gap-2 text-indigo-600"><Tag className="w-4 h-4" />{selectedTask.client_name}</div>
              )}
            </div>

            {!isClient && (
            <div className="flex gap-2 mb-6">
              {COLUMNS.filter(c => c.key !== selectedTask.status).map(col => (
                <button key={col.key} onClick={() => { moveTask(selectedTask.id, col.key); setSelectedTask(p => p ? { ...p, status: col.key } : null); }}
                  className={cn("flex-1 py-2 text-xs font-bold rounded-xl border transition-all", col.bg, col.color)}>
                  {t("tasks.move_to")} {col.label}
                </button>
              ))}
            </div>
            )}

            <div>
              <h3 className="font-bold text-gray-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> {t("tasks.comments")} ({taskComments.length})
              </h3>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {taskComments.map((c: any) => (
                  <div key={c.id} className="bg-gray-50 dark:bg-zinc-950 rounded-xl p-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      <span className="font-bold">{c.author_name}</span>
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-zinc-100">{c.content}</p>
                  </div>
                ))}
                {taskComments.length === 0 && <p className="text-sm text-gray-400 text-center py-4">{t("tasks.no_comments")}</p>}
              </div>
              <div className="flex gap-2">
                <input value={newComment} onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addComment()}
                  className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t("tasks.ph_comment")} />
                <button onClick={addComment} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold">{t("tasks.post")}</button>
              </div>
            </div>

            {!isClient && (
            <div className="mt-4 flex justify-end">
              <button onClick={() => deleteTask(selectedTask.id)}
                className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm font-semibold">
                <Trash2 className="w-4 h-4" /> {t("tasks.delete_task")}
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
