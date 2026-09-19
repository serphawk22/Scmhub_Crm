import re

with open("frontend/src/app/email-agent/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Define the new interfaces and components
new_code = """
interface ResearchResultData {
  emails?: string;
  phone?: string;
  social_links?: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
  };
  company_services?: string[];
  cold_email_english?: string;
  cold_email_spanish?: string;
  
  // Legacy fields
  company_info?: any;
  contact?: any;
  recommended_services?: any;
  draft?: any;
  extracted_services?: any;
  assigned_sales_manager?: string;
  company_url?: string;
  client_id?: number;
  id?: string;
}

interface ResearchResult {
  id: string;
  resultData: ResearchResultData;
  companyName: string;
  companyUrl: string;
}

type SendEmailResult = {
  client_id?: number;
} | null;

function CopyButton({ text }: { text: string }) {
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

function BottomUpFillMail() {
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
      <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 animate-pulse">Researching & drafting...</p>
    </div>
  );
}

function ResultCard({ result, companyName, companyUrl, onSendManually, onSendAutomatically, onSaveFollowUp }: { result: ResearchResultData; companyName: string; companyUrl: string; onSendManually: (r: ResearchResultData, name: string, url: string, skip_send?: boolean, action_type?: string) => Promise<SendEmailResult>; onSendAutomatically: (r: ResearchResultData, name: string, url: string) => Promise<SendEmailResult>; onSaveFollowUp: (r: ResearchResultData, note: string, title: string) => Promise<boolean>; }) {
  const [activeTab, setActiveTab] = useState<"english" | "spanish">("english");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const contactEmail = result.emails?.split(",")[0]?.trim() || result.contact?.email || result.company_info?.extracted_emails?.split(",")[0]?.trim();

  let englishText = result.cold_email_english || result.draft?.english_body || result.draft?.body || "";
  let spanishText = result.cold_email_spanish || result.draft?.spanish_body || "";
  
  const subjectMatch = englishText.match(/^Subject:\\s*(.+)$/m);
  const subject = subjectMatch ? subjectMatch[1].trim() : (result.draft?.subject || "Outreach Proposal");
  englishText = englishText.replace(/^Subject:\\s*.+\\n+/m, "");
  spanishText = spanishText.replace(/^Asunto:\\s*.+\\n+/m, "").replace(/^Subject:\\s*.+\\n+/m, "");

  const gmailBodyText = spanishText && !englishText.includes(spanishText) 
    ? `${englishText}\\n\\n---\\n\\n${spanishText}`
    : englishText;

  const handleSend = async () => {
    setSending(true);
    setSendError(null);
    try {
      await onSendManually(result, companyName, companyUrl, false, "System");
      setSendSuccess("Sent Manually");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      setSendError(message);
    }
    setSending(false);
  };

  const handleSendAutomatically = async () => {
    setSending(true);
    setSendError(null);
    try {
      await onSendAutomatically(result, companyName, companyUrl);
      setSendSuccess("Sent Automatically");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      setSendError(message);
    }
    setSending(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 w-full"
    >
      {/* Contact Details & Socials */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-lg shadow-inner">
              {companyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100">{companyName}</h2>
              <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                Target Company
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-widest">Emails Found</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {result.emails && result.emails !== "Not Found" ? result.emails.split(',').map((e, i) => (
                <a key={i} href={`mailto:${e.trim()}`} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{e.trim()}</a>
              )) : <p className="text-sm text-slate-500">No emails found.</p>}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-widest">Phone Numbers</p>
            </div>
            {result.phone && result.phone !== "Not Found" ? (
              <a href={`tel:${result.phone}`} className="text-sm font-bold text-slate-700 dark:text-zinc-200 hover:underline">{result.phone}</a>
            ) : (
              <p className="text-sm text-slate-500">Not Found</p>
            )}
          </div>
        </div>

        <div className="mt-4 bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-slate-400" />
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-widest">Social Links</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.social_links?.linkedin && result.social_links.linkedin !== "Not Found" && (
              <a href={result.social_links.linkedin} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-[#0a66c2]/10 text-[#0a66c2] rounded-md text-xs font-bold hover:bg-[#0a66c2]/20 transition-colors">LinkedIn</a>
            )}
            {result.social_links?.instagram && result.social_links.instagram !== "Not Found" && (
              <a href={result.social_links.instagram} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-pink-500/10 text-pink-600 rounded-md text-xs font-bold hover:bg-pink-500/20 transition-colors">Instagram</a>
            )}
            {result.social_links?.facebook && result.social_links.facebook !== "Not Found" && (
              <a href={result.social_links.facebook} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-600/10 text-blue-700 rounded-md text-xs font-bold hover:bg-blue-600/20 transition-colors">Facebook</a>
            )}
            {(!result.social_links || Object.values(result.social_links).every(v => !v || v === "Not Found")) && (
              <span className="text-sm text-slate-500">No social profiles detected.</span>
            )}
          </div>
        </div>
      </div>

      {/* Services List */}
      {result.company_services && result.company_services.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100">
              <Package className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-black text-slate-800 dark:text-zinc-100 uppercase tracking-widest">Company Services & Products</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.company_services.map((svc, i) => (
              <div key={i} className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-medium text-slate-700 dark:text-zinc-200 shadow-sm">
                {svc}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drafts Section */}
      {(result.cold_email_english || result.cold_email_spanish || result.draft) && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-black text-slate-800 dark:text-zinc-100 uppercase tracking-widest">Generated Email Draft</p>
            </div>
            <CopyButton text={activeTab === "english" ? englishText : spanishText} />
          </div>

          {subject && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Subject</p>
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">{subject}</p>
              </div>
              <CopyButton text={subject} />
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab("english")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                activeTab === "english" ? "bg-white dark:bg-zinc-900 text-black dark:text-white border-slate-300 dark:border-zinc-600 shadow-sm" : "bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-white dark:bg-zinc-900"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setActiveTab("spanish")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                activeTab === "spanish" ? "bg-white dark:bg-zinc-900 text-black dark:text-white border-slate-300 dark:border-zinc-600 shadow-sm" : "bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-white dark:bg-zinc-900"
              }`}
            >
              Español
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl p-5 text-sm text-slate-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-80 overflow-auto font-mono custom-scrollbar">
            {activeTab === "english" ? (englishText || "No English draft generated") : (spanishText || "No Spanish draft generated")}
          </div>

          {contactEmail && (
            <div className="mt-6 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-zinc-100">
                    <Send className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    <span>Ready to send to: {contactEmail}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Trigger webhook or send via Gmail manually.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSendAutomatically}
                    disabled={sending || !!sendSuccess}
                    className="px-4 py-2 rounded-xl bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 hover:bg-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {sending ? <Clock className="w-3.5 h-3.5 animate-spin" /> : sendSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                    Trigger Webhook
                  </button>
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${contactEmail || ''}&su=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(gmailBodyText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onSendManually(result, companyName, companyUrl, true, "Gmail").catch(console.error)}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs flex items-center gap-2 hover:bg-amber-600 transition-all shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send through Gmail
                  </a>
                </div>
              </div>
              
              {sendError && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {sendError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
"""

start_idx = content.find("interface ResearchResultData {")
if start_idx == -1:
    print("Could not find start idx")
    exit(1)

end_idx = content.find("export default function EmailAgentPage()")
if end_idx == -1:
    print("Could not find end idx")
    exit(1)

old_send_email = """    try {
      const serviceNames = (result.recommended_services || []).map((s) => (typeof s === 'string' ? s : s.service_name || '')).filter(Boolean).join(", ");
      const fallbackEmail = Array.isArray(result.company_info?.contacts) ? result.company_info.contacts[0]?.email : undefined;
      const extractedEmail = result.company_info?.extracted_emails?.split(",")[0]?.trim();
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
      });"""

new_send_email = """    try {
      const serviceNames = result.company_services ? result.company_services.join(", ") : "";
      
      const emailToSend = result.emails?.split(",")[0]?.trim() || result.contact?.email || result.company_info?.extracted_emails?.split(",")[0]?.trim();
      if (!emailToSend || emailToSend === "Not Found") {
        throw new Error("No recipient email available to send.");
      }
      
      let englishText = result.cold_email_english || result.draft?.english_body || result.draft?.body || "";
      let spanishText = result.cold_email_spanish || result.draft?.spanish_body || "";
      const subjectMatch = englishText.match(/^Subject:\\s*(.+)$/m);
      const subject = subjectMatch ? subjectMatch[1].trim() : (result.draft?.subject || "Outreach Proposal");
      englishText = englishText.replace(/^Subject:\\s*.+\\n+/m, "");
      spanishText = spanishText.replace(/^Asunto:\\s*.+\\n+/m, "").replace(/^Subject:\\s*.+\\n+/m, "");

      const res = await fetch(`${API_BASE_URL}/send-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: emailToSend,
          company_name: result.company_info?.company_name || name,
          subject: subject,
          english_body: englishText,
          spanish_body: spanishText,
          recommended_services: serviceNames,
          contact_name: null,
          contact_role: null,
          website_url: url,
          phone_number: result.phone !== "Not Found" ? result.phone : null,
          manual,
          skip_send,
          action_type,
          email_agent_data: JSON.stringify(result),
        }),
      });"""

final_content = content[:start_idx] + new_code + "\n" + content[end_idx:]
if old_send_email not in final_content:
    print("WARNING: Could not find old_send_email exact match to replace.")

final_content = final_content.replace(old_send_email, new_send_email)

with open("frontend/src/app/email-agent/page.tsx", "w", encoding="utf-8") as f:
    f.write(final_content)

print("Patch applied successfully.")
