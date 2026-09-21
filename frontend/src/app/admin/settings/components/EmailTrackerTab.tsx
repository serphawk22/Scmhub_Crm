"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, RefreshCw, CheckCircle, UserPlus, Building, Trash2, 
  Inbox, Loader2, Sparkles, Check, Shield
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import EmailOTPVerification from "@/components/EmailOTPVerification";

export default function EmailTrackerTab() {
  const { user } = useRole();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [extractedEmails, setExtractedEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [integrationEmail, setIntegrationEmail] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [intRes, emailRes] = await Promise.all([
        fetch(`${API_BASE_URL}/email-integrations?user_id=${user?.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/extracted-emails?user_id=${user?.id}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const intData = await intRes.json();
      const emailData = await emailRes.json();
      if (intData.ok) setIntegrations(intData.integrations);
      if (emailData.ok) setExtractedEmails(emailData.emails);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const connectGoogleOAuth = () => {
    if (user?.id) {
      window.location.href = `${API_BASE_URL}/auth/google/login?user_id=${user.id}`;
    }
  };

  const handleIntegrationOtpVerified = () => {
    setOtpVerified(true);
    setShowOtpVerification(false);
  };

  const syncInbox = async (integrationId: number) => {
    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/email-integrations/${integrationId}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        setExtractedEmails([...data.emails, ...extractedEmails]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const verifyEmail = async (emailId: number, action: string) => {
    setVerifyingId(emailId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/extracted-emails/${emailId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.ok) {
        setExtractedEmails(extractedEmails.filter(e => e.id !== emailId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* OTP Verification Modal */}
      <AnimatePresence>
        {showOtpVerification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowOtpVerification(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 p-6 w-full max-w-md"
            >
              <EmailOTPVerification
                email={integrationEmail}
                purpose="integration"
                onVerified={handleIntegrationOtpVerified}
                onCancel={() => setShowOtpVerification(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integrations Section */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400">
            <Mail size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Email Integrations</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Connect your inbox to automatically track leads and clients.</p>
          </div>
        </div>

        {integrations.length === 0 ? (
          <div className="space-y-4">
            {/* OTP verification step */}
            {!otpVerified && !showOtpVerification && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-blue-800 dark:text-blue-300">
                      Email verification required
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Before connecting an email integration, please verify your email address with a one-time code.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="email"
                        value={integrationEmail}
                        onChange={(e) => setIntegrationEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => setShowOtpVerification(true)}
                        disabled={!integrationEmail}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OTP verified badge */}
            {otpVerified && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {integrationEmail} verified
                </span>
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={connectGoogleOAuth}
                disabled={!otpVerified}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors font-bold text-slate-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={16} className="text-blue-500" />
                Sign in with Google
              </button>
              <button 
                disabled={!otpVerified}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl opacity-50 cursor-not-allowed font-bold text-slate-700 dark:text-zinc-300"
                title="Coming soon"
              >
                Connect Outlook
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map(int => (
              <div key={int.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                    {int.provider[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-zinc-100">{int.email_address}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                      <Check size={12} className="text-emerald-500"/> Connected via {int.provider}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => syncInbox(int.id)}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 shadow-sm"
                >
                  {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {syncing ? 'Syncing...' : 'Sync Inbox'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extracted Emails Section */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg dark:bg-amber-900/30 dark:text-amber-400">
              <Inbox size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Inbox Tracker</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Review AI-extracted emails to convert them into the CRM.</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold text-xs rounded-full">
            {extractedEmails.length} Pending
          </span>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {extractedEmails.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="py-12 text-center flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-slate-400 dark:text-zinc-500">
                  <CheckCircle size={32} />
                </div>
                <h3 className="font-bold text-slate-700 dark:text-zinc-200">Inbox Zero</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">You're all caught up! Sync your inbox to fetch new emails.</p>
              </motion.div>
            ) : (
              extractedEmails.map(email => (
                <motion.div 
                  key={email.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 hover:shadow-lg transition-shadow group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-black text-slate-800 dark:text-zinc-100">{email.subject}</h4>
                      <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">{email.sender_name} &lt;{email.sender_email}&gt;</p>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-zinc-500">
                      {new Date(email.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-zinc-300 mb-4 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-slate-100 dark:border-zinc-800">
                    "{email.body_snippet}"
                  </p>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles size={16} className={email.suggested_type === 'Lead' ? 'text-amber-500' : 'text-blue-500'} />
                      <span className="font-bold text-slate-700 dark:text-zinc-200">AI Suggests:</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${email.suggested_type === 'Lead' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {email.suggested_type}
                      </span>
                      <span className="text-slate-500 dark:text-zinc-400 italic hidden lg:inline-block ml-2">- {email.ai_analysis}</span>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                      <button 
                        onClick={() => verifyEmail(email.id, 'dismiss')}
                        disabled={verifyingId === email.id}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Dismiss"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => verifyEmail(email.id, 'convert_to_lead')}
                        disabled={verifyingId === email.id}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-400 rounded-lg font-bold text-sm transition-colors"
                      >
                        {verifyingId === email.id ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                        Add to Leads
                      </button>
                      <button 
                        onClick={() => verifyEmail(email.id, 'convert_to_client')}
                        disabled={verifyingId === email.id}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 rounded-lg font-bold text-sm transition-colors"
                      >
                        {verifyingId === email.id ? <Loader2 size={16} className="animate-spin" /> : <Building size={16} />}
                        Add to Clients
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
