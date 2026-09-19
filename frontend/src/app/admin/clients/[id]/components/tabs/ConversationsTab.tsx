'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Phone, Mail, Users, MapPin, Globe, ChevronDown, ChevronUp, Send, Paperclip, X } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useLanguage } from '@/context/LanguageContext';

interface ConversationsTabProps {
  clientId: string | string[];
  conversations: any[];
  employees: any[];
  currentUser: string;
  onRefresh: () => void;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; bg: string; text: string; border: string }> = {
  call:     { icon: Phone,        label: 'Call Notes',      bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-800/50' },
  meeting:  { icon: Users,        label: 'Meeting Notes',   bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800/50' },
  email:    { icon: Mail,         label: 'Email Summary',   bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',     border: 'border-blue-200 dark:border-blue-800/50' },
  whatsapp: { icon: MessageSquare,label: 'WhatsApp Notes',  bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/50' },
  visit:    { icon: MapPin,       label: 'Visit Report',    bg: 'bg-rose-100 dark:bg-rose-900/30',     text: 'text-rose-700 dark:text-rose-400',     border: 'border-rose-200 dark:border-rose-800/50' },
  other:    { icon: Globe,        label: 'Other',           bg: 'bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800',      text: 'text-slate-600 dark:text-zinc-300 dark:text-slate-400',   border: 'border-slate-200 dark:border-zinc-700 dark:border-slate-700' },
};

function getTranslatedTypeConfig(type: string, t: (k: string) => string, language: string) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other;
  const labels: any = {
    call: language === 'es' ? 'Notas de Llamada' : 'Call Notes',
    meeting: language === 'es' ? 'Notas de Reunión' : 'Meeting Notes',
    email: language === 'es' ? 'Resumen de Correo' : 'Email Summary',
    whatsapp: language === 'es' ? 'Notas de WhatsApp' : 'WhatsApp Notes',
    visit: language === 'es' ? 'Reporte de Visita' : 'Visit Report',
    other: language === 'es' ? 'Otro' : 'Other'
  };
  return { ...cfg, label: labels[type] || cfg.label };
}

function ConversationCard({ conv, clientId, onRefresh }: { conv: any; clientId: any; onRefresh: () => void }) {
  const { t, language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const cfg = getTranslatedTypeConfig(conv.type, t, language);
  const Icon = cfg.icon;

  const submitReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/clients/${clientId}/conversations/${conv.id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: replyText, author_name: 'Admin' }),
    });
    setReplyText('');
    setSubmitting(false);
    onRefresh();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60
                 bg-white dark:bg-zinc-900 dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Card Header */}
      <div className={`px-4 pt-4 pb-3 border-l-4 ${cfg.border}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl ${cfg.bg} flex-shrink-0`}>
              <Icon size={14} className={cfg.text} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-zinc-100 dark:text-white">{conv.title}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400">
                  {new Date(conv.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {conv.author_name && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400">• {conv.author_name}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {conv.description && (
          <p className="text-sm text-slate-600 dark:text-zinc-300 dark:text-slate-400 mt-2 ml-9 leading-relaxed">
            {expanded ? conv.description : conv.description.slice(0, 120) + (conv.description.length > 120 ? '…' : '')}
          </p>
        )}
      </div>

      {/* Replies & Reply Box */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-100 dark:border-zinc-800 dark:border-slate-800">
              {/* Existing Replies */}
              {conv.replies?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {conv.replies.map((reply: any) => (
                    <div key={reply.id} className="ml-8 flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30
                                      flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                          {(reply.author_name || 'A').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 dark:bg-slate-800/60
                                      border border-slate-100 dark:border-zinc-800 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 dark:text-slate-300">
                            {reply.author_name || 'Admin'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(reply.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-300 dark:text-slate-400">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Input */}
              <div className="mt-3 ml-8 flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={language === 'es' ? 'Añadir una respuesta...' : 'Add a reply...'}
                  rows={2}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                             bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <button
                  onClick={submitReply}
                  disabled={submitting || !replyText.trim()}
                  className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700
                             disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ConversationsTab({ clientId, conversations, employees, currentUser, onRefresh }: ConversationsTabProps) {
  const { language } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'call', description: '', author_name: 'Admin' });
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/clients/${clientId}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', type: 'call', description: '', author_name: 'Admin' });
    setShowForm(false);
    setSubmitting(false);
    onRefresh();
  };

  const filtered = filterType === 'all' ? conversations : conversations.filter(c => c.type === filterType);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {['all', 'call', 'meeting', 'email', 'whatsapp', 'visit', 'other'].map(type => {
            const cfg = type === 'all' ? null : getTranslatedTypeConfig(type, () => '', language);
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all
                  ${filterType === type
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-500 dark:text-zinc-400 dark:text-slate-400 border border-slate-200 dark:border-zinc-700 dark:border-slate-700 hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-slate-700'
                  }`}
              >
                {type === 'all' ? (language === 'es' ? 'Todo' : 'All') : (cfg?.label || type)}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white
                     text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20"
        >
          <Plus size={14} /> {showForm ? (language === 'es' ? 'Cancelar' : 'Cancel') : (language === 'es' ? 'Registrar Conversación' : 'Log Conversation')}
        </button>
      </div>

      {/* Add Conversation Form */}
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
              <h4 className="font-black text-sm text-slate-800 dark:text-zinc-100 dark:text-white">{language === 'es' ? 'Registrar Nueva Conversación' : 'Log New Conversation'}</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Tipo' : 'Type'}</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                               bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="call">{language === 'es' ? 'Notas de Llamada' : 'Call Notes'}</option>
                    <option value="meeting">{language === 'es' ? 'Notas de Reunión' : 'Meeting Notes'}</option>
                    <option value="email">{language === 'es' ? 'Resumen de Correo' : 'Email Summary'}</option>
                    <option value="whatsapp">{language === 'es' ? 'Notas de WhatsApp' : 'WhatsApp Notes'}</option>
                    <option value="visit">{language === 'es' ? 'Reporte de Visita' : 'Visit Report'}</option>
                    <option value="other">{language === 'es' ? 'Otro' : 'Other'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Autor' : 'Author'}</label>
                  <input
                    value={form.author_name}
                    onChange={e => setForm(p => ({ ...p, author_name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                               bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Título' : 'Title'}</label>
                <input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder={language === 'es' ? 'ej. Llamada con CEO' : 'e.g. Discovery call with CEO'}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                             bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Descripción / Notas' : 'Description / Notes'}</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder={language === 'es' ? 'Puntos clave, decisiones...' : 'Key discussion points, decisions made, action items...'}
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                             bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                             text-slate-600 dark:text-zinc-300 dark:text-slate-400 hover:bg-white dark:bg-zinc-900 dark:hover:bg-slate-800 transition-colors"
                >{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !form.title.trim()}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white
                             hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? (language === 'es' ? 'Guardando…' : 'Saving…') : (language === 'es' ? 'Registrar Conversación' : 'Log Conversation')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 dark:border-slate-700">
          <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-slate-600 dark:text-zinc-300 mb-3" />
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 dark:text-zinc-400">{language === 'es' ? 'Aún no hay conversaciones' : 'No conversations yet'}</p>
          <p className="text-xs text-slate-300 dark:text-slate-600 dark:text-zinc-300 mt-1">{language === 'es' ? 'Registre su primera llamada, reunión o correo' : 'Log your first call, meeting, or email'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((conv: any) => (
            <ConversationCard key={conv.id} conv={conv} clientId={clientId} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}
