"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  User, 
  MapPin, 
  ShieldCheck, 
  Hash, 
  MessageSquare, 
  Activity, 
  Plus, 
  Send,
  Loader2,
  Trash2,
  CheckCircle,
  Clock,
  Briefcase,
  Users,
  Edit2,
  Save,
  X,
  TrendingUp,
  Zap,
  ChevronRight,
  Mail,
  FolderKanban,
  Target,
  Eye,
  TrendingDown,
  Lightbulb,
  ShieldAlert,
  Brain
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import LinkedContacts from '@/components/LinkedContacts';
import { cn } from '@/lib/utils';
import PageGuide from '@/components/PageGuide';
import axios from 'axios';
import { DollarSign, XCircle, Radar, Navigation } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
};

const CommentSkeleton = () => (
  <div className="p-5 bg-white dark:bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm animate-pulse">
    <div className="flex justify-between mb-4">
      <div className="h-4 w-24 bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-32 bg-slate-300/50 rounded-full"></div>
    </div>
    <div className="space-y-3">
      <div className="h-4 w-full bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-2/3 bg-slate-300/50 rounded-full"></div>
    </div>
  </div>
);

const ActivitySkeletonTab = () => (
  <div className="flex gap-4 p-5 bg-white dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 shadow-sm rounded-2xl animate-pulse relative overflow-hidden">
    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-300/50"></div>
    <div className="bg-indigo-100/50 p-3 rounded-xl h-12 w-12 flex-shrink-0"></div>
    <div className="flex-1 space-y-3 py-1">
      <div className="h-5 w-48 bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-full bg-slate-300/50 rounded-full"></div>
      <div className="h-3 w-24 bg-slate-300/50 rounded-full mt-3"></div>
    </div>
  </div>
);

// Payment Status Widget (labels are backend data values, kept as-is)
const paymentStatusColors = {
  Paid: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    label: 'Paid'
  },
  Pending: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: <Clock className="w-5 h-5 text-amber-500" />,
    label: 'Pending'
  },
  Failed: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    label: 'Failed'
  }
};

function PaymentStatusWidget({ status }: { status: string }) {
  const validStatus = (status as keyof typeof paymentStatusColors) in paymentStatusColors 
    ? status as keyof typeof paymentStatusColors 
    : 'Pending';
  const config = paymentStatusColors[validStatus];
  return (
    <div className={`flex items-center gap-4 p-6 rounded-2xl border border-white/60 shadow-sm ${config.bg}`}> 
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm">{config.icon}</div>
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Payment Status</div>
        <div className={`text-lg font-bold ${config.text}`}>{config.label}</div>
      </div>
    </div>
  );
}

