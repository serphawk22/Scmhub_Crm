'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '@/config';
import PageGuide from '@/components/PageGuide';
import { useRole } from '@/context/RoleContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import {
  UserCheck,
  Plus,
  Search,
  Loader,
  Trash2,
  Mail,
  ShieldCheck,
  Smile,
} from 'lucide-react';

interface SalesUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function SalesTeamPage() {
  const { role } = useRole();
  const { t, language } = useLanguage();
  const [salesTeam, setSalesTeam] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (role !== 'Admin') return;
    fetchSalesTeam();
    fetchClients();
  }, [role]);

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients`);
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Failed to fetch clients', err);
    }
  };

  const fetchSalesTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      const data = await res.json();
      setSalesTeam(data.employees || []);
    } catch (err) {
      console.error('Sales team load failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role: 'SalesManager',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Unable to create salesperson.');
        return;
      }

      setToast(t('common.save') + '!');
      setName('');
      setEmail('');
      setPassword('');
      setShowCreate(false);
      fetchSalesTeam();
    } catch (err) {
      console.error(err);
      setError('Unable to reach the CRM backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Remove this salesperson from the Sales Team?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setToast('Salesperson removed.');
        fetchSalesTeam();
      }
    } catch (err) {
      console.error(err);
      setError('Unable to remove salesperson.');
    }
  };

  const handleAssignClient = async (userId: number, clientId: string) => {
    if (!clientId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/assign-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: userId }),
      });
      if (res.ok) {
        setToast('Client successfully assigned to Sales Manager!');
        fetchClients(); // refresh to get updated assignment
      } else {
        setError('Failed to assign client.');
      }
    } catch (err) {
      console.error(err);
      setError('Unable to assign client.');
    }
  };

  if (role !== 'Admin') {
    return <div className="p-20 text-center text-red-500 font-bold">{language === 'es' ? 'Acceso no autorizado.' : 'Unauthorized access.'}</div>;
  }

  const visibleSales = salesTeam.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) || item.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-3xl bg-teal-50 text-teal-700 p-3 border border-teal-100">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-50">{t("sales_team.title")}</h1>
              <p className="text-slate-500 dark:text-zinc-400 mt-1">{t("sales_team.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-glow-teal inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold"
          >
            <Plus className="w-4 h-4" /> {t("sales_team.add_salesperson")}
          </button>
        </div>
      </div>

      <PageGuide
        pageKey="admin-sales-team"
        title={language === 'es' ? 'Configuración del Equipo de Ventas' : 'Sales Team setup'}
        description={language === 'es' ? 'Cree credenciales de cuenta para cada vendedor, revise los gerentes de ventas activos y asegúrese del flujo de inicio de sesión basado en correo electrónico correcto para su personal de ventas.' : 'Create account credentials for each salesperson, review active sales managers, and ensure the correct email-based login flow for your sales staff.'}
        steps={[
          { icon: '👥', text: language === 'es' ? 'Agregue un vendedor con su nombre, correo electrónico y contraseña.' : 'Add a salesperson with their name, email, and password.' },
          { icon: '🔐', text: language === 'es' ? 'Cada gerente de ventas inicia sesión a través del formulario de inicio de sesión estándar utilizando su correo electrónico.' : 'Each sales manager logs in via the standard login form using their email.' },
          { icon: '📊', text: language === 'es' ? 'Los gerentes de ventas acceden a los flujos de trabajo de cuentas asignadas desde /sales-manager una vez autenticados.' : 'Sales managers access assigned account workflows from /sales-manager once authenticated.' },
          { icon: '🧩', text: language === 'es' ? 'Utilice la página de detalles de clientes para asignar clientes a los gerentes de ventas.' : 'Use the clients detail page to assign clients to sales managers.' },
        ]}
      />

      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-zinc-400">{t("sales_team.active_managers")}</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-50">{salesTeam.length}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-3xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("sales_team.login_path")}</p>
              <p className="font-semibold text-slate-800 dark:text-zinc-100">/sales-manager</p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("sales_team.user_role")}</p>
              <p className="font-semibold text-slate-800 dark:text-zinc-100">SalesManager</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              placeholder={t("sales_team.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-11 py-3 text-sm text-slate-700 dark:text-zinc-200 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">
            {t("sales_team.tip_login")}
          </div>
        </div>
      </div>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="glass-card rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> {toast}
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card p-6 md:p-8">
          <div className="space-y-4">
            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
                <Loader className="w-7 h-7 animate-spin" />
                <p className="font-bold">{t("sales_team.loading")}</p>
              </div>
            ) : visibleSales.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 p-10 text-center text-slate-600 dark:text-zinc-300">
                <Smile className="mx-auto mb-4 h-10 w-10 text-teal-500" />
                <p className="text-lg font-bold text-slate-900 dark:text-zinc-50">{t("sales_team.no_salespeople")}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">{t("sales_team.create_first")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSales.map((user) => (
                  <div key={user.id} className="group flex flex-col gap-4 rounded-3xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/90 p-5 shadow-sm transition hover:-translate-y-0.5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Gerente de Ventas' : 'Sales Manager'}</p>
                        <h3 className="text-xl font-black text-slate-900 dark:text-zinc-50">{user.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">{user.email}</p>
                        
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t("sales_team.assigned_clients")}</p>
                          <div className="flex flex-wrap gap-2">
                            {clients.filter(c => c.assignedEmployeeId === user.id).length === 0 ? (
                              <span className="text-sm text-slate-400 italic">{t("sales_team.no_clients_assigned")}</span>
                            ) : (
                              clients.filter(c => c.assignedEmployeeId === user.id).map(c => (
                                <span key={c.id} className="inline-flex items-center rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-100">
                                  {c.companyName || c.name || (language === 'es' ? `Cliente #${c.id}` : `Client #${c.id}`)}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 min-w-[200px]">
                        <select 
                          className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                          onChange={(e) => handleAssignClient(user.id, e.target.value)}
                          defaultValue=""
                        >
                          <option value="" disabled>{t("sales_team.assign_client")}</option>
                          {clients.filter(c => c.assignedEmployeeId !== user.id).map(c => (
                            <option key={c.id} value={c.id}>{c.companyName || c.name || (language === 'es' ? `Cliente #${c.id}` : `Client #${c.id}`)}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" /> {t("sales_team.remove")}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="rounded-3xl bg-slate-900 p-3 text-white">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-zinc-400">{t("sales_team.onboarding")}</p>
              <h2 className="text-xl font-black text-slate-900 dark:text-zinc-50">{t("sales_team.create_accounts")}</h2>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-zinc-400">{t("sales_team.onboarding_desc")}</p>

            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              <Plus className="w-4 h-4" /> {t("sales_team.add_salesperson")}
            </button>

            <div className="rounded-3xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 p-4 text-sm text-slate-600 dark:text-zinc-300">
              {t("sales_team.tip_assign")}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 md:p-8 mt-6">
        <div className="mb-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-zinc-50">{t("sales_team.assignment_matrix")}</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{t("sales_team.matrix_desc")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold rounded-tl-xl">{t("sales_team.client_company")}</th>
                <th className="px-4 py-3 font-semibold">{t("sales_team.project_name")}</th>
                <th className="px-4 py-3 font-semibold">{t("sales_team.status")}</th>
                <th className="px-4 py-3 font-semibold rounded-tr-xl">{t("sales_team.assigned_manager")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">{t("sales_team.no_clients")}</td>
                </tr>
              ) : (
                clients.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50 dark:bg-zinc-950/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-zinc-50">{client.companyName || client.name || (language === 'es' ? `Cliente #${client.id}` : `Client #${client.id}`)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{client.projectName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                        {client.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select 
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 max-w-[250px]"
                        value={client.assignedEmployeeId || ""}
                        onChange={(e) => handleAssignClient(Number(e.target.value), client.id)}
                      >
                        <option value="" disabled>{t("sales_team.unassigned")}</option>
                        {salesTeam.map(sm => (
                          <option key={sm.id} value={sm.id}>{sm.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl rounded-[2rem] border border-slate-800 bg-slate-950/95 p-8 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-teal-300">{language === 'es' ? 'Nuevo Vendedor' : 'New Salesperson'}</p>
                  <h3 className="text-2xl font-black">{language === 'es' ? 'Agregar Gerente de Ventas' : 'Add Sales Manager'}</h3>
                </div>
                <button onClick={() => setShowCreate(false)} className="rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <label className="block text-sm font-semibold text-slate-200">{language === 'es' ? 'Nombre Completo' : 'Full Name'}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="Jane Doe"
                  required
                />

                <label className="block text-sm font-semibold text-slate-200">{language === 'es' ? 'Correo Electrónico' : 'Email Address'}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="jane@company.com"
                  required
                />

                <label className="block text-sm font-semibold text-slate-200">{language === 'es' ? 'Contraseña' : 'Password'}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/20"
                  placeholder={language === 'es' ? 'Contraseña fuerte' : 'Strong password'}
                  required
                />

                {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-teal-400 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> {language === 'es' ? 'Crear Vendedor' : 'Create Salesperson'}</>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
