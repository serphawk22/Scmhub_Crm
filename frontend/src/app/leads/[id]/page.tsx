'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, MessageSquare, StickyNote, CheckSquare, Building2, ChevronDown,
  Target, FolderOpen, HeartPulse, LayoutDashboard, Users,
  TrendingUp, TrendingDown, Lightbulb, ShieldAlert, DollarSign, Zap, Star, Mail, Clock, Ticket, Globe, Navigation, Store, Tag, Phone, X, FileText, Send, Search, Filter, Check, Smartphone, Calendar, AlertCircle, ArrowUpRight, Copy, Brain, Loader2, Radar
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ResultCard } from '@/components/email-agent/ResultCard';

import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import { useLanguage } from '@/context/LanguageContext';

import LeadHeader from './components/LeadHeader';
import LeadSidebarPanel from './components/LeadSidebarPanel';
import AiCopilotPanelLead from './components/AiCopilotPanelLead';
import TimelineTab from './components/tabs/TimelineTab';
import ConversationsTab from './components/tabs/ConversationsTab';
import NotesTab from './components/tabs/NotesTab';
import TasksTab from './components/tabs/TasksTab';
import FilesTab from './components/tabs/FilesTab';
import AiDataTab from '@/app/admin/clients/[id]/components/tabs/AiDataTab';

// ─── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',       label: 'Overview',       icon: LayoutDashboard },
  { key: 'timeline',       label: 'Timeline',        icon: Activity        },
  { key: 'ai_data',        label: 'AI DATA',         icon: Brain           },
  { key: 'files',          label: 'Files',           icon: FolderOpen      },
  { key: 'conversations',  label: 'Conversations',   icon: MessageSquare   },
];