// ─── Full AI Analysis Component ──────────────────────────────────────────────
function FullAIAnalysis({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<'idle'|'pending'|'done'|'error'>('idle');
  const [report, setReport] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: check if report already exists
  useEffect(() => {
    fetch(`${API_BASE_URL}/clients/${clientId}/full-analysis`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.status === 'done' && d?.report) {
          setReport(d.report);
          setStatus('done');
        } else if (d?.status === 'pending') {
          setStatus('pending');
          startPolling();
        }
      })
      .catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [clientId]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch(`${API_BASE_URL}/clients/${clientId}/full-analysis`);
        if (r.ok) {
          const d = await r.json();
          if (d.status === 'done' && d.report) {
            setReport(d.report);
            setStatus('done');
            clearInterval(pollRef.current!);
            return;
          }
          if (d.status === 'error') {
            setStatus('error');
            clearInterval(pollRef.current!);
            return;
          }
        }
      } catch {}
      if (attempts >= 36) { // 3 min max
        setStatus('error');
        clearInterval(pollRef.current!);
      }
    }, 5000);
  }, [clientId]);

  const handleRun = async () => {
    setStatus('pending');
    setReport(null);
    try {
      const r = await fetch(`${API_BASE_URL}/clients/${clientId}/full-analysis`, { method: 'POST' });
      if (!r.ok) { setStatus('error'); return; }
      startPolling();
    } catch {
      setStatus('error');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.85 }} className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 bg-gradient-to-r from-violet-400 to-indigo-500 rounded-full"></div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">AI Deep Analysis</h2>
        </div>
        <button
          onClick={handleRun}
          disabled={status === 'pending'}
          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-500/30 transition-all disabled:opacity-50"
        >
          {status === 'pending' ? <Loader2 size={16} className="animate-spin" /> : <Brain className="w-4 h-4" />}
          {status === 'pending' ? 'Analyzing...' : (report ? 'Re-run Analysis' : 'Run Full AI Analysis')}
        </button>
      </div>

      {status === 'pending' && (
        <div className="flex items-center gap-3 px-5 py-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl mb-4">
          <Loader2 size={18} className="animate-spin text-indigo-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">AI is researching this company...</p>
            <p className="text-xs text-indigo-500 mt-0.5">Scraping website, running deep investigation. Takes ~2 min. Results will appear automatically.</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="px-5 py-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl mb-4">
          <p className="text-sm font-bold text-red-700 dark:text-red-300">Analysis failed or timed out. Try again.</p>
        </div>
      )}

      {status === 'done' && report && (
        <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl shadow-sm">
          <pre className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">{report}</pre>
        </div>
      )}

      {status === 'idle' && !report && (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-slate-50 dark:bg-zinc-900/50 border border-dashed border-slate-300 dark:border-zinc-700 rounded-3xl">
          <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-sm mb-4">
            <Brain className="w-7 h-7 text-violet-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300 mb-2">No analysis yet</h3>
          <p className="text-sm text-slate-500 text-center max-w-md mb-6">Run a full AI deep analysis combining website scraping, competitor intelligence, ICP mapping, GTM strategy, and a complete markdown report.</p>
          <button
            onClick={handleRun}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2"
          >
            <Brain className="w-4 h-4" /> Run Full AI Analysis
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function ClientDetailPage() {
  const { t } = useLanguage();
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [remarks, setRemarks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [research, setResearch] = useState<any>(null);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const { role } = useRole();
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [milestoneData, setMilestoneData] = useState({
    nextMilestone: '',
    nextMilestoneDate: ''
  });
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [editServicesForm, setEditServicesForm] = useState({
    services_offered: '',
    services_requested: ''
  });
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [metricsForm, setMetricsForm] = useState<Record<string, string>>({
    total_revenue: '', growth_rate: '',
    monthly_revenue: '', revenue_growth_pct: '',
    total_conversions: '', avg_conversion_value: '',
    roi_multiple: '', roi_detail: '',
    campaign_progress: '', campaign_phase_note: '',
    untapped_revenue_note: '',
    total_visitors: '', engagement_rate: '', avg_time_on_site: '',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ companyName: '', projectName: '', websiteUrl: '' });
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      companyName: profileForm.companyName,
      projectName: profileForm.projectName,
      websiteUrl: profileForm.websiteUrl
    });
    setIsEditingProfile(false);
  };

  useEffect(() => {
    if (id) {
      Promise.all([
        fetchClientData(),
        fetchRemarks(),
        fetchActivities(),
        fetchEmails(),
        fetchEmployees(),
        fetchStatuses(),
        fetchServiceRequests(),
        fetchTimeline(),
        fetchResearch(),
      ]).catch(console.error).finally(() => setPageLoading(false));
    }
  }, [id]);

  const fetchStatuses = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/client-statuses`);
      const data = await res.json();
      setStatuses(data.statuses || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchClientData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
        const cf = data.customFields || {};
        setMetricsForm({
          total_revenue: cf.total_revenue || '',
          growth_rate: cf.growth_rate || '',
          monthly_revenue: cf.monthly_revenue || '',
          revenue_growth_pct: cf.revenue_growth_pct || '',
          total_conversions: cf.total_conversions || '',
          avg_conversion_value: cf.avg_conversion_value || '',
          roi_multiple: cf.roi_multiple || '',
          roi_detail: cf.roi_detail || '',
          campaign_progress: cf.campaign_progress || '',
          campaign_phase_note: cf.campaign_phase_note || '',
          untapped_revenue_note: cf.untapped_revenue_note || '',
          total_visitors: cf.total_visitors || '',
          engagement_rate: cf.engagement_rate || '',
          avg_time_on_site: cf.avg_time_on_site || '',
        });
        setEditServicesForm({
          services_offered: data.services_offered || '',
          services_requested: data.services_requested || ''
        });
        setMilestoneData({
          nextMilestone: data.nextMilestone || '',
          nextMilestoneDate: data.nextMilestoneDate || ''
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRemarks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/remarks`);
      if (res.ok) {
        const data = await res.json();
        setRemarks(data.remarks || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/activities`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchServiceRequests = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/services/requests`);
      if (res.ok) {
        const data = await res.json();
        setServiceRequests((data.requests || []).filter((r: any) => r.client_id === Number(id)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTimeline = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/timeline`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchResearch = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/research`);
      if (res.ok) {
        const data = await res.json();
        setResearch(data.research || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignEmployee = async (employeeId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/assign-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId })
      });
      if (res.ok) {
        setIsAssignModalOpen(false);
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/clients/${id}/keywords`, { keyword: newKeyword });
      if (res.data.success) {
        setNewKeyword('');
        setIsKeywordModalOpen(false);
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
      alert(t("client_detail.failed_add_keyword"));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveKeyword = async (keyword: string) => {
    if (!confirm(t("client_detail.remove_keyword_confirm").replace("{keyword}", keyword))) return;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      });
      if (res.ok) {
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, createdBy: 'Admin' })
      });
      if (res.ok) {
        fetchRemarks();
        form.reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = {
      method: formData.get('method') as string,
      content: formData.get('content') as string
    };
    try {
      const res = await axios.post(`${API_BASE_URL}/clients/${id}/activities`, data);
      if (res.data.success) {
        fetchActivities();
        setIsActivityModalOpen(false);
        form.reset();
      }
    } catch (err) {
      console.error(err);
      alert(t("client_detail.failed_add_activity"));
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateCall = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/simulate-call`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`${t("client_detail.ai_pitch_generated")}\n\n${data.pitch}`);
        fetchActivities();
      } else {
        alert(t("client_detail.failed_generate_simulation"));
      }
    } catch (err) {
      console.error(err);
      alert(t("client_detail.error_connecting_ai"));
    } finally {
      setLoading(false);
    }
  };

