"use client";

import { useState, useEffect } from "react";
import { 
  StickyNote, Users, Check, Loader2, ArrowLeft, 
   MessageSquare, Plus, Clock, UserPlus, Trash2,
   ChevronRight, Activity, Target, Shield, Briefcase, X, User,
   CheckCircle2, BarChart3, ListChecks, AlertCircle
} from "lucide-react";
import { API_BASE_URL } from '@/config';
import { cn } from "@/lib/utils";
import PageGuide from '@/components/PageGuide';
import KanbanTab from './KanbanTab';
import TeamTab from './TeamTab';
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useRole();
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
   const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Update state
  const [isUpdating, setIsUpdating] = useState(false);
  const [comment, setComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  
  // Dropdown states
  const [allEmployees, setAllEmployees] = useState([]);
  const [allInterns, setAllInterns] = useState([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'kanban' | 'team'>('overview');
  const [showAssignModal, setShowAssignModal] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${id}`);
      const projectData = await res.json();
      setData(projectData);
      const dashboardRes = await fetch(`${API_BASE_URL}/projects/${id}/dashboard`);
      if (dashboardRes.ok) setDashboard(await dashboardRes.json());
      
      // Fetch users for assignment
      const [empRes, intRes] = await Promise.all([
        fetch(`${API_BASE_URL}/employees`),
        fetch(`${API_BASE_URL}/interns`)
      ]);
      const empData = await empRes.json();
      const intData = await intRes.json();
      setAllEmployees(empData.employees || []);
      setAllInterns(intData.interns || []);
    } catch (error) {
      console.error("Failed to fetch project details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const updateProgress = async (val: number) => {
    setIsUpdating(true);
    try {
      await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: val })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update progress:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    try {
      await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setIsAddingComment(true);
    try {
      await fetch(`${API_BASE_URL}/projects/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: comment,
          author_id: user?.id,
          isInternal: true
        })
      });
      setComment("");
      fetchData();
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const assignTeamMember = async (userId: number, role: 'Employee' | 'Intern') => {
    const project = data.project;
    const field = role === 'Employee' ? 'employeeIds' : 'internIds';
    const currentIds = project[field] || [];
    
    if (currentIds.includes(userId)) return;
    
    setIsUpdating(true);
    try {
      await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: [...currentIds, userId] })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to assign member:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      <p className="text-sm font-black text-gray-400 uppercase tracking-widest">{t("project_detail.loading")}</p>
    </div>
  );

  if (!data?.project) return (
    <div className="text-center p-20">
      <p className="text-xl font-bold text-gray-900 dark:text-zinc-50">{t("project_detail.not_found")}</p>
      <Link href="/projects" className="text-blue-600 hover:underline mt-4 inline-block font-medium">{t("project_detail.return_projects")}</Link>
    </div>
  );

  const { project, remarks, team } = data;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.back()}
            className="p-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl text-gray-400 hover:text-gray-900 dark:text-zinc-50 shadow-sm transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
               <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight uppercase tracking-tighter">{project.name}</h1>
               <span className={cn(
                 "px-4 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm",
                 project.status === 'Planning' ? "bg-amber-50 text-amber-600 border-amber-100" :
                 project.status === 'Active' ? "bg-blue-50 text-blue-600 border-blue-100" :
                 "bg-green-50 text-green-600 border-green-100"
               )}>
                 {project.status}
               </span>
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
              <Shield className="w-3 h-3" /> {t("project_detail.project_id")}: {project.id} • {t("project_detail.created")} {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-2xl border shadow-sm self-stretch md:self-auto">
           {['Planning', 'Active', 'Completed'].map((s) => (
             <button
               key={s}
               onClick={() => updateStatus(s)}
               disabled={isUpdating}
               className={cn(
                 "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all",
                 project.status === s 
                  ? "bg-gray-900 text-white shadow-md shadow-gray-900/20" 
                  : "text-gray-400 hover:bg-gray-50 dark:bg-zinc-950"
               )}
             >
               {s}
             </button>
           ))}
        </div>
      </div>

      <PageGuide
        pageKey="project-detail"
        title={t("project_detail.guide_title")}
        description={t("project_detail.guide_desc")}
        steps={[
          { icon: '📍', text: t("project_detail.guide_s1") },
          { icon: '👥', text: t("project_detail.guide_s2") },
          { icon: '💬', text: t("project_detail.guide_s3") },
          { icon: '📊', text: t("project_detail.guide_s4") },
        ]}
      />

            {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 mb-8 space-x-8">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'}`}
        >
          {t("project_detail.tab_overview")}
        </button>
        <button
          onClick={() => setActiveTab('kanban')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'kanban' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'}`}
        >
          {t("project_detail.tab_kanban")}
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'team' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'}`}
        >
          {t("project_detail.tab_team")}
        </button>
      </div>

      {activeTab === 'kanban' && <KanbanTab projectId={id as string} />}
      {activeTab === 'team' && <TeamTab projectId={id as string} onUpdate={fetchData} />}
      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Progress & Description */}
        <div className="lg:col-span-2 space-y-8 font-poppins text-gray-800 dark:text-zinc-100">
                <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2.5rem] border shadow-sm">
                   <div className="flex items-center justify-between mb-5">
                      <div>
                         <h2 className="text-sm font-black uppercase tracking-widest text-gray-700 dark:text-zinc-200">Associated Team</h2>
                         <p className="text-xs text-gray-400 mt-1">People assigned to this project and its ticket board.</p>
                      </div>
                      <button onClick={() => setActiveTab('team')} className="text-xs font-black text-indigo-600 hover:underline">Manage team</button>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {[...(team?.employees || []).map((member: any) => ({ ...member, role: 'Employee' })), ...(team?.interns || []).map((member: any) => ({ ...member, role: 'Intern' })), ...(team?.projectMembers || []).map((member: any) => ({ ...member, role: 'Project Member' }))].map((member: any) => (
                         <span key={`${member.role}-${member.id}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-zinc-950 dark:text-zinc-200">
                            <User className="h-3.5 w-3.5 text-indigo-500" /> {member.name} <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{member.role}</span>
                         </span>
                      ))}
                      {(!team?.employees?.length && !team?.interns?.length && !team?.projectMembers?.length) && <span className="text-sm text-slate-400">No team members assigned yet.</span>}
                   </div>
                   <button onClick={() => setActiveTab('kanban')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700"><ListChecks className="h-4 w-4" /> Open ticket board</button>
                </div>
                {/* Ticket-driven delivery dashboard */}
                {dashboard && (
                   <div className="space-y-6">
                      <div className="flex items-center gap-3">
                         <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600"><BarChart3 className="w-5 h-5" /></div>
                         <div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-zinc-50">Delivery Dashboard</h2>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Live metrics from project tickets</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                         {[
                            ['Tickets Raised', dashboard.tickets.total, 'text-blue-600', ListChecks],
                            ['In Development', dashboard.tickets.in_dev, 'text-violet-600', Activity],
                            ['In QA', dashboard.tickets.in_qa, 'text-amber-600', AlertCircle],
                            ['In Production', dashboard.tickets.in_production, 'text-emerald-600', CheckCircle2],
                         ].map(([label, value, color, Icon]: any) => (
                            <div key={label} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border shadow-sm">
                               <Icon className={`w-4 h-4 ${color} mb-4`} />
                               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                               <p className="text-3xl font-black text-gray-900 dark:text-zinc-50 mt-1">{value}</p>
                            </div>
                         ))}
                      </div>

                      <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2.5rem] border shadow-sm">
                         <div className="flex items-center justify-between mb-6">
                            <div>
                               <h3 className="text-sm font-black uppercase tracking-widest text-gray-700 dark:text-zinc-200">Created vs Production</h3>
                               <p className="text-xs text-gray-400 mt-1">Cumulative tickets raised compared with tickets released to production</p>
                            </div>
                            <span className="text-xs font-black text-emerald-600">{dashboard.tickets.done} released</span>
                         </div>
                         <div className="h-44 flex items-end gap-1 border-b border-gray-100 dark:border-zinc-800 pb-1">
                            {(dashboard.tracker || []).slice(-30).map((point: any) => {
                               const max = Math.max(1, ...((dashboard.tracker || []).map((p: any) => p.created)));
                               return <div key={point.date} className="flex-1 h-full flex items-end gap-0.5" title={`${point.date}: ${point.created} created, ${point.production} production`}>
                                  <div className="w-1/2 bg-blue-400 rounded-t" style={{ height: `${(point.created / max) * 100}%` }} />
                                  <div className="w-1/2 bg-emerald-500 rounded-t" style={{ height: `${(point.production / max) * 100}%` }} />
                               </div>;
                            })}
                         </div>
                         <div className="flex gap-5 mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <span><i className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-2" />Created</span>
                            <span><i className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />Production</span>
                            <span className="ml-auto">{dashboard.tickets.not_started} not started</span>
                         </div>
                      </div>

                      <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2.5rem] border shadow-sm">
                         <div className="flex items-center justify-between mb-5">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-700 dark:text-zinc-200">Developer Statistics</h3>
                            <span className="text-xs font-bold text-gray-400">{dashboard.developer_count} developers</span>
                         </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                               <thead><tr className="text-[10px] uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-zinc-800"><th className="py-3">Developer</th><th>Total</th><th>Not Started</th><th>Dev</th><th>QA</th><th>Done</th></tr></thead>
                               <tbody>{(dashboard.developers || []).map((developer: any) => <tr key={developer.id} className="border-b border-gray-50 dark:border-zinc-800/60 last:border-0"><td className="py-4 font-black text-gray-800 dark:text-zinc-100">{developer.name}<span className="block text-[10px] font-normal text-gray-400">{developer.email}</span></td><td className="font-bold">{developer.total}</td><td>{developer.not_started}</td><td>{developer.in_dev}</td><td>{developer.in_qa}</td><td className="font-black text-emerald-600">{developer.done}</td></tr>)}</tbody>
                            </table>
                         </div>
                         {dashboard.tickets.unassigned > 0 && <p className="mt-4 text-xs font-bold text-amber-600">{dashboard.tickets.unassigned} ticket(s) need an owner.</p>}
                      </div>
                   </div>
                )}

           {/* Progress Card */}
           <div className="bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-[3rem] border shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 transition-transform">
                 <Activity className="w-32 h-32" />
              </div>
              
              <div className="flex justify-between items-end mb-8">
                 <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-zinc-50 mb-1">{t("project_detail.realtime_progress")}</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("project_detail.progress_sub")}</p>
                 </div>
                 <div className="text-4xl font-black text-blue-600">{project.progress}%</div>
              </div>
              
              <input 
                type="range"
                min="0"
                max="100"
                value={project.progress}
                onChange={(e) => updateProgress(Number(e.target.value))}
                className="w-full h-4 bg-gray-100 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-600 mb-4"
              />
              
              <div className="flex justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest">
                 <span>{t("project_detail.progress_initiation")}</span>
                 <span>{t("project_detail.progress_midway")}</span>
                 <span>{t("project_detail.progress_final")}</span>
              </div>
           </div>

           {/* Description Card */}
           <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                <Target className="w-4 h-4 text-blue-600" /> {t("project_detail.objective_scope")}
              </h2>
              <div className="prose prose-blue max-w-none text-gray-600 dark:text-zinc-300 leading-relaxed font-medium">
                 {project.description || t("project_detail.no_description")}
              </div>
              
              <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="p-6 bg-gray-50 dark:bg-zinc-950 rounded-[2rem] border border-gray-100 dark:border-zinc-800 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-gray-800 dark:text-zinc-100">{t("project_detail.assignees")}</p>
                    <p className="text-xl font-black text-gray-900 dark:text-zinc-50">{(project.employeeIds?.length || 0) + (project.internIds?.length || 0)}</p>
                 </div>
                 <div className="p-6 bg-gray-50 dark:bg-zinc-950 rounded-[2rem] border border-gray-100 dark:border-zinc-800 text-center col-span-2 md:col-span-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-gray-800 dark:text-zinc-100">{t("project_detail.total_assignees")}</p>
                    <p className="text-xl font-black text-gray-900 dark:text-zinc-50">{(project.employeeIds?.length || 0) + (project.internIds?.length || 0) + (project.projectMemberIds?.length || 0)}</p>
                 </div>
              </div>
           </div>

           {/* Comments Section */}
           <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border shadow-sm">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                   <MessageSquare className="w-4 h-4 text-blue-600" /> {t("project_detail.remarks_title")}
                 </h2>
                 <span className="text-[10px] font-black text-gray-300 uppercase">{remarks?.length || 0} {t("project_detail.total")}</span>
              </div>
              
              <form onSubmit={handleAddComment} className="mb-10 relative">
                 <textarea 
                   value={comment}
                   onChange={(e) => setComment(e.target.value)}
                   placeholder={t("project_detail.comment_placeholder")} 
                   className="w-full p-6 bg-gray-50 dark:bg-zinc-950 border-none rounded-[2rem] text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none min-h-[120px]"
                 />
                 <button 
                  type="submit"
                  disabled={isAddingComment || !comment.trim()}
                  className="absolute bottom-4 right-4 p-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
                 >
                   {isAddingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                 </button>
              </form>
              
              <div className="space-y-6">
                 {remarks && remarks.length > 0 ? (
                   remarks.map((r: any) => (
                     <div key={r.id} className="flex gap-4 group">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex-shrink-0 flex items-center justify-center font-black text-blue-600 text-xs border border-blue-100">
                           {r.authorId || 'A'}
                        </div>
                        <div className="flex-1">
                           <div className="bg-gray-50 dark:bg-zinc-950 p-6 rounded-[2rem] rounded-tl-none border border-gray-100 dark:border-zinc-800 group-hover:border-blue-100 transition-all">
                              <p className="text-sm font-medium text-gray-700 dark:text-zinc-200 leading-relaxed">{r.content}</p>
                           </div>
                           <div className="flex items-center gap-4 mt-2 ml-2">
                              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{new Date(r.createdAt).toLocaleString()}</span>
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest italic">• {t("project_detail.internal")}</span>
                           </div>
                        </div>
                     </div>
                   ))
                 ) : (
                   <div className="text-center py-10 opacity-30">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">{t("project_detail.no_logs")}</p>
                   </div>
                 )}
              </div>
           </div>
        </div>

        {/* Right Column: Team Management */}
        <div className="space-y-8 font-poppins">
           {/* Team Card */}
           <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3.5rem] border shadow-sm">
              <div className="flex justify-between items-center mb-10">
                 <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                   <Users className="w-4 h-4 text-blue-600" /> {t("project_detail.core_team")}
                 </h2>
                 <button 
                   onClick={() => setShowAssignModal(true)}
                   className="p-3 bg-gray-50 dark:bg-zinc-950 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all shadow-sm border border-gray-100 dark:border-zinc-800"
                 >
                    <UserPlus className="w-5 h-5" />
                 </button>
              </div>

              <div className="space-y-8">
                 {/* Employees */}
                 <div>
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Briefcase className="w-3 h-3" /> {t("project_detail.senior_members")} ({(team?.employees?.length || 0)})
                    </h3>
                    <div className="space-y-3">
                       {team?.employees?.map((e: any) => (
                          <div key={e.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 group hover:border-blue-100 transition-all">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm flex items-center justify-center font-black text-gray-900 dark:text-zinc-50">
                                   {e.name.charAt(0)}
                                </div>
                                <div className="leading-tight">
                                   <p className="text-sm font-black text-gray-900 dark:text-zinc-50">{e.name}</p>
                                   <p className="text-[10px] font-bold text-gray-400 italic">{t("project_detail.project_manager")}</p>
                                </div>
                             </div>
                             <button className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>

                 {/* Interns */}
                 <div>
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Activity className="w-3 h-3" /> {t("project_detail.supporting_interns")} ({(team?.interns?.length || 0)})
                    </h3>
                    <div className="space-y-3">
                       {team?.interns?.map((i: any) => (
                          <div key={i.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 group hover:border-blue-100 transition-all">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm flex items-center justify-center font-black text-blue-600">
                                   {i.name.charAt(0)}
                                </div>
                                <div className="leading-tight">
                                   <p className="text-sm font-black text-gray-900 dark:text-zinc-50">{i.name}</p>
                                   <p className="text-[10px] font-bold text-gray-400 tracking-tighter italic">{i.email}</p>
                                </div>
                             </div>
                             <button className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
                 
                 {/* Project Members */}
                 <div>
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <User size={12} className="w-3 h-3" /> {t("project_detail.project_members")} ({(team?.projectMembers?.length || 0)})
                    </h3>
                    <div className="space-y-3">
                       {team?.projectMembers?.map((pm: any) => (
                          <div key={pm.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 group hover:border-blue-100 transition-all">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm flex items-center justify-center font-black text-purple-600">
                                   {pm.name.charAt(0)}
                                </div>
                                <div className="leading-tight">
                                   <p className="text-sm font-black text-gray-900 dark:text-zinc-50">{pm.name}</p>
                                   <p className="text-[10px] font-bold text-gray-400 tracking-tighter italic">{pm.email}</p>
                                </div>
                             </div>
                             <button className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
                 
                 {(team?.employees?.length === 0 && team?.interns?.length === 0 && team?.projectMembers?.length === 0) && (
                   <div className="text-center py-10 px-6 border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-[2.5rem]">
                      <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">{t("project_detail.unassigned")}</p>
                      <button 
                        onClick={() => setShowAssignModal(true)}
                        className="text-xs font-black text-blue-600 hover:text-blue-700 transition-colors uppercase"
                      >
                         {t("project_detail.build_team")}
                      </button>
                   </div>
                 )}
              </div>
           </div>

           {/* Metrics Card */}
           <div className="bg-gray-900 p-10 rounded-[3.5rem] shadow-2xl shadow-gray-900/30 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                 <Shield className="w-20 h-20" />
              </div>
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-8">{t("project_detail.initiative_health")}</h2>
              
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                       <span>{t("project_detail.velocity")}</span>
                       <span className="text-green-400">{t("project_detail.optimal")}</span>
                    </div>
                    <div className="w-full bg-white dark:bg-zinc-900/10 h-1.5 rounded-full">
                       <div className="bg-green-400 h-full w-[85%] rounded-full shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                       <span>{t("project_detail.risk_level")}</span>
                       <span className="text-blue-400">{t("project_detail.minimal")}</span>
                    </div>
                    <div className="w-full bg-white dark:bg-zinc-900/10 h-1.5 rounded-full">
                       <div className="bg-blue-400 h-full w-[25%] rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)]"></div>
                    </div>
                 </div>
              </div>
              
              <div className="mt-10 pt-10 border-t border-white/10 flex items-center justify-between">
                 <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("project_detail.efficiency")}</div>
                 <div className="text-2xl font-black italic">A+</div>
              </div>
           </div>
        </div>
      </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-950/50">
                <h2 className="text-xl font-black text-gray-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-blue-600" /> {t("project_detail.assign_team")}
                </h2>
                <button onClick={() => setShowAssignModal(false)} className="p-3 hover:bg-white dark:bg-zinc-900 rounded-2xl transition-all shadow-sm">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-8">
                 <div>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{t("project_detail.available_employees")}</h3>
                    <div className="space-y-2">
                       {allEmployees.map((emp: any) => (
                          <button 
                            key={emp.id}
                            disabled={project.employeeIds?.includes(emp.id)}
                            onClick={() => assignTeamMember(emp.id, 'Employee')}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                              project.employeeIds?.includes(emp.id) 
                                ? "bg-blue-50 border-blue-100 opacity-60" 
                                : "hover:border-blue-300 hover:bg-gray-50 dark:bg-zinc-950 border-gray-100 dark:border-zinc-800"
                            )}
                          >
                             <span className="text-sm font-bold text-gray-900 dark:text-zinc-50">{emp.name}</span>
                             {project.employeeIds?.includes(emp.id) ? <Check className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{t("project_detail.available_interns")}</h3>
                    <div className="space-y-2">
                       {allInterns.map((int: any) => (
                          <button 
                            key={int.id}
                            disabled={project.internIds?.includes(int.id)}
                            onClick={() => assignTeamMember(int.id, 'Intern')}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                              project.internIds?.includes(int.id) 
                                ? "bg-blue-50 border-blue-100 opacity-60" 
                                : "hover:border-blue-300 hover:bg-gray-50 dark:bg-zinc-950 border-gray-100 dark:border-zinc-800"
                            )}
                          >
                             <span className="text-sm font-bold text-gray-900 dark:text-zinc-50">{int.name}</span>
                             {project.internIds?.includes(int.id) ? <Check className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
