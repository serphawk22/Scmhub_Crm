"use client";

import React, { useState, useEffect } from "react";
import { Users, Plus, Star, UserPlus } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

export default function LinkedContacts({ leadId, clientId }: { leadId?: string, clientId?: string }) {
  const { language } = useLanguage();
  const [links, setLinks] = useState<any[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedContactId, setSelectedContactId] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    fetchLinks();
    fetchContacts();
  }, [leadId, clientId]);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const endpoint = leadId ? `/leads/${leadId}/contacts` : `/clients/${clientId}/contacts`;
      const res = await fetch(`${API_BASE_URL}${endpoint}`);
      if (res.ok) {
        const data = await res.json();
        setLinks(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/contacts`);
      if (res.ok) {
        const data = await res.json();
        setAllContacts(Array.isArray(data) ? data : data.contacts || []);
      }
    } catch (e) {}
  };

  const handleLink = async () => {
    if (!selectedContactId) return;
    try {
      const endpoint = leadId ? `/leads/${leadId}/contacts` : `/clients/${clientId}/contacts`;
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: Number(selectedContactId),
          role_at_company: roleInput,
          is_primary: isPrimary
        })
      });
      if (res.ok) {
        setShowAdd(false);
        setSelectedContactId("");
        setRoleInput("");
        setIsPrimary(false);
        fetchLinks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm mt-4">
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Users size={14} />
          {language === 'es' ? 'Contactos Asociados' : 'Linked Contacts'}
        </p>
        <button onClick={() => setShowAdd(!showAdd)} className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-1 rounded-md">
          <Plus size={16} />
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <select 
            value={selectedContactId} 
            onChange={e => setSelectedContactId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          >
            <option value="">{language === 'es' ? 'Seleccionar contacto...' : 'Select contact...'}</option>
            {allContacts.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''}</option>
            ))}
          </select>
          <input 
            type="text" 
            placeholder={language === 'es' ? 'Rol en la empresa' : 'Role at company'}
            value={roleInput}
            onChange={e => setRoleInput(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
            <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
            {language === 'es' ? 'Contacto principal' : 'Primary contact'}
          </label>
          <button onClick={handleLink} className="w-full py-2 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700">
            {language === 'es' ? 'Vincular' : 'Link Contact'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-2">Loading...</p>
      ) : links.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 px-4">
          <UserPlus size={28} className="text-slate-300 dark:text-zinc-600 mb-2" />
          <p className="text-sm font-semibold text-slate-600 dark:text-zinc-200">{language === 'es' ? 'Aún no hay contactos añadidos' : 'No contacts added yet'}</p>
          <p className="text-xs text-slate-400 dark:text-zinc-400 mt-1">{language === 'es' ? 'Asocia un contacto existente a este cliente.' : 'Link a contact to this client to keep everyone in the loop.'}</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors">
            <Plus size={14} /> {language === 'es' ? 'Añadir Contacto' : 'Add Contact'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => (
            <div key={link.link_id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shrink-0 font-bold">
                {link.contact.first_name[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                  {link.contact.first_name} {link.contact.last_name}
                  {link.is_primary && <Star size={12} className="fill-amber-400 text-amber-400" />}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                  {link.role || link.contact.job_title || 'No role specified'}
                </p>
                {link.contact.email && <p className="text-xs text-indigo-600 dark:text-indigo-400">{link.contact.email}</p>}
                {link.contact.phone && <p className="text-xs text-slate-600 dark:text-zinc-400">{link.contact.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
