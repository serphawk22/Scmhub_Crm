"use client";

import { useState, useEffect } from "react";
import { StickyNote, Users, Plus, Search, MoreVertical, X, Check, Loader2 } from "lucide-react";
import { API_BASE_URL } from '@/config';
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';
import DemoLimits from '@/components/DemoLimits';
import { useLanguage } from "@/context/LanguageContext";

export default function ProjectsPage() {
  const { t } = useLanguage();
  const { role, user } = useRole();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Planning");
  const [progress, setProgress] = useState(0);
  const [projectType, setProjectType] = useState("Development");
  const [clientId, setClientId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [projectMemberIds, setProjectMemberIds] = useState<number[]>([]);

  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);

  useEffect(() => {
    if (showCreateModal) {
      fetch(`${API_BASE_URL}/users`).then(r => r.json()).then(d => setAvailableUsers(d.users || []));
      fetch(`${API_BASE_URL}/clients`).then(r => r.json()).then(d => setAvailableClients(d.clients || []));
      fetch(`${API_BASE_URL}/leads`).then(r => r.json()).then(d => setAvailableLeads(d.leads || []));
    }
  }, [showCreateModal]);

  const fetchProjects = async () => {
    try {
      const url = new URL(`${API_BASE_URL}/projects`);
      if (['Employee', 'Intern', 'ProjectMember'].includes(role) && user?.id) {
        url.searchParams.append('member_id', String(user.id));
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          description, 
          status, 
          progress,
          project_type: projectType,
          clientId: clientId ? parseInt(clientId) : null,
          leadId: leadId ? parseInt(leadId) : null,
          projectMemberIds
        })
      });
      if (res.ok) {
        setShowCreateModal(false);
        fetchProjects();
        // Reset form
        setName("");
        setDescription("");
        setStatus("Planning");
        setProgress(0);
        setProjectType("Development");
        setClientId("");
        setLeadId("");
        setProjectMemberIds([]);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProjectStatus = async (e: React.ChangeEvent<HTMLSelectElement>, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus = e.target.value;
    try {
      await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchProjects();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{t("projects.title")}</h1>
          <p className="text-gray-500 font-medium">{t("projects.subtitle")}</p>
        </div>
        {role === "Admin" || role === "SuperAdmin" ? (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-2xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t("projects.new_project")}
          </button>
        ) : null}
      </div>

      <DemoLimits type="projects" />

      <PageGuide
        pageKey="projects"
        title={t("projects.guide_title")}
        description={t("projects.guide_desc")}
        steps={[
          { icon: '📁', text: t("projects.guide_s1") },
          { icon: '👥', text: t("projects.guide_s2") },
          { icon: '📊', text: t("projects.guide_s3") },
          { icon: '💬', text: t("projects.guide_s4") },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-[2.5rem]"></div>)
        ) : projects.length > 0 ? (
          projects.map((project: any) => (
            <Link 
              href={`/projects/${project.id}`} 
              key={project.id} 
              className="bg-white p-8 rounded-[2.5rem] border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={cn(
                  "p-4 rounded-2xl",
                  project.status === 'Planning' ? "bg-amber-50 text-amber-600" :
                  project.status === 'Active' ? "bg-blue-50 text-blue-600" :
                  project.status === 'Completed' ? "bg-green-50 text-green-600" : "bg-gray-50 dark:bg-zinc-950 text-gray-600 dark:text-zinc-300"
                )}>
                  <StickyNote className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                   <select
                     value={project.status}
                     onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                     onChange={(e) => updateProjectStatus(e, project.id)}
                     className={cn(
                       "px-2 py-1 text-[10px] font-black uppercase rounded-lg border mb-1 outline-none cursor-pointer hover:opacity-80 transition-opacity appearance-none",
                       project.status === 'Planning' ? "bg-amber-50 text-amber-600 border-amber-100" :
                       project.status === 'Active' ? "bg-blue-50 text-blue-600 border-blue-100" :
                       project.status === 'Completed' ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-50 dark:bg-zinc-950 text-gray-400 border-gray-100 dark:border-zinc-800"
                     )}
                   >
                     <option value="Planning">Planning</option>
                     <option value="Active">Active</option>
                     <option value="Completed">Completed</option>
                   </select>
                   <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">{t("projects.status")}</p>
                </div>
              </div>
              
              <h3 className="text-xl font-black text-gray-900 mb-2 truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight" title={project.name}>{project.name}</h3>
              <p className="text-sm text-gray-400 font-medium mb-6 line-clamp-2 min-h-[2.5rem]">
                {project.description || t("projects.no_description")}
              </p>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("projects.progress")}</p>
                  <p className="text-sm font-black text-gray-900">{project.progress}%</p>
                </div>
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      project.progress > 80 ? "bg-green-500" : project.progress > 40 ? "bg-blue-500" : "bg-amber-500"
                    )}
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center">
                 <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-black text-blue-600 dark:text-blue-400">
                      +{(project.employeeIds?.length || 0) + (project.internIds?.length || 0)}
                    </div>
                 </div>
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{t("projects.team_assigned")}</p>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full p-20 text-center bg-gray-50 dark:bg-zinc-950 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-zinc-700">
            <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border">
               <StickyNote className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-xl font-black text-gray-900 dark:text-zinc-50 mb-2">{t("projects.empty_title")}</p>
            <p className="text-gray-500 dark:text-zinc-400 font-medium max-w-xs mx-auto mb-8">{t("projects.empty_desc")}</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-3 bg-white dark:bg-zinc-900 border-2 border-gray-900 text-gray-900 dark:text-zinc-50 rounded-2xl font-bold text-sm hover:bg-gray-900 hover:text-white transition-all shadow-sm"
            >
               {t("projects.create_new_project")}
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-950/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-50 tracking-tight">{t("projects.create_project_title")}</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("projects.create_project_sub")}</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-3 hover:bg-white dark:bg-zinc-900 rounded-2xl transition-all shadow-sm">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("projects.field_project_title")}</label>
                <input 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("projects.project_title_placeholder")} 
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-950 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("projects.field_objective")}</label>
                <textarea 
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("projects.objective_placeholder")} 
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-950 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("projects.field_project_type")}</label>
                <select 
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-950 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none"
                >
                  <option value="Development">{t("projects.type_development")}</option>
                  <option value="Sales">{t("projects.type_sales")}</option>
                </select>
              </div>

              {projectType === 'Sales' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("projects.field_assign_client")}</label>
                    <select 
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-950 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none"
                    >
                      <option value="">{t("projects.none")}</option>
                      {availableClients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.email}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("projects.field_assign_lead")}</label>
                    <select 
                      value={leadId}
                      onChange={(e) => setLeadId(e.target.value)}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-950 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none"
                    >
                      <option value="">{t("projects.none")}</option>
                      {availableLeads.map(l => <option key={l.id} value={l.id}>{l.name || l.email}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("projects.field_assign_members")}</label>
                <select 
                  multiple
                  value={projectMemberIds.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                    setProjectMemberIds(selected);
                  }}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-950 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  style={{ minHeight: '100px' }}
                >
                  {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
                <p className="text-[10px] text-gray-400 ml-1">{t("projects.ctrl_select_hint")}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("projects.field_initial_status")}</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-950 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none"
                  >
                    <option>Planning</option>
                    <option>Active</option>
                    <option>Hold</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("projects.field_progress")}</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-950 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  {t("projects.cancel")}
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg shadow-gray-900/20 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t("projects.create_project_btn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
