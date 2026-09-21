"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Users, UserPlus, Mail, ChevronRight, Send, Loader2, Mic, MicOff, Bot, LayoutDashboard, TrendingUp, Briefcase, Phone, FolderOpen, ShoppingBag } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import { API_BASE_URL } from '@/config';

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  route: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Go to Leads', icon: <TrendingUp className="w-3.5 h-3.5 text-violet-500" />, route: '/leads' },
  { label: 'Add Client', icon: <UserPlus className="w-3.5 h-3.5 text-emerald-500" />, route: '/clients?action=add' },
  { label: 'Email Agent', icon: <Mail className="w-3.5 h-3.5 text-blue-500" />, route: '/email-agent' },
  { label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500" />, route: '/' },
  { label: 'Marketplace', icon: <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />, route: '/admin/marketplace' },
];

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user', text: string, action?: string }[]>([
    { role: 'bot', text: '👋 Hi! I\'m your **SERP Hawk CRM Assistant**. I can only help with questions about this CRM — features, navigation, how to do things, and more. What do you need help with?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useRole();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [isListening, setIsListening] = useState(false);

  // ── GATE: Only Admin and Demo can see the chatbot ──────────────────
  const isAllowed = role === 'Admin' || role === 'Demo';

  useEffect(() => {
    let storedSession: string;
    try { storedSession = localStorage.getItem('chatbot_session_id') || ''; } catch { storedSession = ''; }
    if (!storedSession) {
      storedSession = Math.random().toString(36).substring(2, 15);
      try { localStorage.setItem('chatbot_session_id', storedSession); } catch {}
    }
    setSessionId(storedSession);
  }, []);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isOpen, isTyping]);

  const match = pathname?.match(/^\/admin\/clients\/(\d+)$/);
  const currentClientId = match ? parseInt(match[1]) : null;

  const handleCommand = async (text: string) => {
    // Quick navigation shortcut
    const action = QUICK_ACTIONS.find(a => a.label === text);
    if (action) {
      setMessages(prev => [...prev,
        { role: 'user', text },
        { role: 'bot', text: `Navigating to ${action.label}...` }
      ]);
      setTimeout(() => router.push(action.route), 500);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsTyping(true);
    try {
      const res = await fetch(`${API_BASE_URL}/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          client_id: currentClientId,
          current_route: pathname,
          chat_history: messages.map(m => `${m.role}: ${m.text}`).join('\n') + `\nuser: ${text}`,
          session_id: sessionId,
          user_role: role
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply || "I've processed your request.", action: data.action_taken }]);

      if (data.action_taken === 'navigate' && data.route) {
        setTimeout(() => router.push(data.route), 1500);
      } else if (data.action_taken && !['trigger_whatsapp', 'navigate'].includes(data.action_taken)) {
        window.dispatchEvent(new Event('refresh-client-data'));
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I couldn't process that right now. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    handleCommand(input);
    setInput('');
  };

  const toggleListening = useCallback(() => {
    if (isListening) { setIsListening(false); return; }
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Your browser does not support speech recognition."); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => { setInput(prev => (prev ? prev + " " : "") + event.results[0][0].transcript); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [isListening]);

  // Don't render anything for non-admin/demo users
  if (!isAllowed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-80 lg:w-96 mb-4 flex flex-col overflow-hidden" style={{ height: '540px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 flex justify-between items-center shrink-0 rounded-t-2xl">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0 relative">
                <Bot className="w-5 h-5 text-white" />
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-indigo-600 bg-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">SERP Hawk Assistant</h3>
                <p className="text-[11px] font-medium text-indigo-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CRM Guide · Online
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Context Banner */}
          {currentClientId && (
            <div className="bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 flex items-center justify-center border-b border-indigo-100 dark:border-indigo-900/40">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Client Context Active
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 min-h-0 p-4 overflow-y-auto bg-slate-50 dark:bg-zinc-950 flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md'
                    : 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 shadow-sm rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-sm rounded-tl-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Pills */}
          <div className="px-4 py-3 bg-white dark:bg-zinc-900 shrink-0 border-t border-slate-100 dark:border-zinc-800">
            <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Quick Navigate</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleCommand(action.label)}
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-slate-50 dark:bg-zinc-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-full border border-slate-200/60 dark:border-zinc-700/60 text-[11px] font-bold text-slate-600 dark:text-zinc-300 transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-700 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl transition-colors shadow-md flex items-center justify-center shrink-0 ${isListening ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'}`}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about the CRM..."
              className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 rounded-full shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 transition-all hover:scale-105 active:scale-95 flex items-center justify-center group"
        >
          <Bot className="w-6 h-6 group-hover:animate-pulse" />
        </button>
      )}
    </div>
  );
}
