"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ExternalLink, 
  Clock, 
  ChevronRight, 
  Plus, 
  FileScan, 
  UploadCloud, 
  Loader2,
  Users,
  Briefcase,
  Globe,
  MoreVertical,
  Activity,
  Mail,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Phone
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '@/config';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { useRole } from '@/context/RoleContext';
import PageGuide from '@/components/PageGuide';
import dynamic from 'next/dynamic';
import { ContextMenu } from '@/components/ContextMenu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ClientMapView = dynamic(() => import('./ClientMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] glass-card rounded-[2.5rem] flex items-center justify-center border border-white/10 dark:border-white/5">
      <div className="flex flex-col items-center gap-4 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="font-bold">Loading Satellite Map...</span>
      </div>
    </div>
  )
});

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
};

interface ActivityLogEntry {
  id: number;
  action: string;
  method: string;
  content: string;
  details?: string;
  clientId: number;
  createdAt: string;
}

interface Client {
  id: number;
  projectName: string;
  category: string;
  email: string;
  status: string;
  keywords: string[];
  website?: string;
  websiteUrl?: string;
  services_offered?: string;
  services_requested?: string;
  companyName?: string;
  lastActivity?: string;
  lastActivityDate?: string;
  assignedEmployeeName?: string;
}

interface ClientStatusOption {
  id: number;
  name: string;
  color: string;
}

