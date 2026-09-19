import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Mail, Clock, User, Globe, ChevronDown, ChevronUp,
  CheckCircle, Building2, Briefcase, Target, AtSign, FileText, Copy, Check,
  TrendingUp, Zap, Package, UserPlus, Phone, Store, DollarSign, MessageCircle, Trash2, Youtube
} from "lucide-react";

export interface SentEmail {
  id: number;
  client_id: number | null;
  company_name?: string;
  to_email: string;
  subject: string;
  english_body: string | null;
  spanish_body: string | null;
  recommended_services: string | null;
  manual: boolean;
  draft_json: string | null;
  status: string;
  sent_at: string | null;
}

export interface ChatMessage {
  id: string;
  role: "ai" | "user";
  type: "text" | "loading";
  content?: string;
}

export type RecommendedService = {
  service_name?: string;
  why_relevant?: string;
  expected_impact?: string;
};

export interface ResearchResultData {
  company_info?: {
    company_name?: string;
    likely_industry?: string;
    industry?: string;
    what_they_do?: string;
    summary?: string;
    business_model?: string;
    estimated_size?: string;
    target_market?: string;
    geographic_presence?: string;
    linkedin?: string;
    best_conversion_opportunity?: string;
    sales_follow_up_focus?: string;
    website?: string;
    extracted_emails?: string | string[];
    extracted_phone_numbers?: string;
    extracted_linkedin?: string;
    extracted_twitter?: string;
    source_pages?: string[];
    company_social_media?: {
      linkedin?: string;
      twitter?: string;
      instagram?: string;
      facebook?: string;
      youtube?: string;
    };
    contacts?: Array<{
      email?: string;
      name?: string;
      role?: string;
      phone_number?: string;
      personal_social_media?: {
        linkedin?: string;
        twitter?: string;
      };
    }>;
  };
  contact?: {
    email?: string;
    name?: string;
    role?: string;
    phone_number?: string;
    whatsapp?: string;
    linkedin?: string;
    twitter?: string;
  };
  recommended_services?: Array<RecommendedService | string>;
  email_hook?: string;
  package_suggestion?: string;
  draft?: {
    english_body?: string;
    spanish_body?: string;
    body?: string;
    subject?: string;
    whatsapp_draft?: string;
  };
  assigned_sales_manager?: string;
  company_url?: string;
  client_id?: number;
  id?: string;
  extracted_services?: Array<{
    name: string;
    brief: string;
    category: string;
    approx_cost: number;
    cost_is_estimated: boolean;
  }>;
}

export interface ResearchResult {
  id: string;
  resultData: ResearchResultData;
  companyName: string;
  companyUrl: string;
}

export type SendEmailResult = {
  client_id?: number;
  lead_id?: number;
  success?: boolean;
  message?: string;
  sent_email_id?: number;
} | null;


