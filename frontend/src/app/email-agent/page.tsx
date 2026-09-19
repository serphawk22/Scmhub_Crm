"use client";

import React, { useState, useEffect, useRef, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Mail, Clock, User, Globe, ChevronDown, ChevronUp,
  CheckCircle, Building2, Briefcase, Target, AtSign, FileText, Copy, Check,
  TrendingUp, Zap, Package, UserPlus, Phone, Store, DollarSign, MessageCircle, Trash2, Youtube
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";
import PageGuide from "@/components/PageGuide";
import { ResultCard, ResearchResultData, SendEmailResult, CopyButton } from "@/components/email-agent/ResultCard";
import GmailAgentLoop from "./GmailAgentLoop";
import { useRole } from "@/context/RoleContext";





interface ResearchResult {
  id: string;
  resultData: ResearchResultData;
  companyName: string;
  companyUrl: string;
}



function BottomUpFillMail() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative w-12 h-12">
        <Mail className="absolute inset-0 w-12 h-12 text-slate-400" strokeWidth={1} />
        <motion.div
          className="absolute bottom-0 left-0 right-0 overflow-hidden"
          initial={{ height: "0%" }}
          animate={{ height: "100%" }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute bottom-0 left-0 w-12 h-12">
            <Mail className="w-12 h-12 text-slate-800 dark:text-zinc-100" strokeWidth={1} fill="white" />
          </div>
        </motion.div>
      </div>
      <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 animate-pulse">{t('email_agent.researching')}</p>
    </div>
  );
}


