'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ticket, CheckCircle, Clock, Plus, Send, X, AlertCircle, XCircle
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import { useLanguage } from '@/context/LanguageContext';

interface TicketsTabProps {
  clientId: string | string[];
}

export default function TicketsTab({ clientId }: TicketsTabProps) {
  const { language } = useLanguage();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRaising, setIsRaising] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '' });
  const { role, user } = useRole();

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/tickets`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [clientId]);

  const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.title.trim()) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newTicket.title, 
          description: newTicket.description,
          author_id: user?.id 
        })
      });
      if (res.ok) {
        setNewTicket({ title: '', description: '' });
        setIsRaising(false);
        fetchTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (ticketId: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 dark:text-zinc-400 animate-pulse">{language === 'es' ? 'Cargando tickets...' : 'Loading tickets...'}</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 dark:text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-indigo-500" /> {language === 'es' ? 'Solicitudes de Acción' : 'Action Requests'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{language === 'es' ? 'Crear tickets de soporte o acción para el Administrador' : 'Raise support or action tickets to Admin'}</p>
        </div>
        <button
          onClick={() => setIsRaising(!isRaising)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          {isRaising ? <X size={16} /> : <Plus size={16} />} {isRaising ? (language === 'es' ? 'Cancelar' : 'Cancel') : (language === 'es' ? 'Crear Ticket' : 'Raise Ticket')}
        </button>
      </div>

      <AnimatePresence>
        {isRaising && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleRaiseTicket} className="p-5 bg-white dark:bg-zinc-900 dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 rounded-2xl shadow-sm mb-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{language === 'es' ? 'Título del Problema / Acción' : 'Issue / Action Title'}</label>
                  <input
                    required
                    value={newTicket.title}
                    onChange={e => setNewTicket(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-slate-50 dark:bg-zinc-950 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    placeholder={language === 'es' ? 'ej. Necesita revisión de facturación de inmediato' : 'e.g., Needs immediate billing review'}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{language === 'es' ? 'Detalles (Opcional)' : 'Details (Optional)'}</label>
                  <textarea
                    rows={3}
                    value={newTicket.description}
                    onChange={e => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-slate-50 dark:bg-zinc-950 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none"
                    placeholder={language === 'es' ? 'Proporcionar contexto para el administrador...' : 'Provide context for the admin...'}
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all">
                    <Send size={16} /> {language === 'es' ? 'Enviar Ticket' : 'Submit Ticket'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="p-12 border-2 border-dashed border-slate-200 dark:border-zinc-700 dark:border-slate-800 rounded-3xl text-center text-slate-500 dark:text-zinc-400">
            <Ticket className="w-12 h-12 text-slate-300 dark:text-slate-700 dark:text-zinc-200 mx-auto mb-4" />
            <p className="font-bold">{language === 'es' ? 'No hay tickets activos.' : 'No active tickets.'}</p>
            <p className="text-sm">{language === 'es' ? 'Todo está funcionando sin problemas.' : 'Everything is running smoothly.'}</p>
          </div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.id} className="p-5 bg-white dark:bg-zinc-900 dark:bg-slate-900 border border-slate-200 dark:border-zinc-700 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  {ticket.status === 'Done' ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"><CheckCircle size={12} /> {language === 'es' ? 'Completado' : 'Done'}</span>
                  ) : ticket.status === 'Not Done' ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold"><XCircle size={12} /> {language === 'es' ? 'No Completado' : 'Not Done'}</span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold"><Clock size={12} /> {language === 'es' ? 'Pendiente' : 'Pending'}</span>
                  )}
                  <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-white text-lg">{ticket.title}</h3>
                </div>
                {ticket.description && <p className="text-sm text-slate-500 dark:text-zinc-400 dark:text-slate-400 mt-2">{ticket.description}</p>}
                <p className="text-[11px] text-slate-400 mt-3 font-medium uppercase tracking-wider">
                  {new Date(ticket.created_at).toLocaleString(language === 'es' ? 'es-ES' : 'en-US')}
                </p>
              </div>

              {/* Admin Toggle Actions */}
              {role === 'Admin' && (
                <div className="flex items-center gap-2 mt-4 md:mt-0 shrink-0 bg-slate-50 dark:bg-zinc-950 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700">
                  <button
                    onClick={() => handleUpdateStatus(ticket.id, 'Done')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${ticket.status === 'Done' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-slate-700'}`}
                  >
                    <CheckCircle size={14} /> {language === 'es' ? 'Marcar Completado' : 'Mark Done'}
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(ticket.id, 'Not Done')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${ticket.status === 'Not Done' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-slate-700'}`}
                  >
                    <XCircle size={14} /> {language === 'es' ? 'Marcar No Completado' : 'Flag Not Done'}
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(ticket.id, 'Pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${ticket.status === 'Pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-slate-700'}`}
                  >
                    <Clock size={14} /> {language === 'es' ? 'Pendiente' : 'Pending'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