export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 transition-all"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-100" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function buildProspectingPoints(result: ResearchResultData) {
  const hasServices = (result.recommended_services || []).map((s) => typeof s === 'string' ? s : s.service_name).filter(Boolean) as string[];
  
  const toArray = (val: any) => Array.isArray(val) ? val : (typeof val === 'string' ? val.split(",") : []);
  
  // Extract contact information with fallbacks
  const emails = toArray(result.company_info?.extracted_emails);
  const primaryEmail = result.contact?.email || emails[0]?.trim() || "No email found.";
  const allEmails = emails.length > 0 ? emails.map((e: string) => e.trim()).slice(0, 2).join(", ") : primaryEmail;
  
  const phones = toArray(result.company_info?.extracted_phone_numbers);
  const primaryPhone = result.contact?.phone_number || result.contact?.whatsapp || phones[0]?.trim() || "No phone available.";
  const allPhones = phones.length > 0 ? phones.map((p: string) => p.trim()).slice(0, 2).join(", ") : primaryPhone;
  
  const linkedins = toArray(result.company_info?.extracted_linkedin);
  const linkedinProfile = result.contact?.linkedin || result.company_info?.linkedin || linkedins[0]?.trim() || "No LinkedIn profile found.";
  const allLinkedIn = linkedins.length > 0 ? linkedins.map((l: string) => l.trim()).slice(0, 2).join(", ") : linkedinProfile;
  
  const twitters = toArray(result.company_info?.extracted_twitter);
  const twitterProfile = result.contact?.twitter || twitters[0]?.trim() || "No Twitter/X profile found.";
  const allTwitter = twitters.length > 0 ? twitters.map((t: string) => t.trim()).slice(0, 2).join(", ") : twitterProfile;
  
  return [
    {
      title: "Company Summary",
      body: result.company_info?.what_they_do || result.company_info?.summary || "Company description not available.",
      icon: Briefcase,
    },
    {
      title: "Services Offered",
      body: hasServices.length > 0 ? hasServices.join(", ") : "No service matches available yet.",
      icon: Package,
    },
    {
      title: "Conversion Priority",
      body: result.company_info?.best_conversion_opportunity || "Highest value opportunity not yet identified.",
      icon: Target,
    },
    {
      title: "Primary Contact",
      body: result.contact?.name || "No contact name found.",
      icon: AtSign,
    },
    {
      title: "Email ID",
      body: allEmails,
      icon: Mail,
    },
    {
      title: "Mobile / WhatsApp",
      body: allPhones,
      icon: Phone,
    },
    {
      title: "LinkedIn",
      body: allLinkedIn,
      icon: Globe,
    },
    {
      title: "Twitter / X",
      body: allTwitter,
      icon: Zap,
    },
    {
      title: "Sales Manager",
      body: result.assigned_sales_manager || "Assign a salesperson to this lead.",
      icon: UserPlus,
    },
    {
      title: "Follow-up Focus",
      body: result.company_info?.sales_follow_up_focus || "Capture next steps as notes and turn them into tasks.",
      icon: TrendingUp,
    },
  ];
}


