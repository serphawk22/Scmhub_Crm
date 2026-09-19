"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/config";
import { motion } from "framer-motion";
import { Loader2, Briefcase, Phone, ArrowRight, CheckCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function OnboardingPage() {
  const { t } = useLanguage();
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("crm_user");
    if (!saved) {
      router.push("/login");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) {
      setError(t("onboarding.error_company_required"));
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const savedUser = JSON.parse(localStorage.getItem("crm_user") || "{}");
      
      const res = await fetch(`${API_BASE_URL}/onboarding`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Tenant-ID": String(savedUser.tenant_id)
        },
        body: JSON.stringify({ company, phone })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("onboarding.error_save_failed"));

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || t("onboarding.error_occurred"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f1729] font-sans p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-slate-100 dark:border-zinc-800">
          <div className="w-16 h-16 bg-blue-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{t("onboarding.welcome")}</h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-2 text-sm">{t("onboarding.subtitle")}</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">{t("onboarding.company_name")}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-zinc-100"
                  placeholder={t("onboarding.company_ph")}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">{t("onboarding.phone_optional")}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-5 h-5" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-zinc-100"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 p-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {t("onboarding.complete_setup")} <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