export default function ClientsPage() {
  const { t, language } = useLanguage();
  const { role, user } = useRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [statuses, setStatuses] = useState<ClientStatusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(12);
  const [totalCount, setTotalCount] = useState(0);
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'kanban' | 'graph' | 'pivot'>('list');
  const [isSheetImportOpen, setIsSheetImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetPreview, setSheetPreview] = useState<any[]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetImportState, setSheetImportState] = useState<'idle' | 'fetching' | 'preview' | 'importing' | 'done'>('idle');
  const [sheetImportResult, setSheetImportResult] = useState<{added: number; skipped: number; added_clients: any[]; skipped_clients: any[]} | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get('action') === 'add') {
      setIsModalOpen(true);
    }
  }, [searchParams]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [formData, setFormData] = useState({
    companyName: '',
    websiteUrl: '',
    email: '',
    projectName: '',
    gmbName: '',
    seoStrategy: '',
    tagline: '',
    targetKeywords: ''
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let isPaused = false;
    
    const handleEnter = () => isPaused = true;
    const handleLeave = () => isPaused = false;
    
    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);
    
    const interval = setInterval(() => {
      if (!isPaused && el) {
        if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
          el.scrollTop = 0; // Reset to top
        } else {
          el.scrollTop += 1;
        }
      }
    }, 50);
    
    return () => {
      clearInterval(interval);
      el.removeEventListener('mouseenter', handleEnter);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setOcrLoading(true);

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/documents/ocr`, {
        method: 'POST',
        body: formDataUpload,
      });

      if (response.ok) {
        const result = await response.json();
        // Pre-fill form from OCR result
        setFormData(prev => ({
          ...prev,
          companyName: result.company_name || prev.companyName,
          email: result.email || prev.email,
          websiteUrl: result.website || prev.websiteUrl,
        }));
        setIsOCRModalOpen(false);
        setIsModalOpen(true); // Open standard Add Client modal with prefilled data
      } else {
        alert(language === 'es' ? "Fallo al extraer datos de la imagen." : "Failed to extract data from image.");
      }
    } catch (error) {
      console.error(error);
      alert(language === 'es' ? "Ocurrió un error durante la extracción OCR." : "An error occurred during OCR extraction.");
    } finally {
      setOcrLoading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const [isAutofilling, setIsAutofilling] = useState(false);
  const handleAutofill = async () => {
    if (!formData.websiteUrl) {
      alert(language === 'es' ? 'Ingrese una URL primero' : 'Please enter a Website URL first');
      return;
    }
    setIsAutofilling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients/auto-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: formData.websiteUrl })
      });
      const result = await res.json();
      if (result.ok && result.data) {
        setFormData(prev => ({
          ...prev,
          companyName: result.data.companyName || prev.companyName,
          email: result.data.email || prev.email,
          tagline: result.data.tagline || prev.tagline,
          seoStrategy: result.data.seoStrategy || prev.seoStrategy,
          targetKeywords: result.data.targetKeywords 
            ? (Array.isArray(result.data.targetKeywords) ? result.data.targetKeywords.join(', ') : result.data.targetKeywords)
            : prev.targetKeywords
        }));
      } else {
        alert(result.error || 'Failed to auto-fill');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while auto-filling');
    } finally {
      setIsAutofilling(false);
    }
  };

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);

  const fetchActivities = async () => {
    try {
      const url = new URL(`${API_BASE_URL}/activities`);
      if (role === 'SalesManager' && user?.id) {
        url.searchParams.append('user_id', String(user.id));
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err) {
      console.error("Failed to fetch activities", err);
    }
  };

  useEffect(() => {
    fetchStatuses();
    fetchActivities();
  }, [role, user]);

  useEffect(() => {
    fetchClients();
  }, [filter, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchClients();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchStatuses = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/client-statuses`);
      const data = await res.json();
      setStatuses(data.statuses || []);
    } catch (err) {
      console.error("Failed to fetch statuses", err);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const url = new URL(`${API_BASE_URL}/clients`);
      if (filter !== 'All') url.searchParams.append('status', filter);
      if (search.trim()) url.searchParams.append('query', search.trim());
      url.searchParams.append('page', String(page));
      url.searchParams.append('per_page', String(perPage));
      if (role === 'SalesManager' && user?.id) {
        url.searchParams.append('assigned_employee_id', String(user.id));
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      setClients(data.clients || []);
      setTotalCount(data.total || 0);
      setLoadTime(Math.round(performance.now() - start));
    } catch (error) {
      console.error("Error fetching clients:", error);
      setClients([]);
      setTotalCount(0);
      setLoadTime(null);
    } finally {
      setLoading(false);
    }
  };

  const [addLoading, setAddLoading] = useState(false);
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addLoading) return;
    setAddLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          targetKeywords: formData.targetKeywords.split(',').map(k => k.trim())
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchClients();
        setFormData({
          companyName: '',
          websiteUrl: '',
          email: '',
          projectName: '',
          gmbName: '',
          seoStrategy: '',
          tagline: '',
          targetKeywords: ''
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddLoading(false);
    }
  };

  // Delete client handler
  const handleDeleteClient = async (clientId: number) => {
    if (!window.confirm(language === 'es' ? '¿Estás seguro de que quieres eliminar este cliente?' : 'Are you sure you want to delete this client?')) return;
    
    // Optimistic UI: remove from list immediately
    setClients(prev => prev.filter(c => c.id !== clientId));
    
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.detail || `HTTP ${res.status}`;
        alert(`Delete failed: ${errMsg}`);
        fetchClients(); // revert optimistic removal
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed: network error');
      fetchClients(); // revert optimistic removal
    }
  };

  const filteredClients = clients;

  const StatusBadge = ({ statusName }: { statusName: string }) => {
    const statusObj = statuses.find(s => s.name === statusName);
    const colorClass = statusObj ? statusObj.color.replace('bg-', 'text-').replace('500', '400') : "text-slate-400";
    const borderClass = statusObj ? statusObj.color.replace('bg-', 'border-').replace('500', '400/30') : "border-slate-500/30";
    
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border bg-black/20 backdrop-blur-md shadow-sm", colorClass, borderClass)}>
        <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_4px_currentColor]", statusObj ? statusObj.color : 'bg-slate-500')}></div>
        {statusName}
      </div>
    );
  };

  const parseServices = (str?: string) => {
    if (!str) return null;
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map((s: any) => s.name || s).join(', ');
      return str;
    } catch {
      return str;
    }
  };

  const handleQuickAction = async (clientId: number, actionType: string) => {
    setActionLoading(p => ({ ...p, [clientId]: actionType }));
    try {
      if (actionType === 'analyse') {
        const res = await fetch(`${API_BASE_URL}/clients/${clientId}/auto-research`, { method: 'POST' });
        if (!res.ok) throw new Error('Analysis failed');
        alert(language === 'es' ? 'Análisis completado exitosamente.' : 'Analysis completed successfully.');
      } else if (actionType === 'extract') {
        const res = await fetch(`${API_BASE_URL}/clients/${clientId}/extract-services`, { method: 'POST' });
        if (!res.ok) throw new Error('Extraction failed');
        alert(language === 'es' ? 'Servicios extraídos exitosamente.' : 'Services extracted successfully.');
      } else if (actionType === 'email') {
        const res = await fetch(`${API_BASE_URL}/clients/${clientId}/generate-outbound-draft`, { method: 'POST' });
        if (!res.ok) throw new Error('Draft generation failed');
        const data = await res.json();
        alert(language === 'es' ? 'Borrador generado y guardado en Oportunidades.' : 'Draft generated and saved in Opportunities.');
      } else if (actionType === 'opportunity') {
        router.push(`/admin/clients/${clientId}?tab=opportunities`);
      }
    } catch (error) {
      console.error(error);
      alert(language === 'es' ? 'Error al ejecutar la acción.' : 'Error executing action.');
    } finally {
      setActionLoading(p => { const next = { ...p }; delete next[clientId]; return next; });
    }
  };

  const handleSimulateCall = async (clientId: number) => {
    setActionLoading(p => ({ ...p, [clientId]: 'call' }));
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/simulate-call`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`AI Pitch Generated:\n\n${data.pitch}`);
        fetchActivities();
      } else {
        alert('Failed to generate simulation');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to AI');
    } finally {
      setActionLoading(p => { const next = { ...p }; delete next[clientId]; return next; });
    }
  };

  if (loading && clients.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-zinc-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-zinc-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 animate-pulse">{language === 'es' ? 'Cargando Directorio de Clientes...' : 'Loading Client Directory...'}</h2>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto space-y-8">
      <div className="flex flex-col xl:flex-row gap-8 items-stretch">
      <motion.div 
        initial="hidden" animate="show" variants={containerVariants}
        className="flex-1 space-y-8 min-w-0"
      >
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 w-full glass-card p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">{t("clients.title")}</h1>
          <p className="text-slate-500 dark:text-zinc-400 font-medium text-sm mt-1">{t("clients.description")}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <button 
            onClick={() => window.open(`${API_BASE_URL}/clients/export-csv`, '_blank')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-zinc-500/10 border border-zinc-500/30 text-zinc-400 rounded-xl font-bold hover:bg-zinc-500/20 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button 
            onClick={() => { setIsSheetImportOpen(true); setSheetImportState('idle'); setSheetPreview([]); setSheetUrl(''); setSheetImportResult(null); }}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-500/10 border border-slate-500/30 text-slate-400 rounded-xl font-bold hover:bg-slate-500/20 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Import Sheet
          </button>
          <button 
            onClick={() => setIsOCRModalOpen(true)}
            className="flex-1 md:flex-none px-5 py-2.5 bg-white dark:bg-zinc-900/70 backdrop-blur-md text-zinc-700 border border-zinc-100 rounded-xl font-bold hover:bg-white dark:bg-zinc-900 hover:shadow-md transition-all flex items-center justify-center gap-2"
          >
            <FileScan className="w-5 h-5" /> <span className="hidden sm:inline">{t("clients.ocr_scan")}</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none px-5 py-2.5 bg-gradient-to-r from-zinc-600 to-slate-600 text-white rounded-xl font-bold shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> {t("clients.add_client")}
          </button>
        </div>
      </motion.div>

      <PageGuide
        pageKey="clients"
        title={language === 'es' ? 'Cómo funciona el Hub de Clientes' : 'How the Client Hub works'}
        description={language === 'es' ? 'Su centro de mando para gestionar todas las cuentas de clientes, contactos e inteligencia.' : 'Your central command for managing all client accounts, contacts, and intelligence.'}
        steps={[
          { icon: '➕', text: language === 'es' ? 'Haga clic en "Agregar Cliente" para crear una nueva cuenta con el nombre de la empresa, sitio web, correo electrónico y palabras clave.' : 'Click "Add Client" to create a new account with company name, website, email, and keywords.' },
          { icon: '📷', text: language === 'es' ? 'Utilice "Escaneo OCR" para extraer detalles del cliente de una foto de tarjeta de visita automáticamente.' : 'Use "OCR Scan" to extract client details from a business card photo automatically.' },
          { icon: '🔍', text: language === 'es' ? 'Busque por nombre o empresa y use filtros para encontrar rápidamente a cualquier cliente.' : 'Search by name or company and use filters to quickly find any client.' },
          { icon: '👁️', text: language === 'es' ? 'Haga clic en cualquier tarjeta de cliente para ver su perfil completo, servicios, auditoría e historial de comunicación.' : 'Click any client card to view their full profile, services, audit, and communication history.' },
        ]}
      />

      {/* KPI Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="glass-card p-6 rounded-[2rem] shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users className="w-16 h-16 text-zinc-600" /></div>
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2">{t("clients.total_accounts")}</p>
          <p className="text-4xl font-black text-slate-800 dark:text-zinc-100">{totalCount}</p>
          {loadTime !== null && (
            <p className="text-[10px] text-slate-400 mt-2">Loaded in {loadTime}ms</p>
          )}
        </div>
        {statuses.slice(0, 3).map((status) => (
          <div key={status.id} className="glass-card p-6 rounded-[2rem] shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: status.color.replace('bg-', '') || '#6366f1' }}></div>
             <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2 pl-2">{status.name}</p>
             <p className="text-4xl font-black text-slate-800 dark:text-zinc-100 pl-2">{clients.filter(c => c.status === status.name).length}</p>
          </div>
        ))}
      </motion.div>
      </motion.div>

      {/* Activity Sidebar */}
      <motion.div
        initial="hidden" animate="show" variants={itemVariants}
        className="w-full xl:w-[450px] shrink-0 relative"
      >
        <div className="xl:absolute xl:inset-0 w-full h-full">
          <div className="glass-card rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6 shrink-0">
            <div className="p-2 bg-zinc-100 text-zinc-600 rounded-xl"><Activity className="w-5 h-5" /></div>
            <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100">{language === 'es' ? 'Actividad Reciente' : 'Recent Activity'}</h3>
          </div>
          <div ref={scrollRef} className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
            {activities.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400 text-center py-8">{language === 'es' ? 'No hay actividad.' : 'No activity yet.'}</p>
            ) : (
              activities.map(act => (
                <Link href={act.clientId ? `/admin/clients/${act.clientId}` : '#'} key={act.id} className="block p-4 bg-white dark:bg-zinc-900/60 hover:bg-white dark:bg-zinc-900 rounded-2xl border border-white/80 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-1 bg-zinc-50 text-zinc-600 rounded-lg">{act.action}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{new Date(act.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200 group-hover:text-zinc-600 transition-colors line-clamp-2">{act.content}</p>
                  {act.details && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 line-clamp-1">{act.details}</p>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
        </div>
      </motion.div>
      </div>

      {/* Main Glass Box */}
      <motion.div variants={itemVariants} className="glass-card rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-6 border-b border-white/10 dark:border-white/5 flex flex-col md:flex-row gap-6 justify-between items-center bg-black/5 dark:bg-white/5">
          <div className="flex items-center bg-black/10 dark:bg-white/10 p-1 rounded-2xl border border-black/5 dark:border-white/5 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'list' ? "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 shadow-md" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'kanban' ? "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 shadow-md" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'graph' ? "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 shadow-md" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('pivot')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'pivot' ? "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 shadow-md" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              Pivot
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'map' ? "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 shadow-md" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              Map
            </button>
          </div>
          <div className="relative w-full md:w-[28rem]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text" 
              placeholder={t("clients.search_placeholder")} 
              className="w-full pl-12 pr-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/50 focus:border-zinc-500 transition-all font-medium text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <button 
              onClick={() => { setFilter('All'); setPage(1); }}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors",
                filter === 'All' ? "bg-zinc-600 text-white shadow-md" : "bg-black/5 dark:bg-white/5 text-slate-600 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/10"
              )}
            >
              {t("clients.all_hubs")}
            </button>
            {statuses.map(stat => (
              <button 
                key={stat.id}
                onClick={() => { setFilter(stat.name); setPage(1); }}
                className={cn(
                  "px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors",
                  filter === stat.name ? "bg-zinc-600 text-white shadow-md" : "bg-black/5 dark:bg-white/5 text-slate-600 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/10"
                )}
              >
                {stat.name}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'list' && (
        <div className="p-6">
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[10px] uppercase tracking-widest text-slate-400 bg-black/5 dark:bg-white/5">
                    <th className="px-6 py-4 font-black">{language === 'es' ? 'Cliente' : 'Client'}</th>
                    <th className="px-6 py-4 font-black">Status</th>
                    <th className="px-6 py-4 font-black">Assignee</th>
                    <th className="px-6 py-4 font-black">Website</th>
                    <th className="px-6 py-4 font-black">{language === 'es' ? 'Última Actividad' : 'Last Activity'}</th>
                    <th className="px-6 py-4 font-black">Services</th>
                    <th className="px-6 py-4 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {filteredClients.map(client => (
                      <ContextMenu 
                        key={client.id}
                        onCtrlClick={() => window.open(`/admin/clients/${client.id}`, '_blank')}
                        actions={[
                          { label: 'Open in New Tab', icon: <ExternalLink className="w-4 h-4" />, onClick: () => window.open(`/admin/clients/${client.id}`, '_blank') },
                          { label: 'Open Client', icon: <ChevronRight className="w-4 h-4" />, onClick: () => router.push(`/admin/clients/${client.id}`) },
                          { label: 'AI Call Pitch', icon: <Phone className="w-4 h-4" />, onClick: () => handleSimulateCall(client.id) },
                          { label: 'Assign Owner', icon: <Users className="w-4 h-4" />, onClick: () => alert('Assign Owner feature coming soon') },
                          { label: 'View Activity', icon: <Activity className="w-4 h-4" />, onClick: () => router.push(`/admin/clients/${client.id}?tab=activity`) },
                          { label: 'Copy Client ID', icon: <CheckCircle2 className="w-4 h-4" />, onClick: () => navigator.clipboard.writeText(client.id.toString()) },
                          { label: 'Delete Client', icon: <XCircle className="w-4 h-4" />, danger: true, onClick: () => handleDeleteClient(client.id) },
                        ]}
                      >
                        <motion.tr 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                          onClick={() => router.push(`/admin/clients/${client.id}`)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm group-hover:text-zinc-600 transition-colors line-clamp-1">
                                {client.companyName || client.projectName || client.email || 'Unnamed Client'}
                              </span>
                              {client.email && (
                                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mt-0.5 line-clamp-1">
                                  <Mail className="w-3 h-3" /> {client.email}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge statusName={client.status} />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-zinc-500/10 border border-zinc-500/30 flex items-center justify-center text-zinc-400 shrink-0">
                                <Users className="w-3 h-3" />
                              </div>
                              <span className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate max-w-[120px]">
                                {client.assignedEmployeeName || 'Unassigned'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 font-medium">
                              <Globe className="w-4 h-4 text-slate-400" />
                              <span className="truncate max-w-[150px]">{client.website || client.websiteUrl || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-600 dark:text-zinc-300 font-medium truncate max-w-[200px]">
                                {client.lastActivity || '-'}
                              </span>
                              {client.lastActivityDate && (
                                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                  {new Date(client.lastActivityDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-col gap-1.5 w-[150px]">
                               {client.services_requested && <span title={parseServices(client.services_requested) || ''} className="px-2 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-md text-[10px] font-bold block truncate w-full">Req: {parseServices(client.services_requested)}</span>}
                               {client.services_offered && <span title={parseServices(client.services_offered) || ''} className="px-2 py-1 bg-zinc-500/10 border border-zinc-500/30 text-zinc-400 rounded-md text-[10px] font-bold block truncate w-full">Off: {parseServices(client.services_offered)}</span>}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={e => { e.preventDefault(); e.stopPropagation(); setExpandedRowId(p => p === client.id ? null : client.id); }} 
                                title="Quick Actions" 
                                className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-950 hover:bg-zinc-50 text-slate-400 hover:text-zinc-600 transition-colors"
                              >
                                <ChevronRight className={cn("w-4 h-4 transition-transform", expandedRowId === client.id && "rotate-90")} />
                              </button>
                              <button 
                                onClick={e => { e.preventDefault(); e.stopPropagation(); handleDeleteClient(client.id); }} 
                                title="Delete client" 
                                className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-950 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                        <AnimatePresence>
                          {expandedRowId === client.id && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-black/5 dark:bg-white/5 overflow-hidden"
                            >
                              <td colSpan={7} className="p-0 border-b border-black/10 dark:border-white/10">
                                <div className="px-6 py-4 flex items-center gap-3">
                                  <button
                                    onClick={() => handleQuickAction(client.id, 'analyse')}
                                    disabled={!!actionLoading[client.id]}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200 transition-colors"
                                  >
                                    {actionLoading[client.id] === 'analyse' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                    Analyse Client
                                  </button>
                                  <button
                                    onClick={() => handleQuickAction(client.id, 'extract')}
                                    disabled={!!actionLoading[client.id]}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200 transition-colors"
                                  >
                                    {actionLoading[client.id] === 'extract' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                                    Extract Services
                                  </button>
                                  <button
                                    onClick={() => handleQuickAction(client.id, 'email')}
                                    disabled={!!actionLoading[client.id]}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-700 text-sm font-bold hover:bg-blue-200 transition-colors"
                                  >
                                    {actionLoading[client.id] === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    Email Outbound
                                  </button>
                                  <button
                                    onClick={() => handleQuickAction(client.id, 'opportunity')}
                                    disabled={!!actionLoading[client.id]}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-500/10 border border-slate-500/30 text-slate-300 text-sm font-bold hover:bg-slate-500/20 transition-colors ml-auto"
                                  >
                                    <Briefcase className="w-4 h-4" />
                                    View Opportunity
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </ContextMenu>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              
              {filteredClients.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 shadow-sm">
                     <Search className="w-8 h-8 text-zinc-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-200">{language === 'es' ? 'No se encontraron clientes' : 'No clients found'}</h3>
                  <p className="text-slate-500 dark:text-zinc-400 mt-1 text-sm font-medium max-w-sm">{language === 'es' ? 'Intente ajustar su búsqueda.' : 'Try adjusting your search query or filters.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {viewMode === 'kanban' && (
          <div className="flex gap-4 p-6 overflow-x-auto h-[600px] items-start custom-scrollbar">
            {statuses.map(status => {
              const colClients = filteredClients.filter(c => c.status === status.name);
              return (
                <div key={status.id} className="w-80 shrink-0 flex flex-col bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl max-h-full">
                  <div className="p-4 font-bold text-slate-800 dark:text-zinc-100 flex items-center justify-between border-b border-black/10 dark:border-white/10">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shadow-[0_0_4px_currentColor]" style={{ backgroundColor: status.color.replace('bg-', '') || '#6366f1' }}></div>
                      {status.name}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-black/10 dark:bg-white/10 text-xs text-slate-600 dark:text-zinc-300">{colClients.length}</span>
                  </div>
                  <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[200px] custom-scrollbar">
                    {colClients.map(client => (
                      <motion.div key={client.id} layoutId={`client-${client.id}`} onClick={() => router.push(`/admin/clients/${client.id}`)}
                        className="p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-black/10 dark:border-white/10 cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-400 transition-colors group">
                        <div className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{client.companyName || client.projectName || client.email}</div>
                        {client.assignedEmployeeName && <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1"><Users className="w-3 h-3"/>{client.assignedEmployeeName}</div>}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {viewMode === 'graph' && (
          <div className="p-8 h-full min-h-[600px]">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-black/10 dark:border-white/10 h-[500px]">
              <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Clients by Status</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statuses.map(s => ({ name: s.name, count: filteredClients.filter(c => c.status === s.name).length }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{fill: 'rgba(99,102,241,0.05)'}} contentStyle={{backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)'}} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {viewMode === 'pivot' && (
          <div className="p-6 h-full overflow-auto min-h-[600px] custom-scrollbar">
            <table className="w-full text-left border-collapse bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <th className="p-4 font-bold">Assignee \ Status</th>
                  {statuses.map(s => <th key={s.id} className="p-4 font-bold text-center">{s.name}</th>)}
                  <th className="p-4 font-bold text-center border-l border-black/10 dark:border-white/10">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {Array.from(new Set(filteredClients.map(c => c.assignedEmployeeName || 'Unassigned'))).map(assignee => {
                  const empClients = filteredClients.filter(c => (c.assignedEmployeeName || 'Unassigned') === assignee);
                  return (
                    <tr key={assignee} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{assignee}</td>
                      {statuses.map(s => <td key={s.id} className="p-4 text-center text-slate-600 dark:text-zinc-300">{empClients.filter(c => c.status === s.name).length || '-'}</td>)}
                      <td className="p-4 text-center font-bold text-slate-900 dark:text-white border-l border-black/10 dark:border-white/10">{empClients.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'map' && (
          <div className="p-6">
            <React.Suspense fallback={<div>Loading map...</div>}>
              <ClientMapView clients={filteredClients} statuses={statuses} />
            </React.Suspense>
          </div>
        )}
      </motion.div>

      {viewMode === 'list' && (totalCount > 0 || clients.length > 0) && (
        <div className="flex flex-col gap-2 md:flex-row items-center justify-between px-4 py-3 rounded-3xl glass-card border border-white/10 dark:border-white/5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {language === 'es' ? 'Mostrando' : 'Showing'} {(page - 1) * perPage + 1} - {Math.min(page * perPage, totalCount || clients.length)} {language === 'es' ? 'de' : 'of'} {totalCount || clients.length} {language === 'es' ? 'clientes' : 'clients'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
            >
              {language === 'es' ? 'Anterior' : 'Previous'}
            </button>
            <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">{language === 'es' ? 'Página' : 'Page'} {page} {language === 'es' ? 'de' : 'of'} {Math.max(1, Math.ceil((totalCount || clients.length) / perPage))}</span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil((totalCount || clients.length) / perPage), p + 1))}
              disabled={page >= Math.ceil((totalCount || clients.length) / perPage)}
              className="px-4 py-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
            >
              {language === 'es' ? 'Siguiente' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Modals remain structurally similar, but updated with glassmorphism */}
      <AnimatePresence>
        {isOCRModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900/80 backdrop-blur-2xl border border-white rounded-[2rem] shadow-2xl w-full max-w-lg p-8 text-center relative overflow-hidden"
            >
               <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-zinc-500 to-slate-500"></div>
               <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black flex items-center gap-3 text-slate-800 dark:text-zinc-100">
                    <div className="p-2 bg-zinc-50 rounded-xl text-zinc-600"><FileScan className="w-6 h-6" /></div>
                    {language === 'es' ? 'Escaneo Inteligente' : 'Smart Scan'}
                 </h2>
                 <button onClick={() => setIsOCRModalOpen(false)} className="w-10 h-10 bg-white dark:bg-zinc-900 shadow-sm rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:text-zinc-100 transition-colors">&times;</button>
               </div>
               
               <div className="border-2 border-dashed border-zinc-200/50 rounded-3xl p-12 flex flex-col items-center justify-center bg-white dark:bg-zinc-900/50 relative hover:bg-white dark:bg-zinc-900/80 hover:border-zinc-400 transition-all group">
                   <input 
                     type="file" 
                     accept="image/*"
                     onChange={handleFileUpload}
                     disabled={ocrLoading}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                   />
                   
                   {ocrLoading ? (
                     <div className="flex flex-col items-center justify-center text-zinc-600">
                       <Loader2 className="w-12 h-12 animate-spin mb-4" />
                       <p className="font-bold text-lg">{language === 'es' ? 'Extrayendo Datos...' : 'Extracting Data...'}</p>
                       <p className="text-xs text-zinc-400 mt-1 font-medium">{language === 'es' ? 'El motor neuronal está procesando la imagen' : 'Neural engine is processing the image'}</p>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center text-slate-500 dark:text-zinc-400 group-hover:text-zinc-600 transition-colors">
                       <UploadCloud className="w-12 h-12 mb-4" />
                       <p className="font-bold text-lg text-slate-700 dark:text-zinc-200">{language === 'es' ? 'Suelte la Tarjeta de Visita Aquí' : 'Drop Visiting Card Here'}</p>
                       <p className="text-xs mt-2 font-medium">{language === 'es' ? 'Extrae Nombre, Email, Sitio Web automáticamente' : 'Auto-extracts Name, Email, Website'}</p>
                     </div>
                   )}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div 
               initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
               className="bg-white dark:bg-zinc-900/90 backdrop-blur-2xl rounded-[2rem] border border-white shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900/50">
                <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 tracking-tight">{language === 'es' ? 'Agregar Nuevo Cliente' : 'Add New Client'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-white dark:bg-zinc-900 shadow-sm rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:text-zinc-100 transition-colors">&times;</button>
              </div>
              <div className="overflow-y-auto p-8 custom-scrollbar">
                <form onSubmit={handleAddClient} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest pl-1">{language === 'es' ? 'Nombre de Empresa' : 'Company Name'}</label>
                      <input required className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all shadow-sm font-medium" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest pl-1">{language === 'es' ? 'URL del Sitio Web' : 'Website URL'}</label>
                      <div className="flex gap-2">
                        <input required className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all shadow-sm font-medium" value={formData.websiteUrl} onChange={e => setFormData({...formData, websiteUrl: e.target.value})} />
                        <button type="button" onClick={handleAutofill} disabled={isAutofilling} className="px-4 py-3 bg-zinc-50 text-zinc-600 rounded-2xl font-bold border border-zinc-100 hover:bg-zinc-100 transition-all shadow-sm flex items-center justify-center min-w-[120px] whitespace-nowrap">
                          {isAutofilling ? <Loader2 className="w-5 h-5 animate-spin" /> : <>🪄 Autofill</>}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest pl-1">Email</label>
                      <input required type="email" className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all shadow-sm font-medium" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest pl-1">{language === 'es' ? 'Nombre del Proyecto' : 'Project Name'}</label>
                      <input className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all shadow-sm font-medium" value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest pl-1">{language === 'es' ? 'Nombre GMB' : 'GMB Name'}</label>
                      <input className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all shadow-sm font-medium" value={formData.gmbName} onChange={e => setFormData({...formData, gmbName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest pl-1">{language === 'es' ? 'Estrategia SEO' : 'SEO Strategy'}</label>
                      <input className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all shadow-sm font-medium" value={formData.seoStrategy} onChange={e => setFormData({...formData, seoStrategy: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest pl-1">{language === 'es' ? 'Lema' : 'Tagline'}</label>
                    <input className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all shadow-sm font-medium" value={formData.tagline} onChange={e => setFormData({...formData, tagline: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest pl-1">{language === 'es' ? 'Palabras Clave Objetivo (separadas por coma)' : 'Target Keywords (comma separated)'}</label>
                    <textarea className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all shadow-sm font-medium min-h-[100px]" value={formData.targetKeywords} onChange={e => setFormData({...formData, targetKeywords: e.target.value})} />
                  </div>
                  
                  <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-zinc-800">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:bg-zinc-950 transition-colors shadow-sm">{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                    <button type="submit" className="px-8 py-3 bg-gradient-to-r from-zinc-600 to-slate-600 text-white rounded-xl font-bold hover:shadow-[0_8px_30px_rgba(79,70,229,0.3)] shadow-[0_4px_15px_rgba(79,70,229,0.2)] hover:-translate-y-0.5 transition-all">{language === 'es' ? 'Crear Cliente' : 'Create Client'}</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sheet Import Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {isSheetImportOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-white/10 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-500/20 text-slate-400 rounded-xl">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Import from Google Sheet / Excel</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Paste a public CSV URL (Google Sheet → File → Share → Publish to web → CSV)</p>
                  </div>
                </div>
                <button onClick={() => setIsSheetImportOpen(false)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all text-lg">×</button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-5 custom-scrollbar">

                {/* ── Step 1: URL Input ── */}
                {(sheetImportState === 'idle' || sheetImportState === 'fetching') && (
                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Google Sheet CSV URL or paste raw CSV below</label>
                      <div className="flex gap-2">
                        <input
                          value={sheetUrl}
                          onChange={e => setSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                          className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm outline-none focus:border-slate-500 transition-all"
                        />
                        <button
                          onClick={async () => {
                            if (!sheetUrl.trim()) return;
                            setSheetImportState('fetching');
                            try {
                              const r = await fetch(`${API_BASE_URL}/clients/import-sheet`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ csv_url: sheetUrl })
                              });
                              // Actually just preview: fetch raw CSV separately for table display
                              const rawR = await fetch(sheetUrl);
                              const rawText = await rawR.text();
                              const lines = rawText.trim().split('\n');
                              if (lines.length < 2) { setSheetImportState('idle'); return; }
                              const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
                              const rows = lines.slice(1).map(l => {
                                const vals = l.split(',').map(v => v.replace(/"/g,'').trim());
                                const obj: any = {};
                                headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
                                return obj;
                              });
                              setSheetHeaders(headers);
                              setSheetPreview(rows);
                              setSheetImportState('preview');
                            } catch (e) {
                              console.error(e);
                              setSheetImportState('idle');
                            }
                          }}
                          disabled={sheetImportState === 'fetching'}
                          className="px-5 py-3 bg-slate-500/20 border border-slate-500/30 text-slate-400 rounded-xl font-bold hover:bg-slate-500/30 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                          {sheetImportState === 'fetching' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Preview
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">Supported columns: S.No, Client Name, Website URL, Email, Contact, Country, Services, Market size, Description</p>
                    </div>
                    <div className="text-center text-slate-500 text-sm font-bold">— OR —</div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Paste raw CSV text</label>
                      <textarea
                        rows={8}
                        placeholder="S.No,Client Name,Website URL,Email,Contact,Country,Services,Description&#10;1,Acme Corp,https://acme.com,..."
                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-600 text-xs font-mono outline-none focus:border-slate-500 transition-all resize-none"
                        onChange={async e => {
                          const text = e.target.value.trim();
                          if (!text) return;
                          const lines = text.split('\n');
                          if (lines.length < 2) return;
                          const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
                          const rows = lines.slice(1).map(l => {
                            const vals = l.split(',').map(v => v.replace(/"/g,'').trim());
                            const obj: any = {};
                            headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
                            return obj;
                          });
                          setSheetHeaders(headers);
                          setSheetPreview(rows);
                          setSheetImportState('preview');
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ── Step 2: Preview Table ── */}
                {sheetImportState === 'preview' && sheetPreview.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white font-bold">
                        <Sparkles className="w-4 h-4 text-slate-400" />
                        {sheetPreview.length} rows detected – Preview (first 5 shown)
                      </div>
                      <button onClick={() => setSheetImportState('idle')} className="text-xs text-slate-400 hover:text-white">← Back</button>
                    </div>
                    <div className="rounded-2xl border border-white/10 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-black/30 border-b border-white/10">
                          <tr>
                            {sheetHeaders.map(h => (
                              <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {sheetPreview.slice(0, 5).map((row, i) => (
                            <tr key={i} className="hover:bg-white/5">
                              {sheetHeaders.map(h => (
                                <td key={h} className="px-4 py-3 text-slate-300 truncate max-w-[180px]">{row[h] || '–'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {sheetPreview.length > 5 && (
                      <p className="text-xs text-slate-500 text-center">...and {sheetPreview.length - 5} more rows will be imported</p>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={async () => {
                          setSheetImportState('importing');
                          try {
                            const rawCsv = [sheetHeaders.join(','), ...sheetPreview.map(r => sheetHeaders.map(h => r[h] || '').join(','))].join('\n');
                            const res = await fetch(`${API_BASE_URL}/clients/import-sheet`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ csv_text: rawCsv })
                            });
                            const data = await res.json();
                            setSheetImportResult(data);
                            setSheetImportState('done');
                            fetchClients();
                          } catch (e) {
                            console.error(e);
                            setSheetImportState('preview');
                          }
                        }}
                        className="flex-1 py-3.5 bg-gradient-to-r from-slate-600 to-zinc-600 text-white rounded-xl font-black hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4" /> Import All {sheetPreview.length} Clients + Auto-Research
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Importing spinner ── */}
                {sheetImportState === 'importing' && (
                  <div className="flex flex-col items-center justify-center py-16 gap-5">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-slate-500/20 rounded-full" />
                      <div className="absolute inset-0 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      <FileSpreadsheet className="absolute inset-0 m-auto w-7 h-7 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-black text-white">Importing & Running AI Research...</h3>
                    <p className="text-slate-400 text-sm text-center max-w-sm">Adding all rows as new clients. Duplicate detection is active. AI will auto-research each website in the background.</p>
                  </div>
                )}

                {/* ── Step 4: Done Summary ── */}
                {sheetImportState === 'done' && sheetImportResult && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-500/10 border border-zinc-500/30 rounded-2xl p-5 flex items-center gap-4">
                        <CheckCircle2 className="w-8 h-8 text-zinc-400 shrink-0" />
                        <div>
                          <p className="text-3xl font-black text-zinc-400">{sheetImportResult.added}</p>
                          <p className="text-xs text-zinc-400/70 font-bold uppercase tracking-wider mt-1">Clients Added</p>
                        </div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-center gap-4">
                        <AlertCircle className="w-8 h-8 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-3xl font-black text-amber-400">{sheetImportResult.skipped}</p>
                          <p className="text-xs text-amber-400/70 font-bold uppercase tracking-wider mt-1">Duplicates Skipped</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-slate-400" /> AI Auto-Research Running in Background</p>
                      <p className="text-sm text-slate-300">Each imported client's website is being scraped and researched automatically. Company details, services, and opportunities will populate on each client page within moments.</p>
                    </div>
                    {sheetImportResult.added_clients.length > 0 && (
                      <div className="rounded-2xl border border-white/10 overflow-hidden">
                        <div className="bg-black/20 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Added Clients</div>
                        <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                          {sheetImportResult.added_clients.map((c, i) => (
                            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="text-sm text-white font-medium">{c.company || c.website}</span>
                              {c.website && <span className="text-xs text-slate-500 ml-auto truncate max-w-[180px]">{c.website}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => { setIsSheetImportOpen(false); }} className="flex-1 py-3 bg-zinc-600 text-white rounded-xl font-bold hover:-translate-y-0.5 transition-all">
                        View Client List
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