function CopyableEmailItem({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-600 transition-all group/item shadow-sm">
      <span className="text-xs font-mono text-slate-800 dark:text-zinc-200 break-all select-all pr-1">{email}</span>
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors shadow-sm bg-slate-50 dark:bg-zinc-950 flex-shrink-0"
        title="Copy email"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}


export function ResultCard({ historyId, result, companyName, companyUrl, onSendManually, onSendAutomatically, onSaveFollowUp, onRemove }: { historyId: string; result: ResearchResultData; companyName: string; companyUrl: string; onSendManually: (r: ResearchResultData, name: string, url: string, skip_send?: boolean, action_type?: string) => Promise<SendEmailResult>; onSendAutomatically: (r: ResearchResultData, name: string, url: string) => Promise<SendEmailResult>; onSaveFollowUp: (r: ResearchResultData, note: string, title: string) => Promise<boolean>; onRemove: (id: string) => void; }) {
  const [activeTab, setActiveTab] = useState<"english" | "spanish" | "whatsapp">("english");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");

  const [followUpTitle, setFollowUpTitle] = useState(`Follow up with ${companyName}`);
  const [followUpStatus, setFollowUpStatus] = useState<string | null>(null);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const formatBody = (body: any) => {
    if (typeof body !== 'string') return "";
    return body.replace(/<br\s*\/?>/gi, '\n');
  };

  const [editableSubject, setEditableSubject] = useState(result.draft?.subject || "");
  const [editableEnglishBody, setEditableEnglishBody] = useState(formatBody(result.draft?.english_body || result.draft?.body));
  const [editableSpanishBody, setEditableSpanishBody] = useState(formatBody(result.draft?.spanish_body));
  const [editableWhatsappBody, setEditableWhatsappBody] = useState(formatBody(result.draft?.whatsapp_draft));
  const [fromEmail, setFromEmail] = useState("support.crm@serphawk.in");

  const extractedEmailsArray = (Array.isArray(result.company_info?.extracted_emails) ? result.company_info.extracted_emails : (result.company_info?.extracted_emails?.split(",") || []))
    .filter((e: string) => e.trim().toLowerCase() !== "test@example.com" && e.trim().toLowerCase() !== "support.crm@serphawk.in");
  const extractedEmail = extractedEmailsArray[0]?.trim();
  const directContactEmail = Array.isArray((result.company_info as any)?.contacts) ? (result.company_info as any).contacts[0]?.email : (result.company_info as any)?.email;
  
  let rawInitialEmail = result.contact?.email || directContactEmail || extractedEmail || "";
  if (Array.isArray(rawInitialEmail)) rawInitialEmail = rawInitialEmail[0];
  let initialContactEmail = typeof rawInitialEmail === 'string' ? rawInitialEmail : String(rawInitialEmail || "");
  
  if (initialContactEmail.trim().toLowerCase() === "test@example.com" || initialContactEmail.trim().toLowerCase() === "support.crm@serphawk.in") {
    initialContactEmail = "";
  }

  const [toEmail, setToEmail] = useState(initialContactEmail);

  useEffect(() => {
    if (sendSuccess) {
      const timer = setTimeout(() => {
        onRemove(historyId);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [sendSuccess, historyId, onRemove]);

  if (sendSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full bg-white dark:bg-zinc-900 border border-emerald-500/30 rounded-2xl p-12 flex flex-col items-center justify-center shadow-sm"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 mb-2">Mail Sent Successfully!</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">Moving this to your recent outreach log...</p>
      </motion.div>
    );
  }

  if (sending) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full bg-white dark:bg-zinc-900 border border-indigo-500/30 rounded-2xl p-12 flex flex-col items-center justify-center shadow-sm h-64"
      >
        <Clock className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 mb-2">Sending Email...</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm">Please wait while the system processes your request.</p>
      </motion.div>
    );
  }



  const englishText = editableEnglishBody;
  const spanishText = editableSpanishBody;
  const gmailBodyText = spanishText && !englishText.includes(spanishText) 
    ? `${englishText}\n\n---\n\n${spanishText}`
    : englishText;

  const getUpdatedResult = () => ({
    ...result,
    contact: {
      ...(result.contact || {}),
      email: toEmail
    },
    draft: {
      ...result.draft,
      subject: editableSubject,
      english_body: activeTab === "english" ? editableEnglishBody : "",
      spanish_body: activeTab === "spanish" ? editableSpanishBody : "",
      whatsapp_draft: editableWhatsappBody,
      body: activeTab === "english" ? editableEnglishBody : editableSpanishBody
    }
  });

  const handleSend = async () => {
    if (!toEmail || !toEmail.trim()) {
      setSendError("Please provide a recipient email address in the 'To:' field.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await onSendManually(getUpdatedResult(), companyName, companyUrl, false, "System");
      setSendSuccess("Mail sent");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      setSendError(message);
    }
    setSending(false);
  };

  const handleSendViaSystem = () => {
    if (!toEmail || !toEmail.trim()) {
      setSendError("Please provide a recipient email address in the 'To:' field.");
      return;
    }
    
    // Open the default custom mail app instantly (mailto:)
    const bodyText = activeTab === "english" ? editableEnglishBody : activeTab === "spanish" ? editableSpanishBody : editableWhatsappBody;
    const mailtoLink = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(editableSubject)}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailtoLink;
    
    // Log to backend in the background without freezing the UI
    onSendManually(getUpdatedResult(), companyName, companyUrl, true, "System").catch(console.error);
    
    // Show success immediately
    setSendSuccess("Mail sent");
  };

  const handleSendAutomatically = async () => {
    if (!toEmail || !toEmail.trim()) {
      setSendError("Please provide a recipient email address in the 'To:' field.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await onSendAutomatically(getUpdatedResult(), companyName, companyUrl);
      setSendSuccess("Sent Automatically");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      setSendError(message);
    }
    setSending(false);
  };

  const handleSaveFollowUp = async () => {
    if (!followUpNote.trim()) {
      setFollowUpStatus("Add a follow-up note first.");
      return;
    }
    setSavingFollowUp(true);
    setFollowUpStatus(null);
    const saved = await onSaveFollowUp(result, followUpNote.trim(), followUpTitle);
    setSavingFollowUp(false);
    if (saved) {
      setFollowUpStatus("Follow-up note saved successfully.");
      setFollowUpNote("");
    } else {
      setFollowUpStatus("Unable to save follow-up. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 w-full"
    >
      {/* Top row: Company Info + Contact */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-800 dark:text-zinc-100 font-black text-lg shadow-inner">
                  {(result.company_info?.company_name || companyName).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100">{result.company_info?.company_name || companyName}</h2>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                    {result.company_info?.likely_industry || result.company_info?.industry || "Business"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {result.package_suggestion && (
                  <span className="px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                    <Package className="w-3 h-3" /> {result.package_suggestion}
                  </span>
                )}
                <button onClick={() => onRemove(historyId)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all" title="Delete Result">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

          <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed mb-5">
            {result.company_info?.summary || result.company_info?.what_they_do || "Company information gathered successfully."}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Model", value: result.company_info?.business_model, icon: Briefcase },
              { label: "Size", value: result.company_info?.estimated_size, icon: Building2 },
              { label: "Market", value: result.company_info?.target_market, icon: Target },
              { label: "Reach", value: result.company_info?.geographic_presence, icon: Globe },
            ].filter(f => f.value).map(({ label, value, icon: Icon }) => (
              <div key={label} className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3 text-slate-400" />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Extracted Company Info */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100">
              <AtSign className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-black text-slate-800 dark:text-zinc-100 uppercase tracking-widest">Extracted Company Info</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm">
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase mb-1.5">Emails</p>
              <div className="flex flex-col gap-1.5">
                {result.company_info?.extracted_emails ? (
                  (Array.isArray(result.company_info.extracted_emails) 
                    ? result.company_info.extracted_emails 
                    : result.company_info.extracted_emails.split(',')
                  )
                  .filter((e: string) => e.trim().toLowerCase() !== "test@example.com" && e.trim().toLowerCase() !== "support.crm@serphawk.in")
                  .map((e: string, i: number) => (
                    <CopyableEmailItem key={i} email={e.trim()} />
                  ))
                ) : (
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">None</p>
                )}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm">
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase mb-1">Phones</p>
              <div className="flex flex-col gap-1">
                {result.company_info?.extracted_phone_numbers ? result.company_info.extracted_phone_numbers.split(',').map((p: string, i: number) => (
                  <a key={i} href={`tel:${p.trim()}`} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-mono break-all">{p.trim()}</a>
                )) : <p className="text-sm text-slate-500 dark:text-zinc-500 font-mono">None</p>}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm lg:col-span-2">
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase mb-2">Company Socials</p>
              <div className="flex flex-wrap gap-2">
                {result.company_info?.company_social_media?.linkedin ? <a href={result.company_info.company_social_media.linkedin} target="_blank" rel="noreferrer" className="px-3 py-1 bg-[#0a66c2]/10 text-[#0a66c2] dark:bg-[#0a66c2]/20 dark:text-[#60a5fa] rounded-md text-xs font-bold hover:bg-[#0a66c2]/20 transition-colors">LinkedIn</a> : null}
                {result.company_info?.company_social_media?.twitter ? <a href={result.company_info.company_social_media.twitter} target="_blank" rel="noreferrer" className="px-3 py-1 bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-200 transition-colors">X / Twitter</a> : null}
                {result.company_info?.company_social_media?.instagram ? <a href={result.company_info.company_social_media.instagram} target="_blank" rel="noreferrer" className="px-3 py-1 bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400 rounded-md text-xs font-bold hover:bg-pink-500/20 transition-colors">Instagram</a> : null}
                {result.company_info?.company_social_media?.facebook ? <a href={result.company_info.company_social_media.facebook} target="_blank" rel="noreferrer" className="px-3 py-1 bg-blue-600/10 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400 rounded-md text-xs font-bold hover:bg-blue-600/20 transition-colors">Facebook</a> : null}
                {result.company_info?.company_social_media?.youtube ? <a href={result.company_info.company_social_media.youtube} target="_blank" rel="noreferrer" className="px-3 py-1 bg-red-600/10 text-red-700 dark:bg-red-600/20 dark:text-red-400 rounded-md text-xs font-bold hover:bg-red-600/20 transition-colors flex items-center gap-1"><Youtube className="w-3 h-3" /> YouTube</a> : null}
                {result.company_info?.extracted_linkedin && !result.company_info?.company_social_media?.linkedin ? <a href={result.company_info.extracted_linkedin} target="_blank" rel="noreferrer" className="px-3 py-1 bg-[#0a66c2]/10 text-[#0a66c2] dark:bg-[#0a66c2]/20 dark:text-[#60a5fa] rounded-md text-xs font-bold hover:bg-[#0a66c2]/20 transition-colors">LinkedIn (Fallback)</a> : null}
                {(!result.company_info?.company_social_media || Object.values(result.company_info.company_social_media).every(v => !v)) && !result.company_info?.extracted_linkedin && <span className="text-sm text-slate-500 dark:text-zinc-500">No social profiles detected.</span>}
              </div>
            </div>
          </div>

          {/* Key Decision Makers */}
          {result.company_info?.contacts && Array.isArray(result.company_info.contacts) && result.company_info.contacts.length > 0 ? (
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800 overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-700 text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-widest bg-slate-100 dark:bg-zinc-900/50">
                    <th className="py-3 px-4 font-bold">Name & Role</th>
                    <th className="py-3 px-4 font-bold">Contact</th>
                    <th className="py-3 px-4 font-bold">Socials</th>
                  </tr>
                </thead>
                <tbody>
                  {result.company_info.contacts.map((p: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-zinc-800 last:border-0 hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                      <td className="py-4 px-4 align-top">
                        <div className="font-bold text-sm text-slate-800 dark:text-zinc-100">{p.name || 'Unknown Name'}</div>
                        {p.role && <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{p.role}</div>}
                      </td>
                      <td className="py-4 px-4 align-top">
                        {p.email && (
                          <div className="flex items-center gap-2 mb-1">
                            <Mail size={12} className="text-slate-400" />
                            <a href={`mailto:${p.email}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline break-all">{p.email}</a>
                          </div>
                        )}
                        {p.phone_number && (
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-slate-400" />
                            <a href={`tel:${p.phone_number}`} className="text-xs text-slate-600 dark:text-zinc-300 hover:underline">{p.phone_number}</a>
                          </div>
                        )}
                        {!p.email && !p.phone_number && <span className="text-xs text-slate-400">Not found</span>}
                      </td>
                      <td className="py-4 px-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {p.personal_social_media?.linkedin ? (
                            <a href={p.personal_social_media.linkedin} target="_blank" rel="noreferrer" className="px-2 py-1 bg-[#0a66c2]/10 text-[#0a66c2] dark:bg-[#0a66c2]/20 dark:text-[#60a5fa] rounded text-[10px] font-bold hover:bg-[#0a66c2]/20 transition-colors">LinkedIn</a>
                          ) : null}
                          {p.personal_social_media?.twitter ? (
                            <a href={p.personal_social_media.twitter} target="_blank" rel="noreferrer" className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300 rounded text-[10px] font-bold hover:bg-slate-200 transition-colors">X/Twitter</a>
                          ) : null}
                          {!p.personal_social_media?.linkedin && !p.personal_social_media?.twitter && <span className="text-xs text-slate-400">-</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400">
              <AtSign className="w-8 h-8 opacity-30" />
              <p className="text-xs mt-2">No key decision makers found</p>
            </div>
          )}
        </div>

        {/* Source Pages / Reference URLs */}
        {result.company_info?.source_pages && result.company_info.source_pages.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100">
                <Globe className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-black text-slate-800 dark:text-zinc-100 uppercase tracking-widest">Source Pages / Reference URLs</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.company_info.source_pages.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-zinc-300 truncate">
                  <Globe className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{url}</span>
                </a>
              ))}
            </div>
          </div>
        )}

      {/* Extracted Client Services */}
      {result.extracted_services && result.extracted_services.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100">
              <Store className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-black text-slate-800 dark:text-zinc-100 uppercase tracking-widest">Services Offered by This Company</p>
            <span className="ml-auto text-[9px] font-black text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2 py-0.5 rounded-full">
              {result.extracted_services.length} detected
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.extracted_services.map((svc, i) => (
              <div key={i} className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2 py-0.5 rounded-full">
                    {svc.category}
                  </span>
                  {svc.approx_cost > 0 && (
                    <span className="ml-auto text-[9px] font-black text-amber-500 flex items-center gap-0.5">
                      <DollarSign className="w-2.5 h-2.5" />
                      {svc.approx_cost.toLocaleString()}
                      {svc.cost_is_estimated ? ' est.' : ''}
                    </span>
                  )}
                </div>
                <p className="font-bold text-slate-800 dark:text-zinc-100 text-sm mb-1">{svc.name}</p>
                {svc.brief && <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{svc.brief}</p>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            ✦ These services have been saved to the client profile and Marketplace catalog.
          </p>
        </div>
      )}


      {result.draft && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-black text-slate-800 dark:text-zinc-100 uppercase tracking-widest">Generated Email Draft</p>
            </div>
            <CopyButton text={activeTab === "english" ? editableEnglishBody : activeTab === "spanish" ? editableSpanishBody : editableWhatsappBody} />
          </div>

          {result.email_hook && (
            <div className="mb-6 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Suggested Hook</p>
              <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{result.email_hook}</p>
            </div>
          )}

          {/* Send Box at the top */}
          <div className="mb-6 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-zinc-100 group relative">
                  <span className="text-slate-500 w-12">From:</span>
                  <input 
                    type="text" 
                    value="vkanjali@serphawk.com"
                    readOnly
                    disabled
                    className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-slate-500 cursor-not-allowed focus:outline-none transition-all"
                  />
                  <div className="absolute bottom-full left-14 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap z-50 font-medium">
                    Automated sending email address
                    <div className="absolute -bottom-1 left-4 w-2 h-2 bg-slate-800 rotate-45"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-zinc-100">
                  <span className="text-slate-500 w-12">To:</span>
                  <input 
                    type="text" 
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

                <div className="flex flex-col gap-2">
                  <div className="w-full px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 shadow-sm">
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.5 }}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </motion.div>
                    Mail Sent Automatically via AI
                  </div>
                  <button
                    onClick={handleSendViaSystem}
                    disabled={sending || !!sendSuccess}
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 dark:bg-zinc-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Send via System
                  </button>
                </div>
              </div>
              {sendError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {sendError}
                </div>
              )}
            </div>
          <div className="mb-4">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subject</p>
            <input 
              type="text"
              value={editableSubject}
              onChange={(e) => setEditableSubject(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800 p-3 text-sm font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex gap-2 mb-4">
            {[
              { key: "english" as const, label: "English" },
              { key: "spanish" as const, label: "Español" },
              ...(result.draft?.whatsapp_draft ? [{ key: "whatsapp" as const, label: "WhatsApp" }] : []),
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                  activeTab === tab.key ? "bg-white dark:bg-zinc-900 text-black dark:text-white border-slate-300 dark:border-zinc-600 shadow-sm" : "bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-white dark:bg-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <textarea
              value={activeTab === "english" ? editableEnglishBody : activeTab === "spanish" ? editableSpanishBody : editableWhatsappBody}
              onChange={(e) => {
                if (activeTab === "english") setEditableEnglishBody(e.target.value);
                else if (activeTab === "spanish") setEditableSpanishBody(e.target.value);
                else setEditableWhatsappBody(e.target.value);
              }}
              rows={12}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl p-5 text-sm text-slate-700 dark:text-zinc-200 leading-relaxed font-mono custom-scrollbar focus:outline-none focus:border-indigo-500 transition-all resize-y"
            />
          </div>

          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {buildProspectingPoints(result).map((point, idx) => {
                const Icon = point.icon;
                return (
                  <div key={idx} className="rounded-3xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 p-4 text-sm text-slate-700 dark:text-zinc-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-zinc-400">
                      <Icon className="w-4 h-4" />
                      <span className="font-bold uppercase tracking-[0.18em] text-[10px]">{point.title}</span>
                    </div>
                    <p className="leading-snug text-slate-600 dark:text-zinc-300 font-medium">{point.body}</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Next Follow-up Note</label>
                <input
                  type="text"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-white"
                  placeholder="Follow-up title"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Note for the sales team</label>
                <textarea
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 px-3 py-3 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-white resize-none"
                  placeholder="Capture the follow-up summary, next steps, or internal action items."
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handleSaveFollowUp}
                  disabled={savingFollowUp || !followUpNote.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-500 text-slate-800 dark:text-zinc-100 font-bold text-xs hover:bg-sky-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingFollowUp ? "Saving..." : "Save Follow-Up"}
                </button>
                {followUpStatus && (
                  <p className="text-xs text-slate-500 dark:text-zinc-400">{followUpStatus}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
