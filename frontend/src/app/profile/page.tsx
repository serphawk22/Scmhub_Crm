"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRole } from "@/context/RoleContext";
import { API_BASE_URL } from "@/config";
import { AdminTopbar } from "@/components/AdminTopbar";
import { Sidebar } from "@/components/Sidebar";
import { Save, User as UserIcon, Phone, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import PageGuide from '@/components/PageGuide';
import { useLanguage } from "@/context/LanguageContext";

export default function ProfilePage() {
  const { t } = useLanguage();
  const { role, isAuthenticated, loading: authLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: ""
  });

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users/me`);
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        
        setFormData({
          name: data.user?.name || "",
          email: data.user?.email || "",
          phone: data.user?.phone || "",
          role: data.user?.role || ""
        });
      } catch (err: any) {
        setErrorMsg("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [isAuthenticated, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone
        })
      });

      if (!res.ok) throw new Error("Failed to update profile");
      
      const data = await res.json();
      setFormData(prev => ({
        ...prev,
        name: data.user?.name || prev.name,
        phone: data.user?.phone || prev.phone
      }));
      setSuccessMsg("Profile updated successfully!");
      
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-inter transition-colors duration-300">
      <Sidebar currentPath="/profile" role={role} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <AdminTopbar />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-6">
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("profile.title")}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{t("profile.subtitle")}</p>
              </div>
              <PageGuide 
                pageKey="profile" 
                title={t("profile.guide_title")} 
                description={t("profile.guide_desc")} 
                steps={[
                  { icon: <UserIcon className="w-5 h-5 text-indigo-500" />, text: t("profile.guide_s1") },
                  { icon: <Phone className="w-5 h-5 text-indigo-500" />, text: t("profile.guide_s2") }
                ]} 
              />
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="px-6 py-8 sm:p-10">
                <form onSubmit={handleSubmit} className="space-y-8">
                  
                  {/* Status Messages */}
                  {successMsg && (
                    <div className="flex items-center gap-2 p-4 text-sm text-green-700 bg-green-50 rounded-xl border border-green-200">
                      <CheckCircle2 className="h-4 w-4" />
                      {successMsg}
                    </div>
                  )}
                  {errorMsg && (
                    <div className="p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-y-6 gap-x-8 sm:grid-cols-2">
                    
                    {/* Name */}
                    <div className="sm:col-span-2">
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t("profile.field_name")}
                      </label>
                      <div className="mt-2 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="pl-10 block w-full rounded-xl border-0 py-2.5 text-slate-900 dark:text-white dark:bg-slate-900/50 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>

                    {/* Email (Readonly) */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t("profile.field_email")}
                      </label>
                      <div className="mt-2 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          readOnly
                          value={formData.email}
                          className="pl-10 block w-full rounded-xl border-0 py-2.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/80 shadow-sm ring-1 ring-inset ring-slate-200 dark:ring-slate-700 sm:text-sm sm:leading-6 cursor-not-allowed"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{t("profile.email_readonly")}</p>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t("profile.field_phone")}
                      </label>
                      <div className="mt-2 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          name="phone"
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="pl-10 block w-full rounded-xl border-0 py-2.5 text-slate-900 dark:text-white dark:bg-slate-900/50 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{t("profile.phone_hint")}</p>
                    </div>

                  </div>

                  <div className="flex items-center justify-end gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <button
                      type="submit"
                      disabled={saving}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-200",
                        saving ? "opacity-70 cursor-not-allowed" : ""
                      )}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {t("profile.save_changes")}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>

          </div>
        </main>
      </div>
    </div>
  );
}
