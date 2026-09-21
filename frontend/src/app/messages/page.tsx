'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Paperclip, Search, UserCheck, MessageCircle, RefreshCw, ArrowRight, CheckCheck, Check, Circle, Phone, Video, MoreHorizontal, Smile, Image, Mic } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';
import PageGuide from '@/components/PageGuide';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  'Pending':     { label: 'In Review',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'Quoted':      { label: 'Quote Sent', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'Accepted':    { label: 'Running',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'In Progress': { label: 'Happening',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'Delivered':   { label: 'Done',       color: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700' },
  'Hold':        { label: 'On Hold',    color: 'bg-rose-100 text-rose-700 border-rose-200' },
  'Cancelled':   { label: 'Cancelled',  color: 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-600' },
};

const THREAD_COLORS = [
  'from-violet-400 to-indigo-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-600',
  'from-fuchsia-400 to-purple-600',
];

function threadColor(id: number) {
  return THREAD_COLORS[id % THREAD_COLORS.length];
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const LS_KEY = 'crm_msg_read_map';

export default function MessagesHubPage() {
  const { t } = useLanguage();
  const { role, user } = useRole();

  const userId   = user?.id ?? null;
  const userName = user?.name || user?.email || 'You';

  const [threads, setThreads]               = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [newMessage, setNewMessage]         = useState('');
  const [loading, setLoading]               = useState(true);
  const [sending, setSending]               = useState(false);
  const [filter, setFilter]                 = useState('All');
  const [category, setCategory]             = useState('All');
  const [search, setSearch]                 = useState('');
  // readMap: thread_id → number of messages seen last time user opened that thread
  const [readMap, setReadMap]               = useState<Record<number, number>>({});
  const [typingUsers, setTypingUsers]       = useState<Record<number, string>>({});  // user_id -> user_name
  const [readReceipts, setReadReceipts]     = useState<Record<number, boolean>>({}); // msg_id -> read

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadsRef     = useRef<any[]>([]);
  const wsRef          = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef    = useRef(false);

  // Load readMap from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setReadMap(JSON.parse(raw));
    } catch {}
  }, []);

  const markRead = useCallback((threadId: number, count: number) => {
    setReadMap(prev => {
      if ((prev[threadId] ?? 0) >= count) return prev;
      const next = { ...prev, [threadId]: count };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Fetch threads whenever userId is ready ─────────────────────────────────
  const fetchThreads = useCallback(async (silent = false) => {
    if (!userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/messages/${userId}`);
      const data = await res.json();
      const list: any[] = data.threads || [];

      // On silent polls, skip re-render if nothing changed
      if (silent && JSON.stringify(list) === JSON.stringify(threadsRef.current)) return;

      threadsRef.current = list;
      setThreads(list);

      if (!silent && list.length > 0) {
        const firstId = list[0].thread_id;
        setActiveThreadId(firstId);
        markRead(firstId, list[0].messages?.length ?? 0);
      }
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, markRead]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // ── WebSocket connection for active thread ─────────────────────────────
  const connectWs = useCallback((threadId: number) => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/ws/chat/${threadId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'new_message') {
        const msg = data.message;
        setThreads(prev =>
          prev.map(t =>
            t.thread_id === threadId
              ? { ...t, messages: [...t.messages.filter((m: any) => !m._optimistic), { ...msg, isMe: msg.sender_id === userId }] }
              : t
          )
        );
        // Clear typing indicator for this sender
        setTypingUsers(prev => { const n = { ...prev }; delete n[msg.sender_id]; return n; });
      }

      if (data.type === 'typing') {
        setTypingUsers(prev => ({ ...prev, [data.user_id]: data.user_name }));
        // Auto-clear after 3s if no stop
        setTimeout(() => {
          setTypingUsers(prev => { const n = { ...prev }; delete n[data.user_id]; return n; });
        }, 3000);
      }

      if (data.type === 'stop_typing') {
        setTypingUsers(prev => { const n = { ...prev }; delete n[data.user_id]; return n; });
      }

      if (data.type === 'read_receipt') {
        setReadReceipts(prev => {
          const n = { ...prev };
          for (const id of data.message_ids) n[id] = true;
          return n;
        });
      }
    };

    ws.onclose = () => { wsRef.current = null; };

    return ws;
  }, [userId]);

  useEffect(() => {
    if (activeThreadId) {
      connectWs(activeThreadId);
      // Send read receipts for unread messages
      const thread = threads.find(t => t.thread_id === activeThreadId);
      if (thread && wsRef.current?.readyState === WebSocket.OPEN) {
        const unreadIds = thread.messages
          .filter((m: any) => !m.isMe && m.id && !m.is_read)
          .map((m: any) => m.id);
        if (unreadIds.length > 0) {
          wsRef.current.send(JSON.stringify({ action: 'read_receipt', message_ids: unreadIds, user_id: userId }));
        }
      }
    }
    return () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null; } };
  }, [activeThreadId, connectWs]);

  // ── Fallback poll every 30s (in case WS drops) ────────────────────────
  useEffect(() => {
    const id = setInterval(() => fetchThreads(true), 30000);
    return () => clearInterval(id);
  }, [fetchThreads]);

  const activeThread       = threads.find(t => t.thread_id === activeThreadId);
  const activeMessageCount = activeThread?.messages?.length ?? 0;

  // Auto-scroll when new messages arrive in the open thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadId, activeMessageCount]);

  // ── Open a thread ─────────────────────────────────────────────────────────
  const openThread = (thread: any) => {
    setActiveThreadId(thread.thread_id);
    markRead(thread.thread_id, thread.messages?.length ?? 0);
  };

  // ── Send message (preferring WebSocket) ────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThread || !userId || sending) return;

    const draft = newMessage;
    setNewMessage('');

    // Send typing stop
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'stop_typing', user_id: userId }));
    }
    isTypingRef.current = false;

    // Use WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Optimistic UI
      const optimisticMsg = { sender: userName, content: draft, timestamp: new Date().toISOString(), isMe: true, _optimistic: true };
      setThreads(prev =>
        prev.map(t =>
          t.thread_id === activeThreadId ? { ...t, messages: [...t.messages, optimisticMsg] } : t
        )
      );
      wsRef.current.send(JSON.stringify({ action: 'message', sender_id: userId, content: draft }));
      return;
    }

    // Fallback to REST
    setSending(true);
    const optimisticMsg = { sender: userName, content: draft, timestamp: new Date().toISOString(), isMe: true };
    setThreads(prev =>
      prev.map(t =>
        t.thread_id === activeThreadId ? { ...t, messages: [...t.messages, optimisticMsg] } : t
      )
    );
    try {
      const res = await fetch(`${API_BASE_URL}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: activeThread.thread_id, sender_id: userId, content: draft }),
      });
      if (!res.ok) throw new Error('Send failed');
      fetchThreads(true);
    } catch {
      setThreads(prev =>
        prev.map(t =>
          t.thread_id === activeThreadId
            ? { ...t, messages: t.messages.filter((m: any) => m !== optimisticMsg) }
            : t
        )
      );
      setNewMessage(draft);
    } finally {
      setSending(false);
    }
  };

  // ── Typing indicator sender ────────────────────────────────────────────
  const handleTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      wsRef.current.send(JSON.stringify({ action: 'typing', user_id: userId, user_name: userName }));
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      wsRef.current?.send(JSON.stringify({ action: 'stop_typing', user_id: userId }));
    }, 2000);
  };

  const filteredThreads = threads.filter(t => {
    if (search && !(t.service_name || '').toLowerCase().includes(search.toLowerCase())) return false;

    const lastMsg = t.messages?.[t.messages.length - 1];
    const lastFromMe = !!lastMsg?.isMe;
    const unreadCount = t.unread_count ?? 0;
    const isIncoming = !!lastMsg && !lastFromMe;

    if (category === 'Saying' && !isIncoming) return false;
    if (category === 'Need Reply' && !(isIncoming && unreadCount > 0)) return false;
    if (category === 'Unread' && !(unreadCount > 0)) return false;
    if (category === 'Sent' && !lastFromMe) return false;

    if (filter === 'Running') return t.service_status === 'Accepted' || t.service_status === 'In Progress';
    if (filter === 'Done')    return t.service_status === 'Delivered';
    if (filter === 'Hold')    return t.service_status === 'Hold';
    return true;
  });

  const totalUnread = threads.reduce((acc, t) => acc + (t.unread_count ?? 0), 0);

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">

      <PageGuide
        pageKey="messages"
        title={t('messages.guide_title')}
        description={t('messages.guide_desc')}
        steps={[
          { icon: '💬', text: t('messages.guide_s1') },
          { icon: '🔍', text: t('messages.guide_s2') },
          { icon: '🔔', text: t('messages.guide_s3') },
          { icon: '⌨️', text: t('messages.guide_s4') },
        ]}
      />

      {/* ── Conversations Container ─────────────────────────────────────── */}
      <div className="flex-1 flex bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-0">

        {/* ── Left Panel: Threads ──────────────────────────────────────── */}
        <div className="w-[340px] shrink-0 border-r border-gray-100 dark:border-zinc-800 flex flex-col bg-gray-50 dark:bg-zinc-950/50">

          {/* Panel header */}
          <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-black text-gray-900 dark:text-zinc-50 tracking-tight">{t('messages.page_title')}</h1>
                  <p className="text-[11px] text-gray-400 font-medium">
                    {totalUnread > 0 ? `${totalUnread} ${t('messages.x_unread')}` : `${threads.length} ${threads.length !== 1 ? t('messages.x_conversations') : t('messages.x_conversation')}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => fetchThreads()}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title={t('messages.refresh')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('messages.search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400 transition-all"
              />
            </div>

            {/* Category filters */}
            <div className="flex gap-1.5 mb-3">
              {[
                { v: 'All', l: t('messages.cat_all') },
                { v: 'Saying', l: t('messages.cat_saying') },
                { v: 'Need Reply', l: t('messages.cat_need_reply') },
                { v: 'Unread', l: t('messages.cat_unread') },
                { v: 'Sent', l: t('messages.cat_sent') },
              ].map(c => (
                <button
                  key={c.v}
                  onClick={() => setCategory(c.v)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    category === c.v
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:text-zinc-200'
                  }`}
                >
                  {c.l}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex gap-1.5">
              {[
                { v: 'All', l: t('messages.filter_all') },
                { v: 'Running', l: t('messages.filter_running') },
                { v: 'Done', l: t('messages.filter_done') },
                { v: 'Hold', l: t('messages.filter_hold') },
              ].map(f => (
                <button
                  key={f.v}
                  onClick={() => setFilter(f.v)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filter === f.v
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:text-zinc-200'
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">{t('messages.loading')}</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="py-20 px-6 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                  <MessageCircle className="w-7 h-7 text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500">{t('messages.no_conversations')}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {t('messages.no_conversations_desc')}
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  {t('messages.browse_services')} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredThreads.map(thread => {
                  const status    = STATUS_MAP[thread.service_status] || { label: thread.service_status || 'Active', color: 'bg-gray-100 text-gray-600 border-gray-200' };
                  const lastMsg   = thread.messages?.[thread.messages.length - 1];
                  const isActive  = activeThreadId === thread.thread_id;
                  const unreadCount = thread.unread_count ?? 0;
                  const initials  = (thread.service_name || 'S').substring(0, 2).toUpperCase();

                  return (
                    <button
                      key={thread.thread_id}
                      onClick={() => openThread(thread)}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-indigo-50 border border-indigo-200'
                          : 'hover:bg-gray-50 dark:bg-zinc-950 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${threadColor(thread.thread_id)} flex items-center justify-center text-white text-xs font-black shadow-sm`}>
                            {initials}
                          </div>
                          {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-indigo-600 text-white rounded-full text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <h3 className={`text-sm truncate ${unreadCount > 0 ? 'font-black text-gray-900 dark:text-zinc-50' : 'font-semibold text-gray-800 dark:text-zinc-100'}`}>
                              {thread.service_name}
                            </h3>
                            {lastMsg && (
                              <span className="text-[10px] text-gray-400 font-medium shrink-0">{fmtTime(lastMsg.timestamp)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs truncate ${unreadCount > 0 ? 'text-gray-700 dark:text-zinc-200 font-medium' : 'text-gray-400'}`}>
                              {lastMsg
                                ? `${lastMsg.isMe ? t('messages.you') : lastMsg.sender}: ${lastMsg.content}`
                                : t('messages.no_messages_yet')}
                            </p>
                            <div className="flex items-center gap-1">
                              {thread.has_unanswered && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                  {t('messages.unanswered')}
                                </span>
                              )}
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${status.color}`}>
                                {t(`messages.status_${thread.service_status?.toLowerCase().replace(/\s+/g, '_')}`) || status.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Chat ───────────────────────────────────────── */}
        {activeThread ? (
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900">

            {/* Chat header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${threadColor(activeThread.thread_id)} flex items-center justify-center text-white text-xs font-black shadow-sm`}>
                  {(activeThread.service_name || 'S').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-sm text-gray-900 dark:text-zinc-50">{activeThread.service_name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      {activeThread.handler}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${STATUS_MAP[activeThread.service_status]?.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {t(`messages.status_${activeThread.service_status?.toLowerCase().replace(/\s+/g, '_')}`) || STATUS_MAP[activeThread.service_status]?.label || activeThread.service_status || t('messages.status_active')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <Video className="w-4 h-4" />
                </button>
                <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages feed */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
              {activeThread.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="w-7 h-7 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-500">{t('messages.start_conversation')}</p>
                    <p className="text-xs text-gray-400 mt-0.5 max-w-xs">{t('messages.start_conversation_desc')}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Date separator at top */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('messages.conversation_start')}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {activeThread.messages.map((msg: any, idx: number) => {
                    const isSystem = msg.sender === 'System';
                    const isMe = msg.isMe;

                    if (isSystem) {
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-[10px] font-semibold text-gray-400 px-3 py-1 bg-gray-100 rounded-full">
                            {msg.content}
                          </span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-black shadow-sm ${
                          isMe
                            ? 'bg-gradient-to-br from-indigo-500 to-violet-600'
                            : `bg-gradient-to-br ${threadColor(activeThread.thread_id)}`
                        }`}>
                          {isMe ? (userName || 'Y').charAt(0).toUpperCase() : (msg.sender || 'T').charAt(0).toUpperCase()}
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          <span className={`text-[10px] font-semibold mb-1 px-1 ${isMe ? 'text-gray-400 text-right self-end' : 'text-gray-500'}`}>
                            {isMe ? t('messages.you') : msg.sender}
                          </span>
                          <div className={`rounded-2xl px-4 py-2.5 ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : 'bg-white dark:bg-zinc-900 border border-gray-200 text-gray-800 dark:text-zinc-100 rounded-tl-sm shadow-sm'
                          }`}>
                            <p className="text-[13px] leading-relaxed">{msg.content}</p>
                          </div>
                          <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'self-end' : ''}`}>
                            <span className="text-[10px] text-gray-400">{fmtTime(msg.timestamp)}</span>
                            {isMe && (
                              msg.is_read || readReceipts[msg.id]
                                ? <CheckCheck className="w-3 h-3 text-blue-500" />
                                : <Check className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {/* Typing indicator */}
              {Object.keys(typingUsers).length > 0 && (
                <div className="flex gap-2.5">
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-black bg-gradient-to-br ${threadColor(activeThread.thread_id)}`}>
                    {Object.values(typingUsers)[0]?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-semibold mb-1 px-1 text-gray-500">
                      {Object.values(typingUsers).join(', ')}
                    </span>
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
              <form
                onSubmit={handleSendMessage}
                className="flex items-end gap-2"
              >
                <div className="flex-1 bg-gray-50 dark:bg-zinc-950 border border-gray-200 rounded-2xl flex items-end gap-1 px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                  <button type="button" className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onInput={handleTyping}
                    placeholder={role === 'Client' ? `${t('messages.placeholder_message')} ${activeThread.handler}…` : t('messages.placeholder_reply')}
                    rows={1}
                    className="flex-1 bg-transparent py-2 text-sm focus:outline-none resize-none max-h-28 placeholder:text-gray-400"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
                    }}
                  />
                  <button type="button" className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors shrink-0">
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="w-11 h-11 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm active:scale-95"
                >
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ── Empty state ───────────────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-gray-50 dark:bg-zinc-950/30">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-5">
              <MessageCircle className="w-9 h-9 text-indigo-300" />
            </div>
            {loading ? (
              <p className="text-sm font-bold text-gray-400 animate-pulse">{t('messages.loading_threads')}</p>
            ) : threads.length > 0 ? (
              <div className="text-center">
                <h3 className="text-lg font-black text-gray-700 dark:text-zinc-200">{t('messages.select_conversation')}</h3>
                <p className="text-sm font-medium mt-1.5 text-gray-400 max-w-xs">
                  {t('messages.select_conversation_desc')}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-lg font-black text-gray-700 dark:text-zinc-200">{t('messages.no_conversations')}</h3>
                <p className="text-sm font-medium mt-1.5 text-gray-400 max-w-xs">
                  {t('messages.no_conversations_desc2')}
                </p>
                <Link
                  href="/pricing"
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  {t('messages.browse_services')} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
