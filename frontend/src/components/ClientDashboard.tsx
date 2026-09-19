"use client";

import { motion } from "framer-motion";
import { 
  Users, Send, Briefcase, Target, Activity, CheckCircle2, TrendingUp, DollarSign, Timer, 
  AlertTriangle, ArrowUpRight, FolderKanban, Shield, Lock, Eye, CheckCircle, Globe, ChevronRight, MessageCircle, Clock
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import PageGuide from "@/components/PageGuide";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

export function ClientDashboard({ clientStats, NAV_CARDS, language }: any) {
  const { user, role } = useRole();
  const { t } = useLanguage();

  const activeServicesCount = clientStats?.active_services_list?.length || 0;
  const pendingRequestsCount = clientStats?.pending_requests_count || 0;
  const activeProjectsCount = clientStats?.projects?.filter((p: any) => p.status !== "Completed").length || 0;
  const unreadNotifications = clientStats?.unread_notifications_count || 0;

  const checks = [
    { key: 'profile', label: t("client_dashboard.check_profile"), done: !!(clientStats?.companyName && clientStats?.website), link: '/clients' },
    { key: 'setup', label: t("client_dashboard.check_setup"), done: false, link: '/setup' },
    { key: 'files', label: t("client_dashboard.check_files"), done: (clientStats?.files?.length || 0) > 0, link: '/my-files' },
    { key: 'services', label: t("client_dashboard.check_services"), done: activeServicesCount > 0 || pendingRequestsCount > 0, link: '/store' },
    { key: 'proposals', label: t("client_dashboard.check_proposals"), done: (clientStats?.proposals?.length || 0) > 0, link: '/proposals' },
  ];
  const completedChecks = checks.filter(c => c.done).length;
  const onboardingProgress = Math.round((completedChecks / checks.length) * 100);
  const showOnboarding = onboardingProgress < 100;

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-6 max-w-[1600px] mx-auto w-full">
      <div className="mb-6">
        <PageGuide
          pageKey="dashboard-client-new"
          title={t("client_dashboard.welcome_title")}
          description={t("client_dashboard.welcome_desc")}
          steps={[
            { icon: '🏠', text: t("client_dashboard.pg_step1") },
            { icon: '🛒', text: t("client_dashboard.pg_step2") },
            { icon: '💬', text: t("client_dashboard.pg_step3") },
            { icon: '📈', text: t("client_dashboard.pg_step4") },
          ]}
        />
      </div>

      {/* HEADER SECTION */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {t("client_dashboard.welcome_back")}, {clientStats?.companyName || user?.name || t("client_dashboard.partner")}
          </h1>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-1">
            {t("client_dashboard.header_subtitle")}
          </p>
        </div>
      </motion.div>

      {/* KPI METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: t("client_dashboard.kpi_active_services"), value: activeServicesCount, trend: t("client_dashboard.kpi_trend_services"), icon: Briefcase, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          { title: t("client_dashboard.kpi_pending_requests"), value: pendingRequestsCount, trend: t("client_dashboard.kpi_trend_pending"), icon: Timer, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
          { title: t("client_dashboard.kpi_active_projects"), value: activeProjectsCount, trend: t("client_dashboard.kpi_trend_projects"), icon: FolderKanban, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
          { title: t("client_dashboard.kpi_notifications"), value: unreadNotifications, trend: t("client_dashboard.kpi_trend_notifications"), icon: Send, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
        ].map((kpi, idx) => (
          <motion.div key={idx} variants={itemVariants} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${kpi.bg}`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">{kpi.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{kpi.value}</h3>
              <p className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 mt-2">{kpi.trend}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* QUICK LINKS GRID */}
          <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm h-max">
            <div className="p-5 border-b border-[var(--border)]">
              <h3 className="font-bold text-[var(--text-primary)]">{t("client_dashboard.quick_links")}</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {NAV_CARDS.filter((c: any) => c.roles.includes(role || "Client")).map((card: any) => (
                <Link key={card.href} href={card.href} className="p-4 border border-[var(--border)] rounded-xl hover:border-[var(--primary)] hover:bg-[var(--sidebar-hover)] transition-all group flex flex-col items-center justify-center text-center gap-3">
                  <card.icon className="w-7 h-7 text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">{card.title}</span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* SERVICES IN MOTION */}
          {(activeServicesCount > 0 || pendingRequestsCount > 0) && (
            <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[var(--border)]">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" /> {t("client_dashboard.services_in_motion")}
                </h3>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {clientStats?.active_services_list?.map((svc: any, index: number) => (
                  <div key={svc.id || index} className="p-5 flex items-center justify-between hover:bg-[var(--sidebar-hover)] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <h4 className="font-bold text-[var(--text-primary)]">{svc.service_name}</h4>
                        <p className="text-xs font-medium text-emerald-500 mt-1 uppercase tracking-wider">{svc.status}</p>
                      </div>
                    </div>
                    <Link href="/messages" className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <MessageCircle className="w-5 h-5" />
                    </Link>
                  </div>
                ))}
                
                {pendingRequestsCount > 0 && (
                  <div className="p-5 flex items-center justify-between hover:bg-[var(--sidebar-hover)] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold">
                        {String(activeServicesCount + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <h4 className="font-bold text-[var(--text-primary)]">{pendingRequestsCount} {pendingRequestsCount > 1 ? t("client_dashboard.requests_in_review") : t("client_dashboard.request_in_review")}</h4>
                        <p className="text-xs font-medium text-amber-500 mt-1 uppercase tracking-wider">{t("client_dashboard.pending")}</p>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-slate-400">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ACTIVE PROJECTS */}
          {activeProjectsCount > 0 && (
            <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[var(--border)]">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-indigo-500" /> {t("client_dashboard.your_projects")}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                {clientStats?.projects?.map((project: any) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="p-4 border border-[var(--border)] rounded-xl hover:border-indigo-500/50 hover:bg-[var(--sidebar-hover)] transition-all cursor-pointer group">
                      <h4 className="font-bold text-[var(--text-primary)] mb-1 group-hover:text-indigo-500 transition-colors">{project.name}</h4>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">{project.status}</span>
                        <ArrowUpRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-indigo-500" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* ONBOARDING CHECKLIST WIDGET */}
          {showOnboarding && (
            <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
                <h3 className="font-bold text-[var(--text-primary)] text-sm uppercase tracking-wider text-amber-600">{t("client_dashboard.onboarding")}</h3>
                <span className="text-xs font-black text-amber-500">{onboardingProgress}%</span>
              </div>
              <div className="p-5">
                <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full mb-5 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${onboardingProgress}%` }} transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" />
                </div>
                <div className="space-y-2">
                  {checks.map((item, i) => (
                    <Link key={item.key} href={item.link}>
                      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${item.done ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-500/20' : 'bg-transparent border-[var(--border)] hover:border-amber-500/30 hover:bg-amber-50/50 dark:hover:bg-amber-500/5'}`}>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${item.done ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-300 dark:border-zinc-600 group-hover:border-amber-500'}`}>
                          {item.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <span className={`font-medium text-xs ${item.done ? 'text-slate-400 dark:text-zinc-500 line-through' : 'text-[var(--text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-500'}`}>{item.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ACTIVE STRATEGY WIDGET */}
          {(clientStats?.seoStrategy || clientStats?.targetKeywords?.length > 0) && (
            <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
               <div className="p-5 border-b border-[var(--border)]">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-500" /> {t("client_dashboard.active_strategy")}
                </h3>
              </div>
              <div className="p-5 space-y-5">
                {clientStats?.seoStrategy && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{t("client_dashboard.campaign_focus")}</p>
                    <p className="text-sm font-medium text-[var(--text-primary)] italic">&ldquo;{clientStats.seoStrategy}&rdquo;</p>
                  </div>
                )}
                {clientStats?.targetKeywords?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{t("client_dashboard.keywords")}</p>
                    <div className="flex flex-wrap gap-2">
                      {clientStats.targetKeywords.map((kw: string) => (
                        <span key={kw} className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-[var(--text-secondary)] text-xs font-semibold rounded-md">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {clientStats?.nextMilestone && (
                  <div className="p-4 border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-xl">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1">{t("client_dashboard.next_milestone")}</p>
                    <p className="font-bold text-[var(--text-primary)]">{clientStats.nextMilestone}</p>
                    {clientStats.nextMilestoneDate && <p className="text-xs text-[var(--text-secondary)] mt-1">{clientStats.nextMilestoneDate}</p>}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* COMPANY PROFILE WIDGET */}
          <motion.div variants={itemVariants} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
             <div className="p-5 border-b border-[var(--border)]">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Shield className="w-5 h-5 text-slate-400" /> {t("client_dashboard.identity")}
              </h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xl shrink-0">
                  {clientStats?.companyName?.charAt(0) || user?.name?.charAt(0) || 'C'}
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">{clientStats?.companyName || user?.name}</h3>
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mt-1">{t("client_dashboard.active_partner")}</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  {label: t("client_dashboard.website"), value: clientStats?.website || t("client_dashboard.not_configured"), icon: Globe },
                  { label: t("client_dashboard.status"), value: clientStats?.status || t("client_dashboard.status_active"), icon: CheckCircle },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-[var(--text-secondary)] mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}