// ─── Loading Skeleton ────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-zinc-700  rounded-xl ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 ">
      <div className="h-36 bg-white dark:bg-zinc-900  border-b border-slate-200 dark:border-zinc-700  animate-pulse" />
      <div className="w-full px-6 py-6 grid grid-cols-[280px_1fr_300px] gap-6">
        <div className="space-y-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
        <div>
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible section — forced light ────────────────────────────────────
function CollapsibleSection({ title, icon: Icon, count, defaultOpen = false, accentColor = '#6366f1', hexText = '#1e293b', children }: {
  title: string; icon: any; count?: number; defaultOpen?: boolean; accentColor?: string; hexText?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginTop: 0 }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: accentColor, borderRadius: 8, padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={12} color="#fff" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>{title}</span>
          {count !== undefined && count > 0 && (
            <span style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{count}</span>
          )}
        </div>
        <ChevronDown size={14} color="#94a3b8" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab — premium light ──────────────────────────────────────────
function OverviewTab({ lead, employees, serviceRequests, activities, timeline, research, notes, conversations, leadId, onNotesRefresh, onConversationsRefresh, emails, handleGenerateAnalysis, isGeneratingResearch, onRefresh }: any) {
  const { t, language } = useLanguage();
  const recentActivities = (activities || []).slice(0, 8);

  // ── Add Note ────────────────────────────────────────────────────────────
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteFocus, setNoteFocus] = useState(false);

  const submitNote = async () => {
    const txt = noteText.trim();
    if (!txt) return;
    setSavingNote(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ content: txt, author_name: 'Admin' }),
      });
      setNoteText('');
      onNotesRefresh?.();
    } finally { setSavingNote(false); }
  };

  // ── Log Conversation ─────────────────────────────────────────────────────
  const CONV_TYPES = [
    { key: 'call', label: '📞 Call', color: '#3b82f6' },
    { key: 'email', label: '✉️ Email', color: '#6366f1' },
    { key: 'meeting', label: '🗓 Meeting', color: '#8b5cf6' },
    { key: 'whatsapp', label: '💬 WhatsApp', color: '#10b981' },
    { key: 'chat', label: '⚡ Chat', color: '#0ea5e9' },
    { key: 'other', label: '📝 Other', color: 'var(--text-secondary)' },
  ];
  const [convTitle, setConvTitle] = useState('');
  const [convType, setConvType] = useState('call');
  const [convBody, setConvBody] = useState('');
  const [savingConv, setSavingConv] = useState(false);

  const submitConv = async () => {
    const title = convTitle.trim();
    if (!title) return;
    setSavingConv(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/leads/${leadId}/conversations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ title, type: convType, description: convBody.trim(), author_name: 'Admin' }),
      });
      setConvTitle(''); setConvBody(''); setConvType('call');
      onConversationsRefresh?.();
    } finally { setSavingConv(false); }
  };

  const activeConvType = CONV_TYPES.find(t => t.key === convType)!;

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' as const };
  const input = { width: '100%', background: 'var(--bg-secondary)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '11px 14px', fontSize: 13.5, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14, background: 'var(--bg-secondary)', minHeight: '100%' }}>

      {/* Company Overview */}
      {research?.company_overview && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 20px', backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ background: 'var(--accent)', borderRadius: 8, padding: '4px 7px', display: 'flex' }}><Building2 size={13} color="#fff" /></div>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-primary)' }}>Company Overview</span>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{research.company_overview}</p>
        </div>
      )}
      {/* Key Decision Makers */}
      {(() => {
        let people: any[] = [];
        try {
          if (research?.key_decision_makers) {
            people = JSON.parse(research.key_decision_makers);
          }
        } catch {}
        if (people && people.length > 0) {
          return (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 20px', backdropFilter: 'blur(16px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'var(--accent)', borderRadius: 8, padding: '4px 7px', display: 'flex' }}><Users size={13} color="#fff" /></div>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-primary)' }}>Key Decision Makers</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{people.length} extracted</span>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Name & Role</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Contact</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Socials</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)' }}>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ fontWeight: 700 }}>{p.name || 'Unknown Name'}</div>
                          {p.role && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{p.role}</div>}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          {p.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={12} color="var(--text-muted)"/> <a href={`mailto:${p.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{p.email}</a></div>}
                          {p.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><Phone size={12} color="var(--text-muted)"/> <a href={`tel:${p.phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{p.phone}</a></div>}
                          {!p.email && !p.phone && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not found</span>}
                        </td>
                        <td style={{ padding: '12px 12px', display: 'flex', gap: 8 }}>
                          {p.linkedin ? (
                            <a href={p.linkedin} target="_blank" rel="noreferrer" style={{ padding: '4px 8px', background: '#e0f2fe', color: '#0284c7', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>LinkedIn</a>
                          ) : null}
                          {p.twitter ? (
                            <a href={p.twitter} target="_blank" rel="noreferrer" style={{ padding: '4px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>X/Twitter</a>
                          ) : null}
                          {!p.linkedin && !p.twitter && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* ── Services Offered ──────────────────────────────────────────── */}
      {(() => {
        let parsedServices: any[] = [];
        try {
          const serviceSource = lead?.services_offered
            || lead?.ai_analysis_results?.services_offered
            || lead?.ai_analysis_results?.product_portfolio;
          if (serviceSource) {
            parsedServices = typeof serviceSource === 'string'
              ? JSON.parse(serviceSource)
              : serviceSource;
          }
        } catch {}
        if (!Array.isArray(parsedServices) || parsedServices.length === 0) return null;
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 20px', backdropFilter: 'blur(16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'var(--accent)', borderRadius: 8, padding: '4px 7px', display: 'flex' }}><Store size={13} color="#fff" /></div>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-primary)' }}>Services Offered</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{parsedServices.length} services detected</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {parsedServices.map((svc: any, i: number) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--text-primary)', background: 'var(--bg-hover)', borderRadius: 20, padding: '2px 7px' }}>{svc.category || 'Service'}</span>
                    {svc.approx_cost > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-primary)', background: 'var(--bg-hover)', borderRadius: 20, padding: '2px 7px', marginLeft: 'auto' }}>
                        ~${Number(svc.approx_cost).toLocaleString()}{svc.cost_is_estimated ? ' est.' : ''}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{svc.name}</p>
                  {svc.brief && <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{svc.brief}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Sheet Data (Imported Fields) ────────────────────────── */}
      {lead?.customFields?.sheet_data && Object.keys(lead.customFields.sheet_data).length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 20px', backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ background: '#10b981', borderRadius: 8, padding: '4px 7px', display: 'flex' }}>
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M3 3a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H3zm0 2h14v1H3V5zm0 3h14v7H3V8z"/></svg>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-primary)' }}>Sheet Data</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{Object.keys(lead.customFields.sheet_data).length} fields</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {Object.entries(lead.customFields.sheet_data)
              .filter(([k, v]) => {
                if (!v || !String(v).trim()) return false;
                const lowerK = k.toLowerCase().trim();
                const ignored = [
                  'team member',
                  'research status (pending/in progress/completed)',
                  'research status',
                  'start date',
                  'end date'
                ];
                return !ignored.includes(lowerK);
              })
              .map(([key, val]) => (
                <div key={key} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', margin: '0 0 4px 0' }}>{key}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word' }}>{String(val)}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
          <div style={{ background: 'var(--accent)', borderRadius: 9, padding: '5px 7px', display: 'flex' }}><StickyNote size={13} color="#fff" /></div>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--text-primary)' }}>Add Note</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>Ctrl+Enter to save</span>
        </div>
        <div style={{ padding: '14px 20px 16px' }}>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitNote(); }}
            onFocus={() => setNoteFocus(true)}
            onBlur={() => setNoteFocus(false)}
            placeholder="What happened? Write your note here…"
            rows={3}
            style={{ ...input, resize: 'none', border: noteFocus ? '1.5px solid #059669' : '1.5px solid #e2e8f0', transition: 'border 0.15s', display: 'block' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={submitNote}
              disabled={!noteText.trim() || savingNote}
              style={{ background: noteText.trim() ? 'var(--accent)' : 'var(--bg-hover)', color: noteText.trim() ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 12.5, fontWeight: 700, cursor: noteText.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}
            >
              {savingNote ? 'Saving…' : '✓ Save Note'}
            </button>
          </div>
        </div>

        {/* Previous notes — collapsed */}
        {notes && notes.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <CollapsibleSection title="Previous Notes" icon={StickyNote} count={notes.length} accentColor="#059669">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10 }}>
                {notes.slice(0, 10).map((n: any) => (
                  <div key={n.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--accent)' }}>{n.type || 'Note'}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{n.content}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* ── Log Conversation ───────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
          <div style={{ background: 'var(--accent)', borderRadius: 9, padding: '5px 7px', display: 'flex' }}><MessageSquare size={13} color="#fff" /></div>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--text-primary)' }}>Log Conversation</span>
        </div>
        <div style={{ padding: '14px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Type pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 7 }}>
            {CONV_TYPES.map(tp => (
              <button
                key={tp.key}
                onClick={() => setConvType(tp.key)}
                style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  border: convType === tp.key ? `2px solid ${tp.color}` : '1.5px solid var(--border)',
                  background: convType === tp.key ? tp.color : 'var(--bg-secondary)',
                  color: convType === tp.key ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {tp.label}
              </button>
            ))}
          </div>
          <input
            value={convTitle}
            onChange={e => setConvTitle(e.target.value)}
            placeholder={`${activeConvType.label} summary — what was discussed?`}
            style={input}
          />
          <textarea
            value={convBody}
            onChange={e => setConvBody(e.target.value)}
            placeholder="Additional details, action items, follow-ups… (optional)"
            rows={2}
            style={{ ...input, resize: 'none', display: 'block' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={submitConv}
              disabled={!convTitle.trim() || savingConv}
              style={{ background: convTitle.trim() ? activeConvType.color : 'var(--bg-hover)', color: convTitle.trim() ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 12.5, fontWeight: 700, cursor: convTitle.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}
            >
              {savingConv ? 'Saving…' : `✓ Log ${activeConvType.label}`}
            </button>
          </div>
        </div>

        {/* Previous conversations — collapsed */}
        {conversations && conversations.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <CollapsibleSection title="Previous Conversations" icon={MessageSquare} count={conversations.length} accentColor="#0284c7">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10 }}>
                {conversations.slice(0, 10).map((c: any) => {
                  const ct = CONV_TYPES.find(t => t.key === c.type) || CONV_TYPES[5];
                  return (
                    <div key={c.id} style={{ background: 'var(--bg-secondary)', border: '1px solid #e0f2fe', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: ct.color, background: ct.color + '18', borderRadius: 999, padding: '2px 8px' }}>{c.type || 'Conversation'}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</span>
                      </div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 2px' }}>{c.subject || c.title || '—'}</p>
                      {c.body && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{c.body}</p>}
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <CollapsibleSection title={t('lead_tabs.recent_activity') !== 'lead_tabs.recent_activity' ? t('lead_tabs.recent_activity') : 'Recent Activity'} icon={Activity} accentColor="#6366f1" defaultOpen={false}>
        <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {recentActivities.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>{t('lead_tabs.no_activity') !== 'lead_tabs.no_activity' ? t('lead_tabs.no_activity') : 'No recent activity.'}</p>
          ) : (
            recentActivities.map((a: any) => (
              <div 
                key={a.id} 
                onClick={() => setSelectedActivity(a)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 8px', borderBottom: '1px solid var(--border)', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Clock size={12} color="#94a3b8" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.action}</p>
                  {a.method && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0' }}>via {a.method}</p>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {a.createdAt ? new Date(a.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </CollapsibleSection>



      {/* SWOT Section */}
      <CollapsibleSection title="SWOT Analysis" icon={Radar} accentColor="#f97316" defaultOpen={true}>
        <div style={{ paddingTop: 16 }}>
          <LeadSwotTab lead={lead} onRefresh={onRefresh} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ─── SWOT TAB ────────────────────────────────────────────────────────────────
function LeadSwotTab({ lead, onRefresh }: { lead: any, onRefresh: () => void }) {
  const [isSwotLoading, setIsSwotLoading] = useState(false);

  const handleGenerateSwot = async () => {
    setIsSwotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead.id}/swot`, { method: 'POST' });
      if (res.ok) {
        onRefresh();
      } else {
        const err = await res.json();
        alert(`Failed to generate SWOT: ${err.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to AI');
    } finally {
      setIsSwotLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"></div>
          <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">SWOT Analysis</h2>
        </div>
        {lead.swot_analysis && (
          <button
            onClick={handleGenerateSwot}
            disabled={isSwotLoading}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/30 transition-all disabled:opacity-50"
          >
            {isSwotLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {isSwotLoading ? 'Analyzing...' : 'Refresh SWOT'}
          </button>
        )}
      </div>

      {lead.swot_analysis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(() => {
            let swot = null;
            try {
              swot = JSON.parse(lead.swot_analysis);
            } catch (e) {}

            if (!swot) return <div className="col-span-2 text-slate-500 italic p-6 bg-slate-50 rounded-2xl">Invalid SWOT data. Please regenerate.</div>;

            return (
              <>
                <div className="col-span-1 md:col-span-2 p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl shadow-sm">
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed text-center">
                    {swot.summary}
                  </p>
                </div>

                <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-3xl">
                  <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-400 mb-4 flex items-center gap-2">
                    <TrendingUp size={20} /> Strengths
                  </h3>
                  <ul className="space-y-3">
                    {swot.strengths?.map((s: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                        <span className="font-bold shrink-0 mt-0.5">•</span> <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-3xl">
                  <h3 className="text-lg font-black text-red-800 dark:text-red-400 mb-4 flex items-center gap-2">
                    <TrendingDown size={20} /> Weaknesses
                  </h3>
                  <ul className="space-y-3">
                    {swot.weaknesses?.map((w: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-red-700 dark:text-red-300">
                        <span className="font-bold shrink-0 mt-0.5">•</span> <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-3xl">
                  <h3 className="text-lg font-black text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
                    <Lightbulb size={20} /> Opportunities
                  </h3>
                  <ul className="space-y-3">
                    {swot.opportunities?.map((o: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-blue-700 dark:text-blue-300">
                        <span className="font-bold shrink-0 mt-0.5">•</span> <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-3xl">
                  <h3 className="text-lg font-black text-amber-800 dark:text-amber-400 mb-4 flex items-center gap-2">
                    <ShieldAlert size={20} /> Threats
                  </h3>
                  <ul className="space-y-3">
                    {swot.threats?.map((t: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <span className="font-bold shrink-0 mt-0.5">•</span> <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-slate-50 dark:bg-zinc-900/50 border border-dashed border-slate-300 dark:border-zinc-700 rounded-3xl">
          <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-sm mb-4">
            <Radar size={28} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300 mb-2">No SWOT Analysis yet</h3>
          <p className="text-sm text-slate-500 text-center max-w-md mb-6">Run a deep AI analysis of this lead's website to identify their Strengths, Weaknesses, Opportunities, and Threats.</p>
          <button
            onClick={handleGenerateSwot}
            disabled={isSwotLoading || !lead.website}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSwotLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {isSwotLoading ? 'Analyzing...' : (lead.website ? 'Perform SWOT Analysis' : 'Add Website URL first')}
          </button>
        </div>
      )}
    </motion.div>
  );
}



// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function LeadDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { role, user, loading } = useRole();
  const { t, language } = useLanguage();

  // Data state
  const [lead, setLead]               = useState<any>(null);
  const [employees, setEmployees]         = useState<any[]>([]);
  const [activities, setActivities]       = useState<any[]>([]);
  const [emails, setEmails]               = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [timeline, setTimeline]           = useState<any[]>([]);
  const [notes, setNotes]                 = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [tasks, setTasks]                 = useState<any[]>([]);
  const [files, setFiles]                 = useState<any[]>([]);
  const [research, setResearch]           = useState<any>(null);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);

  // UI state
  const [activeTab, setActiveTab]         = useState('overview');
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [pageLoading, setPageLoading]     = useState(true);
  const [darkMode, setDarkMode]           = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'SalesManager', password: 'password123' });
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  // Force light theme always — no dark mode on this page
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('crm-dark-mode', 'false');
    setDarkMode(false);
  }, []);

  const toggleDarkMode = () => {
    // Light theme only — toggle is a no-op
  };


  // ─── Fetch helpers ────────────────────────────────────────────────────────
  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${id}`);
      if (!res.ok) throw new Error("Failed to load lead");
      const data = await res.json();
      const leadData = data.client || data;
      setLead({ ...leadData, assignedEmployeeId: leadData.assignedEmployeeId || leadData.owner_id || null });
    } catch (e) { console.error(e); }
  }, [id]);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem('token');
      const fetchJson = (url: string) => fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }).then(r => { if (!r.ok) throw new Error(`Fetch failed for ${url}`); return r.json(); });
      const [leadRes, empRes, actRes, emailRes, svcRes, tlRes, notesRes, convRes, taskRes, filesRes, researchRes] = await Promise.allSettled([
        fetchJson(`${API_BASE_URL}/leads/${id}`),
        fetchJson(`${API_BASE_URL}/users`),
        fetchJson(`${API_BASE_URL}/leads/${id}/activities`),
        fetchJson(`${API_BASE_URL}/leads/${id}/sent-emails`),
        fetchJson(`${API_BASE_URL}/services/requests`),
        fetchJson(`${API_BASE_URL}/leads/${id}/timeline`),
        fetchJson(`${API_BASE_URL}/leads/${id}/notes`),
        fetchJson(`${API_BASE_URL}/leads/${id}/conversations`),
        fetchJson(`${API_BASE_URL}/tasks?lead_id=${id}`),
        fetchJson(`${API_BASE_URL}/leads/${id}/files`),
        fetchJson(`${API_BASE_URL}/leads/${id}/research`),
      ]);

      if (leadRes.status === 'fulfilled') {
        const leadData = leadRes.value.client || leadRes.value;
        setLead({ ...leadData, assignedEmployeeId: leadData.assignedEmployeeId || leadData.owner_id || null });
      }
      if (empRes.status === 'fulfilled') setEmployees(empRes.value.users || []);
      if (actRes.status === 'fulfilled') setActivities(actRes.value.activities || []);
      if (emailRes.status === 'fulfilled') setEmails(emailRes.value.emails || []);
      if (svcRes.status === 'fulfilled') setServiceRequests((svcRes.value.requests || []).filter((r: any) => String(r.lead_id) === String(id)));
      if (tlRes.status === 'fulfilled') setTimeline(tlRes.value.timeline || []);
      if (notesRes.status === 'fulfilled') setNotes(notesRes.value.notes || []);
      if (convRes.status === 'fulfilled') setConversations(convRes.value.conversations || []);
      if (taskRes.status === 'fulfilled') {
        const tVal = Array.isArray(taskRes.value?.tasks) ? taskRes.value.tasks : (Array.isArray(taskRes.value) ? taskRes.value : []);
        setTasks(tVal.filter((t: any) => String(t.client_id) === String(id)));
      }
      if (filesRes.status === 'fulfilled') {
        const fVal = Array.isArray(filesRes.value?.files) ? filesRes.value.files : (Array.isArray(filesRes.value) ? filesRes.value : []);
        setFiles(fVal);
      }
      if (researchRes.status === 'fulfilled') setResearch(researchRes.value.research || null);
    } catch (e) { console.error(e); }
    finally { setPageLoading(false); }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handleRefresh = () => fetchAll();
    window.addEventListener('refresh-lead-data', handleRefresh);
    return () => window.removeEventListener('refresh-lead-data', handleRefresh);
  }, [fetchAll]);

  // ─── Quick action stubs ───────────────────────────────────────────────────
  const switchTab = (tab: string) => setActiveTab(tab);

  const handleCreateSalesperson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm),
      });
      if (res.ok) {
        const text = await res.text().catch(() => "");
        let data: any = {};
        try { data = JSON.parse(text); } catch (e) {}
        // Automatically assign the newly created user to this client
        await fetch(`${API_BASE_URL}/leads/${id}/assign-employee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: data.user.id }),
        });
        setNewUserForm({ name: '', email: '', role: 'SalesManager', password: 'password123' });
        setIsCreateUserOpen(false);
        fetchAll(); // Refresh employees and client details
      } else {
        alert('Failed to create user. Email might already exist.');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating salesperson');
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!id) return;
    setIsGeneratingResearch(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${id}/auto-research`, { method: 'POST' });
      if (!res.ok) { setIsGeneratingResearch(false); return; }
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch(`${API_BASE_URL}/leads/${id}/research`);
          if (r.ok) {
            const d = await r.json();
            if (d.research?.email_agent_data || d.research?.company_overview) {
              setResearch(d.research);
              clearInterval(poll);
              setIsGeneratingResearch(false);
              return;
            }
          }
        } catch {}
        if (attempts >= 24) { clearInterval(poll); setIsGeneratingResearch(false); }
      }, 5000);
    } catch {
      setIsGeneratingResearch(false);
    }
  };

  // ─── Loading & Auth Guards ────────────────────────────────────────────────
  if (loading || pageLoading) return <PageSkeleton />;

  // Auth guard
  if (role && role !== 'Admin' && role !== 'SuperAdmin' && role !== 'Employee' && role !== 'SalesManager' && role !== 'Demo') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 ">
        <div className="text-center">
          <p className="text-2xl font-black text-red-500 mb-2">{language === 'es' ? 'No autorizado' : 'Unauthorized'}</p>
          <p className="text-slate-500 dark:text-zinc-400">{language === 'es' ? 'No tienes acceso a esta página.' : 'You do not have access to this page.'}</p>
        </div>
      </div>
    );
  }

  // Enforce assignment for SalesManager
  if (lead && role === 'SalesManager' && String(lead.assignedEmployeeId) !== String(user?.id)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 ">
        <div className="text-center">
          <p className="text-2xl font-black text-red-500 mb-2">{language === 'es' ? 'No autorizado' : 'Unauthorized'}</p>
          <p className="text-slate-500 dark:text-zinc-400">{language === 'es' ? 'Solo puedes ver clientes que te han sido asignados.' : 'You can only view clients assigned to you.'}</p>
        </div>
      </div>
    );
  }

  if (pageLoading) return <PageSkeleton />;
  if (!lead) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 ">
      <p className="text-red-500 font-bold">{language === 'es' ? 'Cliente no encontrado.' : 'Lead not found.'}</p>
    </div>
  );

  const tabBadges: Record<string, number> = {
    conversations: conversations.length,
    notes:         notes.length,
    files:         files.length,
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-zinc-950  transition-colors duration-300`}>
      <AnimatePresence>
        {isCreateUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900  rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-zinc-700 "
            >
              <div className="p-4 border-b border-slate-100 dark:border-zinc-800  flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-zinc-100 ">{language === 'es' ? 'Crear Nuevo Vendedor' : 'Create New Salesperson'}</h2>
                <button onClick={() => setIsCreateUserOpen(false)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-300 ">
                  <Activity size={20} className="opacity-0" /> {/* Spacer */}
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
              <form onSubmit={handleCreateSalesperson} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">{language === 'es' ? 'Nombre' : 'Name'}</label>
                  <input required value={newUserForm.name} onChange={e => setNewUserForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700  bg-slate-50 dark:bg-zinc-950  focus:outline-none focus:ring-2 focus:ring-indigo-500 " />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Email</label>
                  <input required type="email" value={newUserForm.email} onChange={e => setNewUserForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700  bg-slate-50 dark:bg-zinc-950  focus:outline-none focus:ring-2 focus:ring-indigo-500 " />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">{language === 'es' ? 'Rol' : 'Role'}</label>
                  <select value={newUserForm.role} onChange={e => setNewUserForm(p => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700  bg-slate-50 dark:bg-zinc-950  focus:outline-none focus:ring-2 focus:ring-indigo-500 ">
                    <option value="Employee">{language === 'es' ? 'Empleado' : 'Employee'}</option>
                    <option value="SalesManager">{language === 'es' ? 'Gerente de Ventas' : 'Sales Manager'}</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">{language === 'es' ? 'Crear y Asignar' : 'Create & Assign'}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Sticky Header ────────────────────────────────────────────── */}
      <LeadHeader
        lead={lead}
        employees={employees}
        onBack={() => router.back()}
        onAddNote={() => switchTab('notes')}
        onAddConversation={() => switchTab('conversations')}
        onCreateTask={() => switchTab('tasks')}
        onScheduleMeeting={() => router.push('/meetings')}
        onSendEmail={() => lead?.email ? window.location.href = `mailto:${lead.email}` : alert(language === 'es' ? 'No hay correo' : 'No email found for this client')}
        onUploadFile={() => switchTab('files')}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* ── Full-Width layout ──────────────────────────────────────── */}
      <div className="w-full px-4 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">

          {/* ── CENTER MAIN ──────────────────────────────────────────── */}
          <main className="min-w-0">
            {/* Tab Bar - Premium Pill Style */}
            <div className="flex items-center gap-2 overflow-x-auto p-1.5 mb-6 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700/60 scrollbar-thin w-fit max-w-full">
              {TABS.map(({ key, label, icon: Icon }) => {
                const badge = tabBadges[key];
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold
                                whitespace-nowrap transition-all flex-shrink-0
                      ${activeTab === key
                        ? 'bg-white dark:bg-zinc-900 text-indigo-600 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-200 dark:border-zinc-700/50'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:bg-zinc-700/50'
                      }`}
                  >
                    <Icon size={14} className={activeTab === key ? 'text-indigo-500' : 'text-slate-400'} />
                    {t(`lead_tabs.${key}`) !== `lead_tabs.${key}` ? (t(`lead_tabs.${key}`) as string) : label}
                    {badge !== undefined && badge > 0 && (
                      <span className={`ml-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center transition-colors
                        ${activeTab === key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'}`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'overview' && (
                  <OverviewTab
                    lead={lead}
                    employees={employees}
                    serviceRequests={serviceRequests}
                    activities={activities}
                    timeline={timeline}
                    research={research}
                    notes={notes}
                    conversations={conversations}
                    emails={emails}
                    leadId={id}
                    onNotesRefresh={() => fetch(`${API_BASE_URL}/leads/${id}/notes`).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => setNotes(d.notes || []))}
                    onConversationsRefresh={() => fetch(`${API_BASE_URL}/leads/${id}/conversations`).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => setConversations(d.conversations || []))}
                    handleGenerateAnalysis={handleGenerateAnalysis}
                    isGeneratingResearch={isGeneratingResearch}
                    onRefresh={fetchAll}
                  />
                )}
                {activeTab === 'timeline' && (
                  <TimelineTab
                    timeline={timeline}
                    timelineFilter={timelineFilter}
                    onFilterChange={setTimelineFilter}
                  />
                )}
                {activeTab === 'ai_data' && (
                  <AiDataTab
                    clientId={id}
                    websiteUrl={lead?.websiteUrl || lead?.website}
                    resourceType="leads"
                    onClientRefresh={fetchLead}
                  />
                )}
                {activeTab === 'conversations' && (
                  <ConversationsTab
                    leadId={id}
                    conversations={conversations}
                    employees={employees}
                    currentUser="Admin"
                    onRefresh={() => fetch(`${API_BASE_URL}/leads/${id}/conversations`).then(r => r.json()).then(d => setConversations(d.conversations || []))}
                  />
                )}
                {activeTab === 'notes' && (
                  <NotesTab
                    leadId={id}
                    notes={notes}
                    onRefresh={() => fetch(`${API_BASE_URL}/leads/${id}/notes`).then(r => r.json()).then(d => setNotes(d.notes || []))}
                  />
                )}
                {activeTab === 'files' && (
                  <FilesTab
                    leadId={id}
                    files={files}
                    onRefresh={() => fetch(`${API_BASE_URL}/leads/${id}/files`).then(r => r.json()).then(d => setFiles(d.files || d || []))}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* ── RIGHT AI PANEL ──────────────────────────────────────── */}
          <aside className="space-y-4">
            <AiCopilotPanelLead leadId={id} lead={lead} />

            {/* Assign Salesperson Card */}
            {role === 'Admin' && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-700  bg-white dark:bg-zinc-900  p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400  mb-3">{language === 'es' ? 'Asignar Vendedor' : 'Assign Salesperson'}</p>
                {/* Show assigned name badge if already assigned */}
                {lead?.assignedEmployeeId && employees.find((e: any) => String(e.id) === String(lead.assignedEmployeeId)) && (
                  <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                      {(employees.find((e: any) => String(e.id) === String(lead.assignedEmployeeId))?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-indigo-700 truncate">
                      {employees.find((e: any) => String(e.id) === String(lead.assignedEmployeeId))?.name}
                    </span>
                    <span className="text-[10px] text-indigo-400 ml-auto font-semibold">Assigned</span>
                  </div>
                )}
                <select
                  value={lead?.assignedEmployeeId || ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val === 'create_new') {
                      setIsCreateUserOpen(true);
                      // Reset to original value visually so 'create_new' doesn't stay selected
                      e.target.value = lead?.assignedEmployeeId || '';
                      return;
                    }
                    await fetch(`${API_BASE_URL}/leads/${id}/assign-employee`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ employee_id: Number(val) }),
                    });
                    fetchLead();
                  }}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 
                             bg-slate-50 dark:bg-zinc-950  text-slate-800 dark:text-zinc-100 
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{language === 'es' ? 'Cambiar vendedor…' : 'Change salesperson…'}</option>
                  <option value="create_new" className="font-bold text-indigo-600">➕ {language === 'es' ? 'Crear Nuevo Vendedor' : 'Create New Salesperson'}</option>
                  {employees.filter((e: any) => ["Employee", "Admin", "SalesManager"].includes(e.role)).map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
                  ))}
                </select>
              </div>
            )}


            {/* Next Follow-up */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-700  bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex gap-2 mb-4">
                {lead?.website && (
                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                    <Globe className="w-3.5 h-3.5" /> Visit Site
                  </a>
                )}
                <button 
                  onClick={() => router.push(`/leads/${id}/competitors`)}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" /> Radar Scan
                </button>
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400  mb-2">{language === 'es' ? 'Fechas de Seguimiento' : 'Follow-up Dates'}</p>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-slate-400 ">{language === 'es' ? 'Último Contacto' : 'Last Contact'}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 ">
                    {lead?.last_contact_date ? new Date(lead.last_contact_date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 ">{language === 'es' ? 'Próximo Seguimiento' : 'Next Follow-up'}</p>
                  <p className="text-sm font-bold text-amber-600 ">
                    {lead?.next_followup_date ? new Date(lead.next_followup_date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>


      {/* Activity Detail Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)'
            }}
            onClick={() => setSelectedActivity(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 24, padding: 32, width: '90%', maxWidth: 700,
                maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{selectedActivity.action}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    {selectedActivity.createdAt ? new Date(selectedActivity.createdAt).toLocaleString(language === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                    {selectedActivity.method ? ` • via ${selectedActivity.method}` : ''}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedActivity(null)}
                  style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>
              
              {selectedActivity.content && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{language === 'es' ? 'Resumen' : 'Summary'}</p>
                  <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                    {selectedActivity.content}
                  </div>
                </div>
              )}
              
              {selectedActivity.details && (
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{language === 'es' ? 'Detalles' : 'Details'}</p>
                  <div style={{ background: 'var(--bg-hover)', padding: 16, borderRadius: 12, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', border: '1px solid var(--border)' }}>
                    {selectedActivity.details}
                  </div>
                </div>
              )}
              
              {!selectedActivity.content && !selectedActivity.details && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: 20 }}>{language === 'es' ? 'No hay detalles adicionales.' : 'No additional details available.'}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