export default function EmailAgentPage() {
  const { role } = useRole();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [companyName, setCompanyName] = useState("");
  const [inputValue, setInputValue] = useState("");
  
  const [chatStep, setChatStep] = useState<"website_url" | "loading" | "idle">("website_url");
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "msg-1", role: "ai", type: "text", content: t("email_agent.chat_greeting") }
  ]);
  
  const [resultsHistory, setResultsHistory] = useState<ResearchResult[]>([]);

  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [emailTotals, setEmailTotals] = useState({ totalSent: 0, autoCount: 0, manualCount: 0 });
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<number[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Added for Gmail Agent Migration: Allows user to dismiss a specific research result and refocuses on the input field seamlessly
  const handleRemoveResult = async (id: string) => {
    setResultsHistory(prev => prev.filter(r => r.id !== id));
    if (!id.startsWith("res-")) {
      try {
        await fetch(`${API_BASE_URL}/email-agent/results/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error("Failed to delete result from DB", e);
      }
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const scrollToBottom = () => {
    // Updated for Gmail Agent Migration: Smoothly scrolls the specific chat container to the bottom instead of the whole page
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatStep]);



  useEffect(() => {
    const fetchEmailsData = () => {
      fetch(`${API_BASE_URL}/sent-emails?limit=30`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          let ts = 0, auto = 0, man = 0;
          let em: any[] = [];
          if (data && typeof data === 'object' && !Array.isArray(data) && 'totalSent' in data) {
             ts = data.totalSent; auto = data.autoCount; man = data.manualCount;
             em = data.emails || [];
          } else if (Array.isArray(data)) {
             ts = data.length; man = data.filter(e => e.manual).length; auto = data.length - man;
             em = data;
          } else if (data?.emails && Array.isArray(data.emails)) {
             ts = data.emails.length; man = data.emails.filter((e: any) => e.manual).length; auto = data.emails.length - man;
             em = data.emails;
          }
          
          if (role === 'Demo' && ts === 0) {
            ts = 1420; auto = 1150; man = 270;
          }
          
          setEmailTotals({ totalSent: ts, autoCount: auto, manualCount: man });
          setSentEmails(em);
        })
        .catch(() => setSentEmails([]))
        .finally(() => setEmailsLoading(false));
    };

    fetchEmailsData();
    const interval = setInterval(fetchEmailsData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleDeleteEmail = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    // Optimistic delete
    setSentEmails(prev => prev.filter(email => email.id !== id));
    setEmailTotals(prev => ({
      ...prev,
      totalSent: Math.max(0, prev.totalSent - 1)
    }));
    try {
      await fetch(`${API_BASE_URL}/sent-emails/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Failed to delete email", err);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEmails.length === 0) return;
    const idsToDelete = [...selectedEmails];
    
    // Optimistic UI update
    setSentEmails(prev => prev.filter(email => !idsToDelete.includes(email.id)));
    setEmailTotals(prev => ({
      ...prev,
      totalSent: Math.max(0, prev.totalSent - idsToDelete.length)
    }));
    setSelectedEmails([]);

    // Background delete using bulk endpoint
    try {
      await fetch(`${API_BASE_URL}/sent-emails/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete })
      });
    } catch (err) {
      console.error("Failed to bulk delete emails", err);
    }
  };

  const handleSendInput = async () => {
    if (chatStep === "website_url") {
      const url = inputValue.trim();
      if (!url) return;
      setInputValue("");
      
      setMessages(prev => [
        ...prev,
        { id: `msg-${Date.now()}`, role: "user", type: "text", content: url },
        { id: `msg-${Date.now()+1}`, role: "ai", type: "loading" }
      ]);
      setChatStep("loading");
      
      const derivedName = url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
      await performResearch(derivedName, url);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendInput();
    }
  };

  const performResearch = async (name: string, url: string) => {
    try {
      const cleanUrl = url.replace(/^https?:\/\//i, "");
      const res = await fetch(`${API_BASE_URL}/smart-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: name,
          company_url: cleanUrl || null,
        }),
      });
      
      if (!res.ok) {
        throw new Error("Research failed");
      }
      
      const data = await res.json();
      
      setMessages(prev => {
        const filtered = prev.filter(m => m.type !== "loading");
        return [
          ...filtered,
          { id: `msg-${Date.now()}`, role: "ai", type: "text", content: `${t('email_agent.research_complete_prefix')} ${name} ${t('email_agent.research_complete_suffix')}` }
        ];
      });
      
      setResultsHistory([
        { id: data.db_id ? String(data.db_id) : `res-${Date.now()}`, resultData: data, companyName: name, companyUrl: url }
      ]);
      
      // Updated for Gmail Agent Migration: Moved step to 'website_url' (previously 'company_name') to enable multi-company sequential searches
      setChatStep("website_url");
      setCompanyName("");
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { id: `msg-${Date.now()+2}`, role: "ai", type: "text", content: t("email_agent.research_next") }
        ]);
      }, 1000);

    } catch {
      setMessages(prev => {
        const filtered = prev.filter(m => m.type !== "loading");
        return [
          ...filtered,
          { id: `msg-${Date.now()}`, role: "ai", type: "text", content: t("email_agent.research_error") }
        ];
      });
      setChatStep("website_url");
    }
  };

  const handleSendManually = async (result: ResearchResultData, name: string, url: string, skip_send: boolean = false, action_type: string = "System"): Promise<SendEmailResult> => {
    const data = await sendEmail(result, name, url, true, skip_send, action_type);
    if (data?.lead_id) {
      setResultsHistory(prev => prev.map(item => item.resultData === result ? { ...item, resultData: { ...item.resultData, lead_id: data.lead_id } } : item));
    }
    return data;
  };

  const handleSendAutomatically = async (result: ResearchResultData, name: string, url: string): Promise<SendEmailResult> => {
    const data = await sendEmail(result, name, url, false, false, "System Auto");
    if (data?.lead_id) {
      setResultsHistory(prev => prev.map(item => item.resultData === result ? { ...item, resultData: { ...item.resultData, lead_id: data.lead_id } } : item));
    }
    return data;
  };

  const sendEmail = async (result: ResearchResultData, name: string, url: string, manual: boolean, skip_send: boolean = false, action_type: string = "System"): Promise<SendEmailResult> => {
    try {
      const serviceNames = (result.recommended_services || []).map((s) => (typeof s === 'string' ? s : s.service_name || '')).filter(Boolean).join(", ");
      const fallbackEmail = Array.isArray(result.company_info?.contacts) ? result.company_info.contacts[0]?.email : undefined;
      const extractedEmailsArray = Array.isArray(result.company_info?.extracted_emails) ? result.company_info.extracted_emails : (result.company_info?.extracted_emails?.split(",") || []);
      const extractedEmail = extractedEmailsArray[0]?.trim();
      const emailToSend = result.contact?.email || fallbackEmail || extractedEmail || undefined;
      if (!emailToSend) {
        throw new Error("No recipient email available to send.");
      }
      const res = await fetch(`${API_BASE_URL}/send-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: emailToSend,
          company_name: result.company_info?.company_name || name,
          subject: result.draft?.subject || "",
          english_body: result.draft?.english_body || result.draft?.body || "",
          spanish_body: result.draft?.spanish_body || "",
          whatsapp_body: result.draft?.whatsapp_draft || "",
          recommended_services: serviceNames,
          contact_name: result.contact?.name || null,
          contact_role: result.contact?.role || null,
          website_url: result.company_url || result.company_info?.website || url || null,
          phone_number: result.contact?.phone_number || null,
          manual,
          skip_send,
          action_type,
          email_agent_data: JSON.stringify(result),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to send email");
      }

      const data = await res.json();
      fetch(`${API_BASE_URL}/sent-emails?limit=30`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (d && typeof d === 'object' && !Array.isArray(d) && 'totalSent' in d) {
            setEmailTotals({
              totalSent: d.totalSent,
              autoCount: d.autoCount,
              manualCount: d.manualCount
            });
            return setSentEmails(d.emails || []);
          }
          if (Array.isArray(d)) {
            setEmailTotals({
              totalSent: d.length,
              manualCount: d.filter(e => e.manual).length,
              autoCount: d.length - d.filter(e => e.manual).length
            });
            return setSentEmails(d);
          }
          if (d?.emails && Array.isArray(d.emails)) {
            setEmailTotals({
              totalSent: d.emails.length,
              manualCount: d.emails.filter((e: any) => e.manual).length,
              autoCount: d.emails.length - d.emails.filter((e: any) => e.manual).length
            });
            return setSentEmails(d.emails);
          }
          return setSentEmails([]);
        })
        .catch(() => setSentEmails([]));
      return data;
    } catch (error: unknown) {
      console.error(error);
      throw error instanceof Error ? error : new Error("Email send failed");
    }
  };

  const handleSaveFollowUp = async (result: ResearchResultData, note: string, title: string): Promise<boolean> => {
    try {
      const leadId = (result as any).lead_id || (result.company_info as any)?.lead_id || (result as any).id;
      if (!leadId) {
        console.error("Cannot save follow-up without lead ID");
        return false;
      }
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: note,
          authorId: 1,
          isInternal: false,
          task_title: title,
          task_description: note,
          due_date: null,
          assigned_to: null,
          email_agent_data: JSON.stringify(result),
        }),
      });
      return response.ok;
    } catch (error: unknown) {
      console.error(error);
      return false;
    }
  };

  const { totalSent, manualCount, autoCount } = emailTotals;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center overflow-hidden rounded-3xl">
      {/* Video Background - NO BLUR OVERLAY FOR FULL CLARITY */}
      

      {/* Main Scrolling Container */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col h-full mt-6 px-4 pb-20 overflow-y-auto">
        
        {/* Top Header - completely transparent, NO BLUR, white text */}
        <div className="bg-slate-50 dark:bg-zinc-950 rounded-2xl px-6 pt-6 pb-2 flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 shadow-lg backdrop-blur-sm">
              <Bot className="w-5 h-5 text-slate-800 dark:text-zinc-100" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 dark:text-zinc-100">{t('email_agent.title')}</h1>
              <p className="text-slate-500 dark:text-zinc-400 text-xs font-medium">{t('email_agent.subtitle')}</p>
            </div>
            <div className="flex bg-slate-200 dark:bg-zinc-800 p-1 rounded-lg ml-4">
              <button
                onClick={() => setMode("single")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${mode === "single" ? "bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 shadow-sm" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700"}`}
              >
                {t('email_agent.mode_single')}
              </button>
              <button
                onClick={() => setMode("bulk")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${mode === "bulk" ? "bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 shadow-sm" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700"}`}
              >
                {t('email_agent.mode_bulk')}
              </button>
            </div>
          </div>
          <div className="flex gap-4 hidden sm:flex">
            {[
              { label: t('email_agent.stat_total_sent'), value: totalSent },
              { label: t('email_agent.stat_auto'), value: autoCount },
              { label: t('email_agent.stat_manual'), value: manualCount },
            ].map((s) => (
              <div key={s.label} className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-80">{s.label}</p>
                <p className="text-lg font-black">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-zinc-950 p-0 rounded-2xl mb-2">
          {/* PageGuide components uses white text on dark variants, but we will leave it as is if it handles its own styles, though it floats */}
        </div>

        {/* Chatbot Interface Top Box - HAS BLUR and WHITE TEXT */}
        {mode === "single" ? (
          <>
            <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl w-full max-w-4xl mx-auto flex flex-col h-[400px] shadow-sm">
          <PageGuide
            pageKey="email-agent"
            title={t('email_agent.guide_title')}
            description={t('email_agent.guide_desc')}
            buttonClassName="absolute top-3 right-3 z-50 group"
            iconClassName="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-slate-800 dark:text-zinc-100 shadow-lg transition-transform group-hover:scale-110"
            steps={[
              { icon: <Building2 />, text: t('email_agent.guide_s1') },
              { icon: <Bot />, text: t('email_agent.guide_s2') },
              { icon: <Mail />, text: t('email_agent.guide_s3') },
              { icon: <TrendingUp />, text: t('email_agent.guide_s4') },
            ]}
          />
          <div className="p-4 border-b border-slate-100 dark:border-zinc-800 font-black text-sm text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Bot className="w-4 h-4 text-slate-800 dark:text-zinc-100" /> {t('email_agent.ai_assistant')}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" ref={chatContainerRef}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-white dark:bg-zinc-900 text-black dark:text-white" : "bg-blue-500 text-slate-800 dark:text-zinc-100"}`}>
                      {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`p-4 rounded-2xl ${
                      msg.role === "user" 
                        ? "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 rounded-br-none border border-slate-100 dark:border-zinc-800" 
                        : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 border border-slate-100 dark:border-zinc-800 shadow-sm rounded-bl-none text-slate-800 dark:text-zinc-100"
                    }`}>
                      {msg.type === "text" && <p className="text-sm font-medium">{msg.content}</p>}
                      {msg.type === "loading" && <BottomUpFillMail />}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <div className="p-5 bg-slate-50 dark:bg-zinc-950/80 rounded-b-2xl border-t border-slate-100 dark:border-zinc-800 backdrop-blur-md">
            <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 rounded-2xl p-2 border shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <Globe className="w-6 h-6 text-indigo-500" />
              </div>
              
              <input
                ref={inputRef}
                type="url"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com"
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none px-2 text-base font-bold text-slate-800 dark:text-zinc-100 placeholder-slate-400 h-12"
              />
              
              <button
                onClick={handleSendInput}
                disabled={!inputValue.trim() || chatStep === "loading"}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" /> {t('email_agent.start_agent')}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section Down Below */}
        {resultsHistory.length > 0 && (
          <div className="w-full mt-8 space-y-8">
            <h3 className="font-black text-xl text-slate-800 dark:text-zinc-100 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 backdrop-blur-md px-4 py-2 rounded-xl inline-block shadow-lg border border-slate-100 dark:border-zinc-800">{t('email_agent.research_results')}</h3>
            {resultsHistory.map(res => (
              <ResultCard key={res.id} historyId={res.id} result={res.resultData} companyName={res.companyName} companyUrl={res.companyUrl} onSendManually={handleSendManually} onSendAutomatically={handleSendAutomatically} onSaveFollowUp={handleSaveFollowUp} onRemove={handleRemoveResult} />
            ))}
          </div>
        )}
          </>
        ) : (
          <div className="w-full max-w-4xl mx-auto">
            <GmailAgentLoop />
          </div>
        )}

        {/* Recent Outreach Section Down Below */}
        <div className="w-full mt-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 shadow-inner">
                <Mail className="w-4 h-4" />
              </div>
              <h3 className="font-black text-[15px] text-slate-800 dark:text-zinc-100">{t('email_agent.recent_outreach')}</h3>
              {sentEmails.length > 0 && (
                <div className="flex items-center gap-2 ml-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg shadow-sm">
                  <input 
                    type="checkbox"
                    checked={selectedEmails.length === sentEmails.length && sentEmails.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmails(sentEmails.map(email => email.id));
                      } else {
                        setSelectedEmails([]);
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">{t('email_agent.select_all')}</span>
                </div>
              )}
              {selectedEmails.length > 0 && (
                <button 
                  onClick={handleDeleteSelected}
                  className="ml-2 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-400 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('email_agent.delete_label')} ({selectedEmails.length})
                </button>
              )}
            </div>
            <span className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
              {totalSent} {t('email_agent.total_suffix')}
            </span>
          </div>

          {emailsLoading ? (
            <div className="flex justify-center p-8"><Clock className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : sentEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-3">
              <Mail className="w-10 h-10 opacity-30 text-gray-500" />
              <p className="font-bold text-sm text-slate-400">{t('email_agent.no_emails')}</p>
            </div>
          ) : (
                 <div className="w-full mt-4 space-y-4">
              {Object.entries(
                sentEmails.reduce((acc, email) => {
                  const key = email.company_name && email.company_name !== "Unknown Company" ? email.company_name : t('email_agent.fallback_prospect');
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(email);
                  return acc;
                }, {} as Record<string, SentEmail[]>)
              ).map(([company, emails]) => {
                const isCompanyExpanded = expandedCompanies.includes(company);
                return (
                  <div key={company} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden shadow-sm">
                    <div 
                      className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-zinc-950 border-b border-slate-100 dark:border-zinc-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                      onClick={() => setExpandedCompanies(prev => prev.includes(company) ? prev.filter(c => c !== company) : [...prev, company])}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-slate-800 dark:text-zinc-100">{company}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{emails.length} {t('email_agent.emails_extracted')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="flex items-center">
                           <input 
                              type="checkbox" 
                              checked={emails.every(e => selectedEmails.includes(e.id))}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (e.target.checked) setSelectedEmails(prev => [...new Set([...prev, ...emails.map(em => em.id)])]);
                                else setSelectedEmails(prev => prev.filter(id => !emails.map(em => em.id).includes(id)));
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4 mr-4"
                              title={t('email_agent.select_company')}
                           />
                         </div>
                         {isCompanyExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>

                    {isCompanyExpanded && (
                      <div className="p-6 bg-slate-50/30 dark:bg-zinc-950/30 space-y-4">
                        {emails.map(email => (
                          <div key={email.id} className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl p-5 shadow-sm relative group hover:border-indigo-200 transition-colors">
                            <div className="absolute top-5 right-5 flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                checked={selectedEmails.includes(email.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedEmails(prev => [...prev, email.id]);
                                  else setSelectedEmails(prev => prev.filter(id => id !== email.id));
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                              />
                              <button onClick={(e) => handleDeleteEmail(e, email.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title={t('email_agent.delete')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-6 mb-4 pr-20">
                              <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-950 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-black text-slate-700 dark:text-zinc-200">{email.to_email}</span>
                              </div>
                              <div className="flex flex-col justify-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('email_agent.status')}</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                  email.status === "Opened" ? "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" :
                                  email.status === "Replied" ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400" :
                                  "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
                                }`}>
                                  {email.status || "Sent"}
                                </span>
                              </div>
                              <div className="flex flex-col justify-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('email_agent.subject')}</p>
                                <span className="text-sm font-bold text-slate-600 dark:text-zinc-300">{email.subject || t('email_agent.no_subject')}</span>
                              </div>
                            </div>

                            {(email.english_body || email.spanish_body) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {email.english_body && (
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('email_agent.english_draft')}</p>
                                      <CopyButton text={email.english_body} />
                                    </div>
                                    <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl p-4 text-[13px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar font-sans leading-relaxed">
                                      {email.english_body}
                                    </div>
                                  </div>
                                )}
                                {email.spanish_body && (
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('email_agent.spanish_draft')}</p>
                                      <CopyButton text={email.spanish_body} />
                                    </div>
                                    <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl p-4 text-[13px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar font-sans leading-relaxed">
                                      {email.spanish_body}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
