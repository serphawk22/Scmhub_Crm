"use client";
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config";
import { useRole } from "../../context/RoleContext";
import { Activity, Users, Database, Globe, ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function SuperAdminPage() {
  const { t } = useLanguage();
  const { user } = useRole();
  const [tenants, setTenants] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  useEffect(() => {
    if (user && user.email !== "admin@serphawk.com") {
      window.location.href = "/";
      return;
    }
    
    fetch(`${API_BASE_URL}/superadmin/telemetry/global`)
      .then(async res => { if (!res.ok) throw new Error("Telemetry fetch failed"); return res.json(); })
      .then(data => setGlobalStats(data))
      .catch(console.error);

    fetch(`${API_BASE_URL}/superadmin/tenants`)
      .then(async res => { if (!res.ok) throw new Error("Tenants fetch failed"); return res.json(); })
      .then(data => {
        setTenants(data);
        setLoading(false);
      });
  }, [user]);

  const handleAnalyze = async (id: number) => {
    setAnalyzing(id);
    try {
      const res = await fetch(`${API_BASE_URL}/superadmin/tenants/${id}/analyze`, { method: "POST" });
      const data = await res.json();
      setAnalysisResult({ ...data, tenantId: id });
    } catch (e: any) {
      alert(t("superadmin.error_analyze"));
    } finally {
      setAnalyzing(null);
    }
  };

  if (user && user.email !== "admin@serphawk.com") return null;

  if (loading || !globalStats) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
      <div className="flex flex-col items-center gap-3">
        <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
        <p className="text-gray-500 font-medium">{t("superadmin.loading")}</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans relative">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-8 h-8 text-blue-600" />
          {t("superadmin.title")}
        </h1>
        <p className="text-gray-500 mt-2">{t("superadmin.subtitle")}</p>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-500" />
          {t("superadmin.global_overview")}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1 flex items-center justify-between">
              {t("superadmin.demo_accounts")} <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{t("superadmin.trials")}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{globalStats.demo_accounts}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1 flex items-center justify-between">
              {t("superadmin.active_accounts")} <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{t("superadmin.paid")}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{globalStats.active_accounts}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1 flex items-center justify-between">
              {t("superadmin.total_users")} <Users className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{globalStats.total_users}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1 flex items-center justify-between">
              {t("superadmin.clients_managed")} <Database className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{globalStats.total_clients_managed}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t("superadmin.most_used_pages")}</h3>
          {globalStats.top_pages?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium rounded-l-lg">{t("superadmin.page_path")}</th>
                    <th className="px-4 py-3 font-medium">{t("superadmin.total_time_global")}</th>
                    <th className="px-4 py-3 font-medium rounded-r-lg">{t("superadmin.total_visits")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {globalStats.top_pages.map((stat: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{stat.path}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {stat.time_spent > 60 ? `${Math.floor(stat.time_spent / 60)}m ${stat.time_spent % 60}s` : `${stat.time_spent}s`}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{stat.visits.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              {t("superadmin.no_data_global")}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("superadmin.tenant_directory")}</h2>
          <p className="text-sm text-gray-500">{t("superadmin.analyze_below")}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tenants.map(tenant => (
          <div key={tenant.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{tenant.name}</h3>
                <p className="text-xs text-gray-500">{tenant.email}</p>
              </div>
              {tenant.is_trial ? (
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">{t("superadmin.demo_badge")}</span>
              ) : (
                <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">{t("superadmin.active_badge")}</span>
              )}
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">{t("superadmin.users")}</span>
                <span className="font-medium">{tenant.users}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">{t("superadmin.clients_usage_limit")}</span>
                <span className="font-medium">{tenant.clients} / {tenant.limit_clients}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">{t("superadmin.ai_emails_gen")}</span>
                <span className="font-medium">{tenant.usage_emails} / {tenant.limit_emails}</span>
              </div>
            </div>

            <button 
              onClick={() => handleAnalyze(tenant.id)}
              disabled={analyzing === tenant.id}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analyzing === tenant.id ? t("superadmin.analyzing") : t("superadmin.run_analysis")}
              {!analyzing && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>

      {analysisResult && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-500" />
                {t("superadmin.detail_title")}
              </h2>
              <button 
                onClick={() => setAnalysisResult(null)}
                className="text-gray-400 hover:text-black dark:hover:text-white transition-colors bg-white dark:bg-gray-800 p-2 rounded-full shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-lg text-blue-900 dark:text-blue-300">{t("superadmin.ai_strategy")}</h3>
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm flex items-center gap-1">
                    {t("superadmin.conversion_score")} {analysisResult.conversion_score}/100
                  </div>
                </div>
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{analysisResult.insight}</p>
              </div>

              <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-gray-400" />
                {t("superadmin.page_utilization")}
              </h3>
              {analysisResult.page_stats?.length > 0 ? (
                <div className="overflow-hidden border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                      <tr>
                        <th className="px-6 py-4 font-medium">{t("superadmin.page_path_col")}</th>
                        <th className="px-6 py-4 font-medium">{t("superadmin.total_time_spent")}</th>
                        <th className="px-6 py-4 font-medium">{t("superadmin.total_visits_col")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {analysisResult.page_stats.map((stat: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{stat.path}</td>
                          <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                            {stat.time_spent > 60 ? `${Math.floor(stat.time_spent / 60)}m ${stat.time_spent % 60}s` : `${stat.time_spent}s`}
                          </td>
                          <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{stat.visits} visits</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500">{t("superadmin.no_tenant_data")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
