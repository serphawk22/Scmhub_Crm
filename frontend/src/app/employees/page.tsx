"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, Search, MoreVertical, Mail, Trash2, ShieldCheck, Briefcase, X, Check, Loader2, Key, Star } from "lucide-react";
import { API_BASE_URL } from '@/config';
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import PageGuide from '@/components/PageGuide';

export default function EmployeesPage() {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Employee");

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchEmployees();
        setName("");
        setEmail("");
        setPassword("");
        setRole("Employee");
      } else {
        const err = await res.json();
        alert(err.detail || t("employees.failed_create"));
      }
    } catch (error) {
      console.error("Failed to add employee:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("employees.confirm_delete"))) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchEmployees();
    } catch (error) {
      console.error("Failed to delete employee:", error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight uppercase tracking-tighter">{t("employees.title")}</h1>
          <p className="text-gray-500 dark:text-zinc-400 font-medium font-poppins">{t("employees.subtitle")}</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-black shadow-xl shadow-gray-900/20 transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" /> {t("employees.add_member")}
        </button>
      </div>

      <PageGuide
        pageKey="employees"
        title={t("employees.guide_title")}
        description={t("employees.guide_desc")}
        steps={[
          { icon: '👤', text: t("employees.guide_s1") },
          { icon: '🔑', text: t("employees.guide_s2") },
          { icon: '✏️', text: t("employees.guide_s3") },
          { icon: '📧', text: t("employees.guide_s4") },
        ]}
      />

      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border shadow-sm overflow-hidden text-gray-800 dark:text-zinc-100">
        <div className="p-8 border-b border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center bg-gray-50 dark:bg-zinc-950/50 gap-4">
           <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder={t("employees.search_placeholder")} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
           </div>
           <div className="flex gap-2">
              <span className="flex items-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-full border border-indigo-100 shadow-sm">
                 <ShieldCheck className="w-4 h-4" /> {t("employees.system_control")}
              </span>
           </div>
        </div>
        
        <div className="p-4 overflow-x-auto">
           <table className="w-full min-w-[600px]">
              <thead>
                 <tr className="text-left">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("employees.col_identity")}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("employees.col_digital")}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("employees.col_privileges")}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">{t("employees.col_actions")}</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {loading ? (
                   [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={4} className="h-20 px-6"></td></tr>)
                 ) : employees.length > 0 ? (
                   employees.map((member: any) => (
                     <tr key={member.id} className="hover:bg-gray-50 dark:bg-zinc-950 transition-all duration-300 group">
                        <td className="px-6 py-6">
                           <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border-2 shadow-sm transition-transform group-hover:scale-110",
                                member.role === 'Admin' ? "bg-red-50 border-red-100 text-red-600" : "bg-indigo-50 border-indigo-100 text-indigo-600"
                              )}>
                                 {member.name?.charAt(0) || 'U'}
                                 {member.role === 'Admin' && <Star className="w-3 h-3 absolute -top-1 -right-1 fill-amber-400 text-amber-500" />}
                              </div>
                              <div>
                                 <p className="font-black text-gray-900 dark:text-zinc-50 uppercase tracking-tight text-sm">{member.name}</p>
                                 <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest">{t("employees.member_since")} {new Date().getFullYear()}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           <div className="flex items-center gap-2">
                             <Mail className="w-3 h-3 text-gray-300" />
                             <p className="text-sm font-black text-gray-400 italic font-poppins">{member.email}</p>
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           <span className={cn(
                             "px-4 py-1.5 text-[10px] font-black uppercase rounded-full border shadow-sm flex items-center gap-2 w-fit",
                             member.role === 'Admin' ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-600 border-green-100"
                           )}>
                              {member.role === 'Admin' ? <ShieldCheck className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                              {member.role}
                           </span>
                        </td>
                        <td className="px-6 py-6 text-right flex justify-end gap-2 pr-10">
                           <button className="p-3 text-gray-300 hover:text-indigo-600 hover:bg-white dark:bg-zinc-900 hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-indigo-100">
                              <Mail className="w-5 h-5" />
                           </button>
                           <button onClick={() => handleDelete(member.id)} className="p-3 text-gray-300 hover:text-red-600 hover:bg-white dark:bg-zinc-900 hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-red-100">
                              <Trash2 className="w-5 h-5" />
                           </button>
                        </td>
                     </tr>
                   ))
                 ) : (
                   <tr>
                      <td colSpan={4} className="p-20 text-center">
                         <div className="w-20 h-20 bg-gray-50 dark:bg-zinc-950 rounded-3xl flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-gray-100 dark:border-zinc-800">
                            <Users className="w-10 h-10 text-gray-200" />
                         </div>
                         <p className="text-gray-400 font-black uppercase tracking-widest text-xs">{t("employees.empty")}</p>
                      </td>
                   </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-10 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-950/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-50 tracking-tighter uppercase">{t("employees.onboarding")}</h2>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">{t("employees.onboarding_sub")}</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-4 hover:bg-white dark:bg-zinc-900 border rounded-[1.5rem] transition-all shadow-sm">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("employees.field_name")}</label>
                  <input 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("employees.ph_name")} 
                    className="w-full px-6 py-5 bg-gray-50 dark:bg-zinc-950 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-inner"
                  />
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-gray-800 dark:text-zinc-100">{t("employees.field_privilege")}</label>
                   <select 
                     value={role}
                     onChange={(e) => setRole(e.target.value)}
                     className="w-full px-6 py-5 bg-gray-50 dark:bg-zinc-950 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none shadow-inner"
                   >
                     <option>Employee</option>
                     <option>Admin</option>
                   </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("employees.field_email")}</label>
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="corporate.id@crm.com" 
                  className="w-full px-6 py-5 bg-gray-50 dark:bg-zinc-950 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-inner"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                   <Key className="w-3 h-3 text-indigo-500" /> {t("employees.field_password")}
                </label>
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("employees.ph_password")} 
                  className="w-full px-6 py-5 bg-gray-50 dark:bg-zinc-950 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-inner"
                />
              </div>

              <div className="pt-8 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-8 py-5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  {t("employees.cancel")}
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-8 py-5 bg-gray-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-black shadow-2xl shadow-gray-900/30 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 text-green-400" />}
                  {t("employees.deploy")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
