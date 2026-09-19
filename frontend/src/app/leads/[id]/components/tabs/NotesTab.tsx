'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, PinOff, Plus, Search, Trash2, Edit3, Save, X, StickyNote, Tag, Sparkles, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useLanguage } from '@/context/LanguageContext';

interface NotesTabProps {
  leadId: string | string[];
  notes: any[];
  onRefresh: () => void;
}

const TAG_COLORS: Record<string, string> = {
  pricing:       'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  urgent:        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  decisionmaker: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  followup:      'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  proposal:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  risk:          'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
};

function getTagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase().replace('#', '')] ||
    'bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800 text-slate-600 dark:text-zinc-300 dark:text-slate-400';
}

function NoteCard({ note, leadId, onRefresh }: { note: any; leadId: any; onRefresh: () => void }) {
  const { language } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(note.tags || []);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const togglePin = async () => {
    await fetch(`${API_BASE_URL}/leads/${leadId}/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    });
    onRefresh();
  };

  const deleteNote = async () => {
    const msg = language === 'es' ? '¿Eliminar esta nota?' : 'Delete this note?';
    if (!confirm(msg)) return;
    await fetch(`${API_BASE_URL}/leads/${leadId}/notes/${note.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const saveEdit = async () => {
    setSaving(true);
    await fetch(`${API_BASE_URL}/leads/${leadId}/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags }),
    });
    setSaving(false);
    setEditing(false);
    onRefresh();
  };

  const addTag = () => {
    const t = tagInput.replace(/^#/, '').trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const handleExtractTasks = async () => {
    setExtracting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${leadId}/notes/${note.id}/extract-tasks`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Extracted ${data.extracted_count} tasks! They have been added to the Tasks Board.`);
        onRefresh();
      } else {
        alert("Failed to extract tasks.");
      }
    } catch (err) {
      console.error(err);
      alert("Error extracting tasks.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-2xl border overflow-hidden shadow-sm transition-shadow hover:shadow-md
        ${note.is_pinned
          ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/10'
          : 'border-slate-200 dark:border-zinc-700 dark:border-slate-700/60 bg-white dark:bg-zinc-900 dark:bg-slate-900'
        }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {note.is_pinned && <Pin size={12} className="text-amber-500" />}
            <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400">
              {note.author_name && <span className="font-semibold text-slate-600 dark:text-zinc-300 dark:text-slate-400">{note.author_name} · </span>}
              {new Date(note.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={togglePin} className="p-1 rounded-lg hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-colors">
              {note.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
            <button onClick={handleExtractTasks} disabled={extracting} title="Extract Tasks via AI" className="p-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-500 transition-colors disabled:opacity-50">
              {extracting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            </button>
            <button onClick={() => setEditing(!editing)} className="p-1 rounded-lg hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors">
              {editing ? <X size={13} /> : <Edit3 size={13} />}
            </button>
            <button onClick={deleteNote} className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Content */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-xl border border-indigo-300 dark:border-indigo-700
                         bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            {/* Tag editor */}
            <div className="flex flex-wrap gap-1 mb-1">
              {tags.map(t => (
                <span key={t} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${getTagColor(t)}`}>
                  #{t}
                  <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-red-500">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="#tag"
                className="flex-1 px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                           bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={addTag} className="px-2 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
                <Tag size={12} />
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="flex-1 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 dark:border-slate-700 text-slate-600 dark:text-zinc-300 dark:text-slate-400">{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? (language === 'es' ? 'Guardando…' : 'Saving…') : (language === 'es' ? 'Guardar Nota' : 'Save Note')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-700 dark:text-zinc-200 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
        )}

        {/* Tags */}
        {!editing && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.map(t => (
              <span key={t} className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${getTagColor(t)}`}>
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function NotesTab({ leadId, notes, onRefresh }: NotesTabProps) {
  const { language } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [authorName, setAuthorName] = useState('Admin');

  const addTag = () => {
    const t = tagInput.replace(/^#/, '').trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/leads/${leadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags, is_pinned: isPinned, author_name: authorName }),
    });
    setContent('');
    setTags([]);
    setIsPinned(false);
    setShowForm(false);
    setSubmitting(false);
    onRefresh();
  };

  const filtered = notes.filter(n =>
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    (n.tags || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const pinned = filtered.filter(n => n.is_pinned);
  const unpinned = filtered.filter(n => !n.is_pinned);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar notas y etiquetas...' : 'Search notes and tags...'}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                       bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white
                     text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20"
        >
          <Plus size={14} /> {showForm ? (language === 'es' ? 'Cancelar' : 'Cancel') : (language === 'es' ? 'Añadir Nota' : 'Add Note')}
        </button>
      </div>

      {/* Add Note Form */}
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
              <h4 className="font-black text-sm text-slate-800 dark:text-zinc-100 dark:text-white">{language === 'es' ? 'Nueva Nota' : 'New Note'}</h4>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Autor' : 'Author'}</label>
                <input
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                             bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Contenido de Nota' : 'Note Content'}</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={language === 'es' ? 'Escribe tu nota aquí...' : 'Write your note here...'}
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                             bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              {/* Tags */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">{language === 'es' ? 'Etiquetas' : 'Tags'}</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.map(t => (
                    <span key={t} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${getTagColor(t)}`}>
                      #{t}
                      <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-red-500"><X size={9} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                    placeholder="#pricing, #urgent, #followup..."
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                               bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={addTag} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-zinc-700 dark:bg-slate-700 text-slate-700 dark:text-zinc-200 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600">{language === 'es' ? 'Añadir' : 'Add'}</button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {['pricing', 'urgent', 'decisionmaker', 'followup', 'proposal', 'risk'].map(preset => (
                    <button key={preset} onClick={() => !tags.includes(preset) && setTags(p => [...p, preset])}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer ${getTagColor(preset)}`}>
                      #{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="pin-note" checked={isPinned} onChange={e => setIsPinned(e.target.checked)}
                  className="rounded accent-amber-500" />
                <label htmlFor="pin-note" className="text-xs font-semibold text-slate-600 dark:text-zinc-300 dark:text-slate-400 cursor-pointer">
                  📌 {language === 'es' ? 'Fijar esta nota' : 'Pin this note'}
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 dark:border-slate-700 text-slate-600 dark:text-zinc-300 dark:text-slate-400">{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                <button onClick={handleSubmit} disabled={submitting || !content.trim()}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  {submitting ? (language === 'es' ? 'Guardando…' : 'Saving…') : (language === 'es' ? 'Añadir Nota' : 'Add Note')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned Section */}
      {pinned.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pin size={13} className="text-amber-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-500">{language === 'es' ? 'Fijado' : 'Pinned'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {pinned.map(note => <NoteCard key={note.id} note={note} leadId={leadId} onRefresh={onRefresh} />)}
          </div>
        </div>
      )}

      {/* All Notes */}
      {unpinned.length === 0 && pinned.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 dark:border-slate-700">
          <StickyNote size={32} className="text-slate-300 dark:text-slate-600 dark:text-zinc-300 mb-3" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 dark:text-zinc-400">{language === 'es' ? 'No hay notas aún' : 'No notes yet'}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-300 mt-1">{language === 'es' ? 'Añade tu primera nota para registrar información importante.' : 'Add your first note to keep track of important information.'}</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-5 flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20"
          >
            <Plus size={14} /> {language === 'es' ? 'Añadir Nota' : 'Add Note'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {unpinned.map(note => <NoteCard key={note.id} note={note} leadId={leadId} onRefresh={onRefresh} />)}
        </div>
      )}
    </div>
  );
}
