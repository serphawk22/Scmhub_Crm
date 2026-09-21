"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";
import { AdminTopbar } from "@/components/AdminTopbar";
import { Sidebar } from "@/components/Sidebar";
import { 
  Kanban, Plus, MoreVertical, DollarSign, Calendar, Clock, MapPin, Search, Pencil
} from "lucide-react";

interface Deal {
  id: number;
  title: string;
  value: number;
  client_id: number;
  client_name: string;
  assigned_to: number | null;
  assigned_name?: string;
  stage: string;
  expected_close_date: string | null;
  created_at: string;
}

const STAGES = ["Lead", "Discovery", "Demo", "Negotiation", "Closed Won", "Closed Lost"];

export default function PipelinePage() {
  const { t } = useLanguage();
  const { role, user } = useRole();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [salesPerformance, setSalesPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [newDeal, setNewDeal] = useState({ title: "", value: "", client_id: "", assigned_to: "", stage: "Lead", expected_close_date: "" });
  const [clients, setClients] = useState<{ id: number; email: string; companyName?: string }[]>([]);
  const [salesUsers, setSalesUsers] = useState<{ id: number; name: string; email: string }[]>([]);

  useEffect(() => {
    if (role === "Client") {
      router.push("/login");
      return;
    }
    fetchDeals();
    fetchClients();
    fetch(`${API_BASE_URL}/users?role=SalesManager,Employee`).then(r => r.json()).then(data => setSalesUsers(data.users || [])).catch(() => {});
  }, [role, router]);

  const fetchDeals = async () => {
    try {
      const url = role === "SalesManager" ? `${API_BASE_URL}/deals?user_id=${user?.id || ""}` : `${API_BASE_URL}/deals`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch deals");
      const data = await res.json();
      setDeals(data.deals);
      setSalesPerformance(data.sales_performance || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error("Failed to fetch clients for dropdown", err);
    }
  };

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", deal.id.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    if (!draggedDeal || draggedDeal.stage === newStage) {
      setDraggedDeal(null);
      return;
    }

    const updatedDeals = deals.map(d => d.id === draggedDeal.id ? { ...d, stage: newStage } : d);
    setDeals(updatedDeals);

    try {
      const res = await fetch(`${API_BASE_URL}/deals/${draggedDeal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage })
      });
      if (!res.ok) throw new Error("Failed to update deal stage");
    } catch (err) {
      console.error(err);
      fetchDeals();
    }
    setDraggedDeal(null);
  };

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = Boolean(editingDeal);
      const res = await fetch(`${API_BASE_URL}/deals${isEditing ? `/${editingDeal?.id}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDeal.title,
          value: parseFloat(newDeal.value) || 0.0,
          client_id: parseInt(newDeal.client_id),
          assigned_to: role === "SalesManager" ? user?.id || null : (newDeal.assigned_to ? Number(newDeal.assigned_to) : null),
          stage: newDeal.stage,
          expected_close_date: newDeal.expected_close_date || null
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        setEditingDeal(null);
        setNewDeal({ title: "", value: "", client_id: "", assigned_to: "", stage: "Lead", expected_close_date: "" });
        fetchDeals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditDeal = (deal: Deal) => {
    setEditingDeal(deal);
    setNewDeal({
      title: deal.title,
      value: String(deal.value ?? ""),
      client_id: String(deal.client_id),
      assigned_to: String(deal.assigned_to || ""),
      stage: deal.stage,
      expected_close_date: deal.expected_close_date || "",
    });
    setShowAddModal(true);
  };

  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = deals.filter(d => d.stage === stage);
    return acc;
  }, {} as Record<string, Deal[]>);

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  if (loading) return <div className="p-8 text-center">{t("pipeline.loading_pipeline")}</div>;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-zinc-950">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <AdminTopbar />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Kanban className="w-6 h-6 text-indigo-600" />
                {t("pipeline.sales_pipeline")}
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{t("pipeline.manage_track_deals")}</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("pipeline.total_pipeline")}</span>
                <span className="text-lg font-bold text-slate-800 dark:text-zinc-100">${totalValue.toLocaleString()}</span>
              </div>
              <button 
                onClick={() => { setEditingDeal(null); setNewDeal({ title: "", value: "", client_id: "", assigned_to: "", stage: "Lead", expected_close_date: "" }); setShowAddModal(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-sm transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {t("pipeline.add_deal")}
              </button>
            </div>
          </div>

          {error && <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-xl">{error}</div>}

          {role === "Admin" && salesPerformance.length > 0 && <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-zinc-800"><tr><th className="px-4 py-3">Salesperson</th><th className="px-4 py-3">Deals</th><th className="px-4 py-3">Pipeline</th><th className="px-4 py-3">Won Revenue</th><th className="px-4 py-3">Lead</th><th className="px-4 py-3">Negotiation</th><th className="px-4 py-3">Won</th></tr></thead><tbody>{salesPerformance.map(item => <tr key={item.assigned_to || "unassigned"} className="border-t border-slate-100 dark:border-zinc-800"><td className="px-4 py-3 font-bold dark:text-white">{item.salesperson}</td><td className="px-4 py-3">{item.deals}</td><td className="px-4 py-3">${Number(item.pipeline_value).toLocaleString()}</td><td className="px-4 py-3 font-bold text-emerald-600">${Number(item.won_revenue).toLocaleString()}</td><td className="px-4 py-3">{item.stages.Lead || 0}</td><td className="px-4 py-3">{item.stages.Negotiation || 0}</td><td className="px-4 py-3">{item.stages["Closed Won"] || 0}</td></tr>)}</tbody></table></div>}

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 pb-6">
            {STAGES.map(stage => (
              <div 
                key={stage}
                className="min-w-0 min-h-[360px] bg-slate-100 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 flex flex-col"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div className="p-4 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between bg-slate-100 dark:bg-zinc-800/80 rounded-t-2xl">
                  <h3 className="font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-2">
                    {stage}
                    <span className="bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 text-xs py-0.5 px-2 rounded-full font-medium border border-slate-200 dark:border-zinc-700">
                      {dealsByStage[stage].length}
                    </span>
                  </h3>
                  <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                    ${dealsByStage[stage].reduce((sum, d) => sum + (d.value || 0), 0).toLocaleString()}
                  </span>
                </div>
                
                <div className="p-3 flex-1 overflow-y-auto space-y-3 max-h-[calc(100vh-270px)]">
                  {dealsByStage[stage].map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-slate-800 dark:text-zinc-100 line-clamp-1" title={deal.title}>{deal.title}</h4>
                        <button type="button" onClick={() => openEditDeal(deal)} title="Edit deal" className="text-slate-400 hover:text-indigo-600 dark:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" className="hidden text-slate-400 hover:text-slate-600 dark:text-zinc-300">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="text-sm text-slate-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {deal.client_name}
                      </div>
                      
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1 text-emerald-600 font-semibold text-sm">
                          <DollarSign className="w-4 h-4" />
                          {deal.value.toLocaleString()}
                        </div>
                        {deal.assigned_name && <p className="mt-2 text-[10px] font-bold text-indigo-500">Owner: {deal.assigned_name}</p>}
                        {deal.expected_close_date && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(deal.expected_close_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Add Deal Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{editingDeal ? "Edit Deal" : t("pipeline.create_new_deal")}</h2>
              </div>
              <form onSubmit={handleAddDeal} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">{t("pipeline.deal_title")}</label>
                  <input required type="text" value={newDeal.title} onChange={e => setNewDeal({...newDeal, title: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" placeholder="e.g. Website Redesign" />
                </div>
                {role !== "SalesManager" && <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">Assign Sales Owner</label>
                  <select required value={newDeal.assigned_to} onChange={e => setNewDeal({...newDeal, assigned_to: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none">
                    <option value="">Select salesperson</option>
                    {salesUsers.map(salesUser => <option key={salesUser.id} value={salesUser.id}>{salesUser.name || salesUser.email} · {salesUser.email}</option>)}
                  </select>
                </div>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">{t("pipeline.client")}</label>
                  <select required value={newDeal.client_id} onChange={e => setNewDeal({...newDeal, client_id: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none">
                    <option value="">{t("pipeline.select_client")}</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName || c.email}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">{t("pipeline.value_label")}</label>
                    <input type="number" step="0.01" value={newDeal.value} onChange={e => setNewDeal({...newDeal, value: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">{t("pipeline.close_date")}</label>
                    <input type="date" value={newDeal.expected_close_date} onChange={e => setNewDeal({...newDeal, expected_close_date: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">{t("pipeline.starting_stage")}</label>
                  <select value={newDeal.stage} onChange={e => setNewDeal({...newDeal, stage: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none">
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:bg-zinc-950 transition-colors">{t("pipeline.cancel")}</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm">{editingDeal ? "Save Changes" : t("pipeline.create_deal")}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
