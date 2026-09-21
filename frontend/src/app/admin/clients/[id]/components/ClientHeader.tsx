'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Star, User, ArrowLeft, Plus, MessageSquare,
  CheckSquare, Calendar, Mail, Upload, Target, Zap,
  TrendingUp, Phone, Globe, Sun, Moon, MapPin, Linkedin
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface ClientHeaderProps {
  client: any;
  employees: any[];
  onBack: () => void;
  onAddNote: () => void;
  onAddConversation: () => void;
  onCreateTask: () => void;
  onScheduleMeeting: () => void;
  onSendEmail: () => void;
  onUploadFile: () => void;
  onCreateOpportunity: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  Active:   { bg: 'bg-emerald-100 ', text: 'text-emerald-700 ', dot: 'bg-emerald-500' },
  Hold:     { bg: 'bg-amber-100 ',   text: 'text-amber-700 ',   dot: 'bg-amber-500'   },
  Pending:  { bg: 'bg-blue-100 ',    text: 'text-blue-700 ',    dot: 'bg-blue-500'    },
  Inactive: { bg: 'bg-slate-100 dark:bg-zinc-800 ',     text: 'text-slate-600 dark:text-zinc-300 ',  dot: 'bg-slate-400'   },
};

function LeadScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200 " />
        <circle cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <span className="text-xs font-black" style={{ color }}>{pct}</span>
    </div>
  );
}

export default function ClientHeader({
  client, employees, onBack, onAddNote, onAddConversation,
  onCreateTask, onScheduleMeeting, onSendEmail, onUploadFile,
  onCreateOpportunity, darkMode, onToggleDarkMode
}: ClientHeaderProps) {
  const { language } = useLanguage();
  const statusCfg = STATUS_CONFIG[client?.status] || STATUS_CONFIG.Inactive;
  const assignedEmp = employees.find((e: any) => e.id === client?.assignedEmployeeId);
  const leadScore = client?.lead_score ?? 0;
  const dealValue = client?.deal_value ? `$${Number(client.deal_value).toLocaleString()}` : '—';


  // Contact info pills for display in header
  const contactChips = [
    client?.contact_person && { icon: User,     value: client.contact_person },
    client?.email          && { icon: Mail,     value: client.email,     href: `mailto:${client.email}` },
    client?.phone          && { icon: Phone,    value: client.phone,     href: `tel:${client.phone}` },
    client?.websiteUrl     && { icon: Globe,    value: client.websiteUrl, href: client.websiteUrl },
    client?.linkedin_url   && { icon: Linkedin, value: 'LinkedIn',       href: client.linkedin_url },
    client?.address        && { icon: MapPin,   value: client.address },
    assignedEmp            && { icon: Star,     value: `${language === 'es' ? 'Asignado:' : 'Assigned:'} ${assignedEmp.name}`, accent: true },
  ].filter(Boolean) as { icon: any; value: string; href?: string; accent?: boolean }[];

  // Brief description from research or tagline
  const description = client?.description || client?.tagline || client?.seoStrategy || client?.gmbName || null;
  const services = client?.services_offered || null;
  const companyName = client?.company_name || client?.companyName || client?.projectName || (client?.customFields?.sheet_data?.['Client Name']) || null;

  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-zinc-900 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-b border-slate-200 dark:border-zinc-700">
      <div className="w-full px-6 py-4">

        {/* Row 1: Breadcrumb + Controls */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-indigo-600 transition-colors font-bold tracking-tight"
          >
            <ArrowLeft size={16} className="text-slate-400" /> {language === 'es' ? 'Volver a Clientes' : 'Back to Clients'}
          </button>
        </div>

        {/* Row 2: Main header - Company identity + Contact Info + Score */}
        <div className="flex items-start gap-5">
          {/* Company Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600
                          flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 mt-0.5">
            <Building2 size={26} className="text-white" />
          </div>

          {/* Name + Description + Contact Chips */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-black text-slate-900 dark:text-zinc-50  leading-tight">
                {companyName || (language === 'es' ? 'Empresa Desconocida' : 'Unknown Company')}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${statusCfg.bg} ${statusCfg.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                {client?.status || 'Unknown'}
              </span>
              {client?.industry && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800  text-slate-600 dark:text-zinc-300 ">
                  {client.industry}
                </span>
              )}
            </div>

            {/* Company Description */}
            {description && (
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2 max-w-3xl leading-snug">
                {description}
              </p>
            )}



            {/* Contact Info Chips */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {contactChips.map(({ icon: Icon, value, href, accent }, i) => {
                const cls = `flex items-center gap-1 text-[11px] font-medium ${
                  accent
                    ? 'text-amber-600 '
                    : 'text-slate-500 dark:text-zinc-400 '
                }`;
                return href ? (
                  <a key={i} href={href} target="_blank" rel="noopener noreferrer"
                    className={cls + ' hover:text-indigo-600  transition-colors'}>
                    <Icon size={11} />
                    <span className="truncate max-w-[180px]">{value}</span>
                  </a>
                ) : (
                  <span key={i} className={cls}>
                    <Icon size={11} />
                    <span className="truncate max-w-[180px]">{value}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Score + Deal Value */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <LeadScoreRing score={leadScore} />
              <p className="text-[9px] font-bold text-slate-400  mt-0.5 uppercase tracking-wider">
                {language === 'es' ? 'Puntaje' : 'Score'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 ">
                {language === 'es' ? 'Valor' : 'Deal Value'}
              </p>
              <p className="text-xl font-black text-indigo-600 ">{dealValue}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
