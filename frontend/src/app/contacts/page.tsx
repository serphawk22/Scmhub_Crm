"use client";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Filter, Users as UsersIcon, Mail, Phone, Globe, Linkedin, Twitter, MoreVertical, Tag, ChevronDown, ChevronRight, CornerDownRight, Trash, Edit, AlertCircle } from "lucide-react";

const ContactRow = ({ contact, depth = 0, onAddSubContact, onEdit, onDelete, onAddNote }: any) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);

  const isSearchResult = !!contact.hierarchy_path;

  const toggleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (children.length === 0 && contact.children_count > 0 && !isSearchResult) {
      setLoadingChildren(true);
      try {
        const res = await fetch(`${API_BASE_URL}/contacts/${contact.id}/children`);
        if (res.ok) {
          const data = await res.json();
          setChildren(data.children || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingChildren(false);
      }
    }
  };

  return (
    <>
      <tr className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/50">
        <td className="px-6 py-4">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
            {!isSearchResult && contact.children_count > 0 ? (
              <button onClick={toggleExpand} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6" />
            )}
            {depth > 0 && <CornerDownRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                {contact.full_name || t("contacts.unknown")}
                {contact.children_count > 0 && !isSearchResult && (
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md text-slate-500">
                    {contact.children_count} {t("contacts.sub_contacts")}
                  </span>
                )}
              </span>
              <span className="text-[13px] text-slate-500 mt-0.5">{contact.designation || t("contacts.no_title")}</span>
              {isSearchResult && contact.hierarchy_path && (
                <span className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                   {contact.hierarchy_path}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col gap-1">
            {contact.email && (
              <div className="flex items-center gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{contact.email}</span>
              </div>
            )}
            {contact.mobile_number && (
              <div className="flex items-center gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{contact.mobile_number}</span>
              </div>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex gap-2">
            {contact.linkedin_url && (
              <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                <Linkedin className="w-4 h-4" />
              </a>
            )}
            {contact.twitter_url && (
              <a href={contact.twitter_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600">
                <Twitter className="w-4 h-4" />
              </a>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onAddSubContact(contact)} title={t("contacts.add_sub_contact")} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => onEdit(contact)} title={t("contacts.edit")} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(contact)} title={t("contacts.delete")} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 transition-colors">
              <Trash className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && !isSearchResult && children.map(child => (
        <ContactRow 
          key={child.id} 
          contact={child} 
          depth={depth + 1} 
          onAddSubContact={onAddSubContact}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddNote={onAddNote}
        />
      ))}
      {expanded && loadingChildren && (
        <tr>
           <td colSpan={4} className="px-6 py-2 text-left text-xs text-slate-400" style={{ paddingLeft: `${(depth+1) * 24 + 32}px` }}>{t("contacts.loading")}</td>
        </tr>
      )}
    </>
  );
};

export default function ContactsPage() {
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<any[]>([]);
  const [allFlatContacts, setAllFlatContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any>(null);
  
  const [leads, setLeads] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const emptyForm = {
    id: null,
    first_name: "", last_name: "", email: "", mobile_number: "", designation: "", department: "", linkedin_url: "", twitter_url: "",
    assignment_type: "none",
    client_id: "", lead_id: "", parent_contact_id: null
  };
  const [form, setForm] = useState<any>(emptyForm);

  useEffect(() => {
    fetchContacts();
    fetchAllContactsFlat();
    fetch(`${API_BASE_URL}/leads`).then(r => r.json()).then(data => setLeads(data.leads || []));
    fetch(`${API_BASE_URL}/clients`).then(r => r.json()).then(data => setClients(data.clients || []));
  }, []);

  const fetchContacts = async (query = "") => {
    setLoading(true);
    try {
      const q = query ? `?search=${encodeURIComponent(query)}` : "";
      const res = await fetch(`${API_BASE_URL}/contacts${q}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : data.contacts || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllContactsFlat = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/contacts?search=`);
      if (res.ok) {
        const data = await res.json();
        setAllFlatContacts(Array.isArray(data) ? data : data.contacts || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchContacts(searchQuery);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleAddNote = async (contact: any) => {
    const note = prompt(t("contacts.enter_note"));
    if (note) {
      const newNotes = contact.notes ? contact.notes + "\n" + note : note;
      try {
        await fetch(`${API_BASE_URL}/contacts/${contact.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: newNotes })
        });
        fetchContacts(searchQuery);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddSubContact = (parentContact: any) => {
    setForm({ ...emptyForm, parent_contact_id: parentContact.id });
    setShowModal(true);
  };

  const handleEdit = (contact: any) => {
    setForm({
      id: contact.id,
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      email: contact.email || "",
      mobile_number: contact.mobile_number || "",
      designation: contact.designation || "",
      department: contact.department || "",
      linkedin_url: contact.linkedin_url || "",
      twitter_url: contact.twitter_url || "",
      assignment_type: contact.client_id ? "client" : contact.lead_id ? "lead" : "none",
      client_id: contact.client_id || "",
      lead_id: contact.lead_id || "",
      parent_contact_id: contact.parent_contact_id || null
    });
    setShowModal(true);
  };

  const handleDeletePrompt = (contact: any) => {
    setContactToDelete(contact);
    setShowDeleteModal(true);
  };

  const executeDelete = async (action: 'cascade' | 'move_to_parent') => {
    if (!contactToDelete) return;
    try {
      await fetch(`${API_BASE_URL}/contacts/${contactToDelete.id}?action=${action}`, {
        method: "DELETE"
      });
      setShowDeleteModal(false);
      setContactToDelete(null);
      fetchContacts(searchQuery);
      fetchAllContactsFlat();
    } catch (e) {
      console.error(e);
      alert(t("contacts.error_deleting"));
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-black rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t("contacts.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("contacts.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={t("contacts.search_placeholder")} 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors">
            <Plus className="w-4 h-4" />
            {t("contacts.add_contact")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white dark:bg-black">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
              <UsersIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("contacts.no_contacts_found")}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              {t("contacts.no_contacts_matching")}
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="px-6 py-4 font-medium">{t("contacts.name_title")}</th>
                <th className="px-6 py-4 font-medium">{t("contacts.contact_details")}</th>
                <th className="px-6 py-4 font-medium">{t("contacts.social")}</th>
                <th className="px-6 py-4 font-medium text-right">{t("contacts.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact, idx) => (
                <ContactRow 
                  key={contact.id} 
                  contact={contact} 
                  onAddSubContact={handleAddSubContact}
                  onEdit={handleEdit}
                  onDelete={handleDeletePrompt}
                  onAddNote={handleAddNote}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && contactToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <AlertCircle className="w-6 h-6" />
                <h2 className="text-xl font-bold">{t("contacts.delete_contact")}</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                {t("contacts.delete_confirm_1")} <strong>{contactToDelete.full_name}</strong>{t("contacts.delete_confirm_2")}
                {contactToDelete.children_count > 0 && (
                  <span className="block mt-2 text-amber-600 dark:text-amber-500">
                    {t("contacts.has_sub_contacts")} {contactToDelete.children_count} {t("contacts.sub_contacts_suffix")}
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-3">
                {contactToDelete.children_count > 0 && (
                  <button onClick={() => executeDelete('move_to_parent')} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm">
                    {t("contacts.delete_and_move")}
                  </button>
                )}
                <button onClick={() => executeDelete('cascade')} className="w-full px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm">
                  {contactToDelete.children_count > 0 ? t("contacts.delete_contact_and_all") : t("contacts.delete_contact")}
                </button>
                <button onClick={() => setShowDeleteModal(false)} className="w-full px-4 py-2.5 rounded-xl font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm">
                  {t("contacts.cancel")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Contact Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-black z-10">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {form.id ? t("contacts.edit_contact") : t("contacts.add_new_contact")}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><UsersIcon className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4">
                
                {/* Parent Contact Dropdown for Hierarchy */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.parent_contact")}</label>
                  <select 
                    value={form.parent_contact_id || ""} 
                    onChange={e => setForm({...form, parent_contact_id: e.target.value ? parseInt(e.target.value) : null})} 
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  >
                    <option value="">{t("contacts.none_root")}</option>
                    {allFlatContacts.map(c => {
                      if (c.id === form.id) return null;
                      return (
                        <option key={c.id} value={c.id}>{c.full_name} {c.hierarchy_path ? `(${c.hierarchy_path})` : ''}</option>
                      )
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.first_name")}</label>
                    <input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.last_name")}</label>
                    <input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.email")}</label>
                    <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.mobile_number")}</label>
                    <input value={form.mobile_number} onChange={e => setForm({...form, mobile_number: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.designation")}</label>
                    <input value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} placeholder="e.g. CEO" className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.department")}</label>
                    <input value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="e.g. Sales" className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 block">{t("contacts.assignment_options")}</label>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <label className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer text-slate-900 dark:text-white">
                      <input type="radio" name="assignment" checked={form.assignment_type === 'none'} onChange={() => setForm({...form, assignment_type: 'none'})} /> {t("contacts.standalone")}
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer text-slate-900 dark:text-white">
                      <input type="radio" name="assignment" checked={form.assignment_type === 'create_lead'} onChange={() => setForm({...form, assignment_type: 'create_lead'})} /> {t("contacts.create_new_lead")}
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer text-slate-900 dark:text-white">
                      <input type="radio" name="assignment" checked={form.assignment_type === 'lead'} onChange={() => setForm({...form, assignment_type: 'lead'})} /> {t("contacts.assign_to_lead")}
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer text-slate-900 dark:text-white">
                      <input type="radio" name="assignment" checked={form.assignment_type === 'client'} onChange={() => setForm({...form, assignment_type: 'client'})} /> {t("contacts.assign_to_client")}
                    </label>
                  </div>

                  {form.assignment_type === 'lead' && (
                    <select value={form.lead_id} onChange={e => setForm({...form, lead_id: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white">
                      <option value="">{t("contacts.select_lead")}</option>
                      {leads.map(l => <option key={l.id} value={l.id}>{l.company_name}</option>)}
                    </select>
                  )}
                  {form.assignment_type === 'client' && (
                    <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white">
                      <option value="">{t("contacts.select_client")}</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.projectName || c.email}</option>)}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.linkedin_url")}</label>
                    <input type="text" value={form.linkedin_url || ""} onChange={e => setForm({...form, linkedin_url: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("contacts.twitter_url")}</label>
                    <input type="text" value={form.twitter_url || ""} onChange={e => setForm({...form, twitter_url: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
                  </div>
                </div>

              </div>
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl sticky bottom-0">
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800">{t("contacts.cancel")}</button>
                <button onClick={async () => {
                  if (!form.first_name.trim()) return;
                  setSaving(true);
                  const payload: any = {
                    first_name: form.first_name,
                    last_name: form.last_name,
                    email: form.email,
                    mobile_number: form.mobile_number,
                    department: form.department,
                    linkedin_url: form.linkedin_url,
                    twitter_url: form.twitter_url,
                    parent_contact_id: form.parent_contact_id
                  };
                  if (form.assignment_type === 'create_lead') payload.create_new_lead = true;
                  if (form.assignment_type === 'lead' && form.lead_id) payload.lead_id = parseInt(form.lead_id);
                  if (form.assignment_type === 'client' && form.client_id) payload.client_id = parseInt(form.client_id);
                  
                  try {
                    const method = form.id ? "PUT" : "POST";
                    const url = form.id ? `${API_BASE_URL}/contacts/${form.id}` : `${API_BASE_URL}/contacts`;
                    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                    if (!res.ok) {
                      const err = await res.json();
                      alert(err.detail || t("contacts.error_saving"));
                      setSaving(false);
                      return;
                    }
                    setShowModal(false);
                    setForm(emptyForm);
                    fetchContacts(searchQuery);
                    fetchAllContactsFlat();
                  } catch (e) { console.error(e); } finally { setSaving(false); }
                }} disabled={saving || !form.first_name} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
                  {saving ? t("contacts.saving") : t("contacts.save_contact")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