const handleSaveMetrics = async () => {
    setLoading(true);
    try {
      await updateProfile({ customFields: metricsForm });
      setIsEditingMetrics(false);
    } finally {
      setLoading(false);
    }
  };

  const [isSwotLoading, setIsSwotLoading] = useState(false);
  const handleGenerateSwot = async () => {
    setIsSwotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/swot`, { method: 'POST' });
      if (res.ok) {
        fetchClientData();
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

  const handleGenerateResearch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/auto-research`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to generate research.');
      }
      // Poll every 5s until research data appears (background job)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch(`${API_BASE_URL}/clients/${id}/research`);
          if (r.ok) {
            const d = await r.json();
            if (d.research?.email_agent_data || d.research?.company_overview) {
              setResearch(d.research);
              clearInterval(poll);
              setLoading(false);
              return;
            }
          }
        } catch {}
        if (attempts >= 24) { clearInterval(poll); setLoading(false); }
      }, 5000);
    } catch (err) {
      console.error(err);
      alert('Error generating AI research.');
      setLoading(false);
    }
  };

  const handleUpdateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(milestoneData);
      setIsMilestoneModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 animate-pulse mt-4">{t("client_detail.pulling_intelligence")}</h2>
      </div>
    );
  }
  if (!client) return <div className="p-8 text-red-500 font-bold text-center">{t("client_detail.not_found_error")}</div>;

  // --- INTERACTIVE STORYTELLING DASHBOARD ---
  return (
    <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* EPIC WELCOME HERO */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative mb-16 overflow-hidden rounded-3xl"
        >
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-90"></div>
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-96 h-96 bg-white dark:bg-zinc-900/20 rounded-full blur-3xl"
          ></motion.div>
          <motion.div 
            animate={{ scale: [1, 0.9, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, delay: 1 }}
            className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl"
          ></motion.div>

          {/* Content */}
          <div className="relative z-10 p-12 text-white">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <p className="text-cyan-200 font-bold text-sm uppercase tracking-widest mb-3">{t("client_detail.welcome_back")}</p>
              <h1 className="text-6xl md:text-7xl font-black mb-4 leading-tight">
                {client.companyName}
              </h1>
              <p className="text-xl text-white/90 font-medium max-w-2xl mb-6">
                {t("client_detail.your_growth_partner")}
              </p>
              <div className="flex gap-4 mt-6">
                <button onClick={() => router.push(`/clients/${client.id}/competitors`)} className="px-6 py-3 bg-white text-blue-600 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
                  <Navigation className="w-5 h-5" /> {t("client_detail.radar_scan")}
                </button>
                {client?.websiteUrl && (
                  <a href={client.websiteUrl.startsWith('http') ? client.websiteUrl : `https://${client.websiteUrl}`} target="_blank" rel="noreferrer" className="px-6 py-3 bg-blue-600/50 border border-blue-400/30 text-white font-bold rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center gap-2">
                    <Globe className="w-5 h-5" /> {t("client_detail.visit_site")}
                  </a>
                )}
              </div>
            </motion.div>

            {/* Stats Preview */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="grid grid-cols-3 gap-6 mt-8"
            >
              <div className="bg-white dark:bg-zinc-900/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <p className="text-white/70 text-sm font-bold uppercase tracking-wider mb-2">{t("client_detail.active_services_label")}</p>
                <p className="text-3xl font-black text-cyan-200">{serviceRequests.filter(r => r.status !== 'Pending').length || 0}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <p className="text-white/70 text-sm font-bold uppercase tracking-wider mb-2">{t("client_detail.total_revenue_label")}</p>
                <p className="text-3xl font-black text-cyan-200">{client.customFields?.total_revenue || '—'}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <p className="text-white/70 text-sm font-bold uppercase tracking-wider mb-2">{t("client_detail.growth_rate_label")}</p>
                <p className="text-3xl font-black text-cyan-200">{client.customFields?.growth_rate || '—'}</p>
              </div>
            </motion.div>
          </div>
        </motion.div>


        {/* STORYTELLING SECTION: Your Performance Journey */}
        <PageGuide
          pageKey="client-detail"
          title="Understanding Your Client Dashboard"
          description="This is the complete profile page for this client — a 360° view of their business, services, and performance."
          steps={[
            { icon: '📊', text: 'Performance Story section shows growth metrics like traffic, revenue, and rankings over time.' },
            { icon: '💼', text: 'Scroll down to see active services, recent activity, communications, and project timeline.' },
            { icon: '✏️', text: 'Admins can click "Edit Metrics" to update this client\'s financial and performance data.' },
            { icon: '💬', text: 'The comments section lets you add internal notes and track all communication history.' },
          ]}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">{t("client_detail.performance_story")}</h2>
            {(role === 'Admin' || role === 'Employee') && (
              <button onClick={() => setIsEditingMetrics(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-lg transition-all">
                <Edit2 size={12} /> {t("client_detail.edit_metrics")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1: Growth Momentum */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 group overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-100 text-green-600 rounded-xl"><TrendingUp size={24} /></div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100">{t("client_detail.growth_momentum")}</h3>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 font-bold mb-2">{t("client_detail.this_months_revenue")}</p>
                  <p className="text-4xl font-black text-green-600">{client.customFields?.monthly_revenue || '—'}</p>
                  <p className="text-sm text-green-700 mt-2 font-bold">{client.customFields?.revenue_growth_pct || t("client_detail.no_data_yet")}</p>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Conversion Power */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 group overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Zap size={24} /></div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100">{t("client_detail.conversion_power")}</h3>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 font-bold mb-2">{t("client_detail.total_conversions")}</p>
                  <p className="text-4xl font-black text-blue-600">{client.customFields?.total_conversions || '—'}</p>
                  <p className="text-sm text-blue-700 mt-2 font-bold">{client.customFields?.avg_conversion_value || t("client_detail.no_data_yet")}</p>
                </div>
              </div>
            </motion.div>

            {/* Card 3: ROI Victory */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 group overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><DollarSign size={24} /></div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100">{t("client_detail.roi_victory")}</h3>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 font-bold mb-2">{t("client_detail.return_on_investment")}</p>
                  <p className="text-4xl font-black text-purple-600">{client.customFields?.roi_multiple || '—'}</p>
                  <p className="text-sm text-purple-700 mt-2 font-bold">{client.customFields?.roi_detail || t("client_detail.no_data_yet")}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* PARTNERSHIP PROFILE HERO */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">{t("client_detail.your_partnership")}</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Profile Card - Modern Design */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-10 overflow-hidden shadow-sm"
            >
              {/* Animated glow */}
              <motion.div
                className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.5 }}
              ></motion.div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg"
                  >
                    <Briefcase size={32} className="text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{t("client_detail.company_profile")}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 font-bold">{t("client_detail.your_business_details")}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Editable Company Profile Fields */}
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <motion.div className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl">
                        <label className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-2 block">{t("client_detail.company_name")}</label>
                        <input className="w-full px-3 py-2 rounded-xl border border-cyan-200 font-black text-cyan-700 bg-white dark:bg-zinc-900" value={profileForm.companyName} onChange={e => setProfileForm({ ...profileForm, companyName: e.target.value })} />
                      </motion.div>
                      <motion.div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                        <label className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-2 block">{t("client_detail.project_name")}</label>
                        <input className="w-full px-3 py-2 rounded-xl border border-blue-200 font-black text-blue-700 bg-white dark:bg-zinc-900" value={profileForm.projectName} onChange={e => setProfileForm({ ...profileForm, projectName: e.target.value })} />
                      </motion.div>
                      <motion.div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                        <label className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-2 block">{t("client_detail.website")}</label>
                        <input className="w-full px-3 py-2 rounded-xl border border-purple-200 font-black text-purple-700 bg-white dark:bg-zinc-900" value={profileForm.websiteUrl} onChange={e => setProfileForm({ ...profileForm, websiteUrl: e.target.value })} />
                      </motion.div>
                      <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setIsEditingProfile(false)} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold">{t("client_detail.cancel")}</button>
                        <button type="submit" className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold">{t("client_detail.save")}</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4 }} className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl hover:bg-cyan-100 transition-all flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-2">{t("client_detail.company_name")}</p>
                          <p className="text-xl font-black text-cyan-700">{client.companyName}</p>
                        </div>
                        <button onClick={() => { setIsEditingProfile(true); setProfileForm({ companyName: client.companyName || '', projectName: client.projectName || '', websiteUrl: client.website || client.websiteUrl || '' }); }} className="ml-4 p-2 rounded-full bg-cyan-100 hover:bg-cyan-200"><Edit2 className="w-4 h-4 text-cyan-700" /></button>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.45 }} className="p-4 bg-blue-50 border border-blue-200 rounded-2xl hover:bg-blue-100 transition-all flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-2">{t("client_detail.project_name")}</p>
                          <p className="text-xl font-black text-blue-700">{client.projectName || t('client_detail.active_project')}</p>
                        </div>
                        <button onClick={() => { setIsEditingProfile(true); setProfileForm({ companyName: client.companyName || '', projectName: client.projectName || '', websiteUrl: client.website || client.websiteUrl || '' }); }} className="ml-4 p-2 rounded-full bg-blue-100 hover:bg-blue-200"><Edit2 className="w-4 h-4 text-blue-700" /></button>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 }} className="p-4 bg-purple-50 border border-purple-200 rounded-2xl hover:bg-purple-100 transition-all flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-2">{t("client_detail.website")}</p>
                          <p className="text-lg font-black text-purple-700 truncate">{client.website || client.websiteUrl || t('client_detail.default_website')}</p>
                        </div>
                        <button onClick={() => { setIsEditingProfile(true); setProfileForm({ companyName: client.companyName || '', projectName: client.projectName || '', websiteUrl: client.website || client.websiteUrl || '' }); }} className="ml-4 p-2 rounded-full bg-purple-100 hover:bg-purple-200"><Edit2 className="w-4 h-4 text-purple-700" /></button>
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
              <LinkedContacts clientId={id} />
            </motion.div>

            {/* Team & Services - Interactive */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-10 overflow-hidden shadow-sm"
            >
              {/* Animated glow */}
              <motion.div
                className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.5 }}
              ></motion.div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: -5 }}
                    className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg"
                  >
                    <Users size={32} className="text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{t("client_detail.active_services_title")}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 font-bold">{t("client_detail.what_we_do_for_you")}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {serviceRequests.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-zinc-400 italic py-2">{t("client_detail.no_active_services")}</p>
                  ) : (
                    serviceRequests.map((svc: any, idx: number) => (
                      <motion.div
                        key={svc.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.4 + idx * 0.05 }}
                        className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200 hover:bg-purple-100 transition-all"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                          className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shrink-0"
                        />
                        <span className="font-bold text-slate-800 dark:text-zinc-100 flex-1">{svc.service_name}</span>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">{svc.status}</span>
                        <CheckCircle size={14} className="text-green-400" />
                      </motion.div>
                    ))
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black rounded-xl shadow-lg hover:shadow-purple-500/30 transition-all"
                >
                  {t("client_detail.connect_with_team")}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </motion.div>
        {/* ENGAGEMENT OPPORTUNITIES */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">{t("client_detail.next_steps_forward")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strategy Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              whileHover={{ y: -8 }}
              className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 overflow-hidden cursor-pointer shadow-sm"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100 mb-2">{client.nextMilestone || t('client_detail.next_campaign_phase')}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">{client.nextMilestoneDate || t('client_detail.no_deadline_set')}</p>
                  </div>
                  <div className="p-3 bg-green-100 text-green-600 rounded-xl"><Zap size={24} /></div>
                </div>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Number(client.customFields?.campaign_progress) || 0)}%` }}
                  transition={{ delay: 1.6, duration: 0.8 }}
                  className="h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-3"
                />
                <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">
                  {client.customFields?.campaign_phase_note || (client.nextMilestone ? `${client.customFields?.campaign_progress || 0}% ${t('client_detail.complete')}` : t('client_detail.not_yet_configured'))}
                </p>
              </div>
            </motion.div>

            {/* Opportunity Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.55 }}
              whileHover={{ y: -8 }}
              className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100 mb-2">{t("client_detail.untapped_revenue")}</h3>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">{t("client_detail.growth_opportunities_ahead")}</p>
                    </div>
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><TrendingUp size={24} /></div>
                  </div>
                  <p className="text-lg font-bold text-slate-600 dark:text-zinc-300 mb-6">
                    {client.customFields?.untapped_revenue_note || t('client_detail.no_data_admin_can_set')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link href="/store" className="flex-1 py-3 text-center bg-orange-600/10 hover:bg-orange-600/20 text-orange-600 rounded-xl font-bold text-sm transition-all border border-orange-200">
                    {t("client_detail.see_opportunities")}
                  </Link>
                  <button onClick={handleSimulateCall} disabled={loading} className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50">
                    {loading ? t('client_detail.thinking') : t('client_detail.ai_call_simulation')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* DETAILED INSIGHTS - Tabs with Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">{t("client_detail.detailed_insights")}</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overview Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7 }}
              whileHover={{ y: -8 }}
              className="group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100 mb-6 flex items-center gap-2">
                  <Eye size={24} className="text-blue-600" />
                  {t("client_detail.performance_overview")}
                </h3>
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold mb-1">{t("client_detail.total_visitors")}</p>
                    <p className="text-2xl font-black text-blue-700">{client.customFields?.total_visitors || '—'}</p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold mb-1">{t("client_detail.engagement_rate")}</p>
                    <p className="text-2xl font-black text-blue-700">{client.customFields?.engagement_rate || '—'}</p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold mb-1">{t("client_detail.avg_time_on_site")}</p>
                    <p className="text-2xl font-black text-blue-700">{client.customFields?.avg_time_on_site || '—'}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Recent Activity Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.75 }}
              whileHover={{ y: -8 }}
              className="group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100 mb-6 flex items-center gap-2">
                  <Activity size={24} className="text-purple-600" />
                  {t("client_detail.recent_activity")}
                </h3>
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-zinc-400 italic">{t("client_detail.no_activities_recorded")}</p>
                  ) : (
                    activities.slice(0, 3).map((item: any, idx: number) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.8 + idx * 0.05 }}
                        onClick={() => setSelectedActivity(item)}
                        className="p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl cursor-pointer transition-colors"
                      >
                        <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">{item.action || item.content}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                          {item.method ? ` • via ${item.method}` : ''}
                        </p>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>

            {/* Team Connection Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              whileHover={{ y: -8 }}
              className="group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100 mb-6 flex items-center gap-2">
                  <Users size={24} className="text-pink-600" />
                  {t("client_detail.your_team")}
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const assignedEmp = employees.find((e: any) => e.id === client.assignedEmployeeId);
                    return assignedEmp ? (
                      <div className="p-4 bg-pink-50 border border-pink-200 rounded-xl">
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold mb-2">{t("client_detail.account_manager")}</p>
                        <p className="text-sm font-black text-pink-700">{assignedEmp.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{assignedEmp.email}</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-pink-50 border border-pink-200 rounded-xl">
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold mb-2">{t("client_detail.account_manager")}</p>
                        <p className="text-sm font-medium text-slate-400 italic">{t("client_detail.not_assigned_yet")}</p>
                      </div>
                    );
                  })()}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-pink-500/30 transition-all"
                  >
                    {t("client_detail.message_your_team")}
                  </motion.button>
                </div>
              </div>
</motion.div>
          </div>
        </motion.div>

        {/* ─── FULL AI ANALYSIS ─── */}
        <FullAIAnalysis clientId={id} />

        {/* ─── AI SWOT ANALYSIS ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.85 }} className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"></div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">{t("client_detail.swot_analysis")}</h2>
            </div>
            {client.swot_analysis && (
              <button
                onClick={handleGenerateSwot}
                disabled={isSwotLoading}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/30 transition-all disabled:opacity-50"
              >
                {isSwotLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {isSwotLoading ? t("client_detail.analyzing") : t("client_detail.refresh_swot")}
              </button>
            )}
          </div>

          {client.swot_analysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(() => {
                let swot = null;
                try {
                  swot = JSON.parse(client.swot_analysis);
                } catch (e) {}

                if (!swot) return <div className="col-span-2 text-slate-500 italic p-6 bg-slate-50 rounded-2xl">{t("client_detail.invalid_swot")}</div>;

                return (
                  <>
                    <div className="col-span-1 md:col-span-2 p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl shadow-sm">
                      <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed text-center">
                        {swot.summary}
                      </p>
                    </div>

                    <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-3xl">
                      <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-400 mb-4 flex items-center gap-2">
                        <TrendingUp size={20} /> {t("client_detail.swot_strengths")}
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
                        <TrendingDown size={20} /> {t("client_detail.swot_weaknesses")}
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
                        <Lightbulb size={20} /> {t("client_detail.swot_opportunities")}
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
                        <ShieldAlert size={20} /> {t("client_detail.swot_threats")}
                      </h3>
                      <ul className="space-y-3">
                        {swot.threats?.map((th: string, i: number) => (
                          <li key={i} className="flex gap-2 text-sm text-amber-700 dark:text-amber-300">
                            <span className="font-bold shrink-0 mt-0.5">•</span> <span>{th}</span>
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
              <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300 mb-2">{t("client_detail.no_swot_yet")}</h3>
              <p className="text-sm text-slate-500 text-center max-w-md mb-6">{t("client_detail.no_swot_desc")}</p>
              <button
                onClick={handleGenerateSwot}
                disabled={isSwotLoading || !client.websiteUrl}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSwotLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {isSwotLoading ? t("client_detail.analyzing") : (client.websiteUrl ? t("client_detail.perform_swot") : t("client_detail.add_website_first"))}
              </button>
            </div>
          )}
        </motion.div>

        {/* ─── UNIFIED ACTIVITY TIMELINE ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }} className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">{t("client_detail.activity_timeline")}</h2>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'all', label: t('client_detail.filter_all') },
              { key: 'email', label: t('client_detail.filter_emails') },
              { key: 'call', label: t('client_detail.filter_calls') },
              { key: 'invoice', label: t('client_detail.filter_invoices') },
              { key: 'milestone', label: t('client_detail.filter_milestones') },
              { key: 'file', label: t('client_detail.filter_files') },
              { key: 'activity', label: t('client_detail.filter_activities') },
            ].map(f => (
              <button key={f.key} onClick={() => setTimelineFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${timelineFilter === f.key ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:bg-zinc-950'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {/* Timeline List */}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 via-purple-300 to-transparent"></div>
            <div className="space-y-4">
              {timeline.filter(e => timelineFilter === 'all' || e.type === timelineFilter).length === 0 ? (
                <div className="flex flex-col items-center text-center py-12 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/40">
                  <Activity size={30} className="text-slate-300 dark:text-zinc-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-500 dark:text-zinc-300">{t("client_detail.no_timeline_activity")}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-400 mt-1">{t("client_detail.timeline_activity_desc")}</p>
                </div>
              ) : (
                timeline.filter(e => timelineFilter === 'all' || e.type === timelineFilter).slice(0, 30).map((ev: any, idx: number) => {
                  const colors: Record<string, { bg: string; ring: string; icon: string }> = {
                    email: { bg: 'bg-violet-100', ring: 'ring-violet-300', icon: '✉️' },
                    call: { bg: 'bg-amber-100', ring: 'ring-amber-300', icon: '📞' },
                    invoice: { bg: 'bg-emerald-100', ring: 'ring-emerald-300', icon: '💰' },
                    milestone: { bg: 'bg-pink-100', ring: 'ring-pink-300', icon: '🎯' },
                    file: { bg: 'bg-sky-100', ring: 'ring-sky-300', icon: '📁' },
                    activity: { bg: 'bg-slate-100 dark:bg-zinc-800', ring: 'ring-slate-300', icon: '⚡' },
                  };
                  const c = colors[ev.type] || colors.activity;
                  return (
                    <motion.div key={`${ev.type}-${ev.id}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                      className="relative flex items-start gap-4 pl-14">
                      <div className={`absolute left-3.5 w-5 h-5 rounded-full ${c.bg} ring-2 ${c.ring} flex items-center justify-center text-[10px]`}>{c.icon}</div>
                      <div onClick={() => setSelectedActivity(ev)} className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{ev.type}</span>
                            <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 mt-0.5">{ev.title}</p>
                            {ev.detail && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{ev.detail}</p>}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">{ev.date ? new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>

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
                  background: 'white', border: '1px solid #e2e8f0',
                  borderRadius: 24, padding: 32, width: '90%', maxWidth: 700,
                  maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
                }}
                className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100 m-0">{selectedActivity.title || selectedActivity.action}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 m-0 mt-1">
                      {selectedActivity.date || selectedActivity.createdAt ? new Date(selectedActivity.date || selectedActivity.createdAt).toLocaleString() : ''}
                      {selectedActivity.method ? ` • via ${selectedActivity.method}` : ''}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedActivity(null)}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-none rounded-full w-9 h-9 flex items-center justify-center cursor-pointer text-slate-500 dark:text-zinc-400 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                {(selectedActivity.detail || selectedActivity.content) && (
                  <div style={{ marginBottom: 20 }}>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 m-0 mb-2">{t("client_detail.summary")}</p>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl text-sm text-slate-600 dark:text-zinc-300">
                      {selectedActivity.content || selectedActivity.detail}
                    </div>
                  </div>
                )}

                {selectedActivity.details && (
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 m-0 mb-2">{t("client_detail.details")}</p>
                    <div className="bg-slate-100 dark:bg-zinc-950 p-4 rounded-xl text-sm text-slate-800 dark:text-zinc-200 whitespace-pre-wrap font-mono border border-slate-200 dark:border-zinc-800">
                      {selectedActivity.details}
                    </div>
                  </div>
                )}
                
                {!selectedActivity.detail && !selectedActivity.content && !selectedActivity.details && (
                  <p className="text-center text-slate-400 italic p-5">{t("client_detail.no_additional_details")}</p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>

    {/* ── Edit Metrics Modal ── */}
    {isEditingMetrics && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-3xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100">{t("client_detail.edit_performance_metrics")}</h3>
            <button onClick={() => setIsEditingMetrics(false)} className="p-2 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Hero Stats */}
          <p className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-3">{t("client_detail.hero_stats")}</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([['total_revenue', t('client_detail.total_revenue_label')], ['growth_rate', t('client_detail.growth_rate_label')]] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{label}</label>
                <input
                  value={metricsForm[key] || ''}
                  onChange={e => setMetricsForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            ))}
          </div>

          {/* Performance Story */}
          <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-3">{t("client_detail.performance_story_section")}</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([
              ['monthly_revenue', t('client_detail.this_months_revenue')],
              ['revenue_growth_pct', 'Revenue Growth % (e.g. +28%)'],
              ['total_conversions', t('client_detail.total_conversions')],
              ['avg_conversion_value', 'Avg Conversion Value (e.g. $27.66)'],
              ['roi_multiple', 'ROI Multiple (e.g. 7.2x)'],
              ['roi_detail', 'ROI Detail (e.g. $720 back per $100)'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{label}</label>
                <input
                  value={metricsForm[key] || ''}
                  onChange={e => setMetricsForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>

          {/* Next Steps */}
          <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-3">{t("client_detail.next_steps_forward")}</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{t("client_detail.campaign_progress_0_100")}</label>
              <input
                type="number" min="0" max="100"
                value={metricsForm.campaign_progress || ''}
                onChange={e => setMetricsForm(p => ({ ...p, campaign_progress: e.target.value }))}
                className="w-full bg-white dark:bg-zinc-900/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{t("client_detail.phase_note")}</label>
              <input
                value={metricsForm.campaign_phase_note || ''}
                onChange={e => setMetricsForm(p => ({ ...p, campaign_phase_note: e.target.value }))}
                className="w-full bg-white dark:bg-zinc-900/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{t("client_detail.untapped_revenue_note")}</label>
              <input
                value={metricsForm.untapped_revenue_note || ''}
                onChange={e => setMetricsForm(p => ({ ...p, untapped_revenue_note: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Detailed Insights */}
          <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">{t("client_detail.detailed_insights_section")}</p>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {([
              ['total_visitors', t('client_detail.total_visitors')],
              ['engagement_rate', t('client_detail.engagement_rate')],
              ['avg_time_on_site', t('client_detail.avg_time_on_site')],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{label}</label>
                <input
                  value={metricsForm[key] || ''}
                  onChange={e => setMetricsForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setIsEditingMetrics(false)}
              className="flex-1 py-3 border border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-slate-100 dark:bg-zinc-800 transition-all"
            >
              {t("client_detail.cancel")}
            </button>
            <button
              onClick={handleSaveMetrics}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loading ? t('client_detail.saving') : t('client_detail.save_metrics')}
            </button>
          </div>
        </motion.div>
      </div>
    )}
    </>
  );
}
