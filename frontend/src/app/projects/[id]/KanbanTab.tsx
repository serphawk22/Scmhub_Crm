import { useState, useEffect, useMemo } from "react";
import { Plus, X, AlignLeft, Calendar, User, GitBranch, Link as LinkIcon, History, Clock, FileText, ArrowDownAZ, ArrowRight, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

type ProjectTicket = {
  id?: number;
  competitor?: string;
  category?: string;
  task: string;
  github_link?: string;
  production_url?: string;
  current_state: string;
  requested_date?: string;
  requested_by?: string;
  current_owner_role?: string;
  current_owner?: string;
  date_dev_start?: string;
  date_dev_complete?: string;
  date_qa_start?: string;
  date_qa_complete?: string;
  date_release_prod?: string;
};

const KANBAN_COLUMNS = ["Planning", "In Dev", "Given to QA", "Prod Release"];

function computeDays(start?: string, end?: string) {
  if (!start) return 0;
  const d1 = new Date(start).getTime();
  const d2 = end ? new Date(end).getTime() : new Date().getTime();
  return Math.max(0, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
}

export default function KanbanTab({ projectId }: { projectId: string }) {
  const { user } = useRole();
  const [tickets, setTickets] = useState<ProjectTicket[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [ticketNotes, setTicketNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState<'details'|'history'|'notes'>('details');
  const [selectedTicket, setSelectedTicket] = useState<ProjectTicket | null>(null);
  const [sortOption, setSortOption] = useState<'newest'|'oldest'|'fastest'|'longest'>('newest');
  const [teamMembers, setTeamMembers] = useState<{id: number; name: string; email: string}[]>([]);
  
  const [revertPrompt, setRevertPrompt] = useState<{isOpen: boolean; ticketId?: number; task?: string; newStatus?: string; reason: string}>({isOpen: false, reason: ""});

  // Form state
  const [form, setForm] = useState<ProjectTicket>({
    task: "",
    current_state: "Planning",
    competitor: "",
    category: "",
    github_link: "",
    production_url: "",
    requested_date: "",
    requested_by: "",
    current_owner_role: "",
    current_owner: "",
    date_dev_start: "",
    date_dev_complete: "",
    date_qa_start: "",
    date_qa_complete: "",
    date_release_prod: "",
  });

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/tickets`);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTickets();
    // Fetch project team members for the assignee dropdown
    fetch(`${API_BASE_URL}/projects/${projectId}`)
      .then(r => r.json())
      .then(d => {
        const team = d.team || {};
        const all = [
          ...(team.employees || []),
          ...(team.interns || []),
          ...(team.projectMembers || []),
        ];
        setTeamMembers(all);
      })
      .catch(() => {});
  }, [projectId]);

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => {
      if (sortOption === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      if (sortOption === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      
      const ageA = computeDays(a.requested_date, a.date_release_prod);
      const ageB = computeDays(b.requested_date, b.date_release_prod);
      if (sortOption === 'fastest') return ageA - ageB;
      if (sortOption === 'longest') return ageB - ageA;
      return 0;
    });
  }, [tickets, sortOption]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return; // Same column

    const ticketId = Number(draggableId);
    const newStatus = destination.droppableId;
    
    // Find the ticket to send its required 'task' field
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Intercept QA reverting to Dev
    if (ticket.current_state === 'Given to QA' && newStatus === 'In Dev') {
      setRevertPrompt({ isOpen: true, ticketId, task: ticket.task, newStatus, reason: "" });
      return; // Stop optimistic update, wait for prompt
    }

    executeStatusUpdate(ticketId, newStatus, ticket);
  };

  const executeStatusUpdate = async (ticketId: number, newStatus: string, ticket: any, noteStr?: string) => {
    // Optimistic UI update
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, current_state: newStatus } : t));

    try {
      const res = await fetch(`${API_BASE_URL}/projects/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ticket, current_state: newStatus, user_name: user?.name, note: noteStr })
      });
      if (!res.ok) throw new Error("Failed to update status");
      const data = await res.json();
      if (data.ticket) {
        if (noteStr) {
          await fetch(`${API_BASE_URL}/projects/tickets/${ticketId}/notes`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_name: user?.name || "QA", note: noteStr })
          });
        }
        setTickets(prev => prev.map(t => t.id === ticketId ? data.ticket : t));
      }
    } catch (e) {
      console.error("Failed to update status", e);
      fetchTickets(); // Revert on failure
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = selectedTicket?.id 
      ? `${API_BASE_URL}/projects/tickets/${selectedTicket.id}`
      : `${API_BASE_URL}/projects/${projectId}/tickets`;
    const method = selectedTicket?.id ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, user_name: user?.name })
    });
    
    setShowModal(false);
    setSelectedTicket(null);
    setForm({ task: "", current_state: "Planning" });
    fetchTickets();
  };

  const fetchHistory = async (ticketId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/tickets/${ticketId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.history || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotes = async (ticketId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/tickets/${ticketId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setTicketNotes(data.notes || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openTicket = (t: ProjectTicket) => {
    setSelectedTicket(t);
    setForm(t);
    setActiveTab('details');
    setHistoryLogs([]);
    setTicketNotes([]);
    if (t.id) {
      fetchHistory(t.id);
      fetchNotes(t.id);
    }
    setShowModal(true);
  };

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket?.id || !newNote.trim()) return;
    await fetch(`${API_BASE_URL}/projects/tickets/${selectedTicket.id}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_name: user?.name || "Member", note: newNote })
    });
    setNewNote("");
    fetchNotes(selectedTicket.id);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-black text-slate-900 dark:text-zinc-50 tracking-tight">Project Board</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 shadow-sm">
            <ArrowDownAZ size={16} className="text-slate-400" />
            <select className="bg-transparent text-sm font-bold text-slate-700 dark:text-zinc-300 outline-none" value={sortOption} onChange={(e) => setSortOption(e.target.value as any)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="fastest">Fastest (Age)</option>
              <option value="longest">Longest (Age)</option>
            </select>
          </div>
          <button 
            onClick={() => {
              setSelectedTicket(null);
              setForm({ task: "", current_state: "Planning" });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> New Ticket
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 items-stretch overflow-x-auto pb-4 snap-x">
          {KANBAN_COLUMNS.map(col => (
            <Droppable key={col} droppableId={col}>
              {(provided) => (
                <div 
                  ref={provided.innerRef} 
                  {...provided.droppableProps}
                  className="bg-slate-100 dark:bg-zinc-900/50 p-4 rounded-3xl min-h-[500px] min-w-[320px] w-[320px] shrink-0 snap-start flex flex-col"
                >
                  <h4 className="text-sm font-black text-slate-500 dark:text-zinc-400 mb-4 px-2 uppercase tracking-widest flex items-center justify-between">
                    {col}
                    <span className="bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-full text-[10px]">
                      {sortedTickets.filter(t => t.current_state === col).length}
                    </span>
                  </h4>
                  
                  <div className="space-y-3 flex-1 h-full">
                    {sortedTickets.filter(t => t.current_state === col).map((ticket, index) => (
                      <Draggable key={ticket.id} draggableId={String(ticket.id)} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => openTicket(ticket)}
                            className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 cursor-pointer hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center justify-between mb-2">
                              {ticket.category && (
                                <span className="inline-block px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-md">
                                  {ticket.category}
                                </span>
                              )}
                              <div className="flex gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                                {KANBAN_COLUMNS.indexOf(ticket.current_state) > 0 && (
                                  <button 
                                    onClick={() => {
                                      const prevStatus = KANBAN_COLUMNS[KANBAN_COLUMNS.indexOf(ticket.current_state) - 1];
                                      if (ticket.current_state === 'Given to QA' && prevStatus === 'In Dev') {
                                        setRevertPrompt({ isOpen: true, ticketId: ticket.id, task: ticket.task, newStatus: prevStatus, reason: "" });
                                      } else {
                                        executeStatusUpdate(ticket.id!, prevStatus, ticket);
                                      }
                                    }}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                                    title="Move left"
                                  >
                                    <ArrowLeft size={14} />
                                  </button>
                                )}
                                {KANBAN_COLUMNS.indexOf(ticket.current_state) < KANBAN_COLUMNS.length - 1 && (
                                  <button 
                                    onClick={() => executeStatusUpdate(ticket.id!, KANBAN_COLUMNS[KANBAN_COLUMNS.indexOf(ticket.current_state) + 1], ticket)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                                    title="Move right"
                                  >
                                    <ArrowRight size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <h5 className="font-bold text-slate-900 dark:text-zinc-100 text-sm mb-2">{ticket.task}</h5>
                            
                            {ticket.competitor && (
                              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2 truncate">
                                Competitor: {ticket.competitor}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                              <span className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-500">
                                <User size={10} /> {ticket.current_owner || 'Unassigned'}
                              </span>
                              {ticket.requested_date && (
                                <span className="flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                                  Age: {computeDays(ticket.requested_date, ticket.date_release_prod)}d
                                </span>
                              )}
                              {ticket.date_dev_start && (
                                <span className="flex items-center gap-1 text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                  Dev: {computeDays(ticket.date_dev_start, ticket.date_dev_complete)}d
                                </span>
                              )}
                              {ticket.date_qa_start && (
                                <span className="flex items-center gap-1 text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                                  QA: {computeDays(ticket.date_qa_start, ticket.date_qa_complete)}d
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-zinc-800 p-6 flex items-center justify-between z-10">
              <h2 className="text-xl font-black text-slate-900 dark:text-zinc-50 tracking-tight">
                {selectedTicket ? "Edit Ticket" : "New Ticket"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            {selectedTicket && (
              <div className="px-8 pt-4 border-b border-gray-100 dark:border-zinc-800 flex gap-6">
                <button 
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900'}`}
                >
                  Details
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900'}`}
                >
                  History & Metrics
                </button>
              </div>
            )}
            
            <form onSubmit={handleSave} className="p-8">
              {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left Column */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Ticket Title (Task)</label>
                    <input required type="text" value={form.task} onChange={e => setForm({...form, task: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Category</label>
                      <input type="text" value={form.category || ''} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Competitor</label>
                      <input type="text" value={form.competitor || ''} onChange={e => setForm({...form, competitor: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">GitHub Link</label>
                      <input type="url" value={form.github_link || ''} onChange={e => setForm({...form, github_link: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Prod URL</label>
                      <input type="url" value={form.production_url || ''} onChange={e => setForm({...form, production_url: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Requested By</label>
                      <input type="text" value={form.requested_by || ''} onChange={e => setForm({...form, requested_by: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Requested Date</label>
                      <input type="date" value={form.requested_date || ''} onChange={e => setForm({...form, requested_date: e.target.value})} className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-5 bg-slate-50/50 dark:bg-zinc-900/30 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Assign To (Owner)</label>
                      {teamMembers.length > 0 ? (
                        <select
                          value={form.current_owner || ''}
                          onChange={e => setForm({...form, current_owner: e.target.value})}
                          className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">— Unassigned —</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.name}>{m.name} ({m.email})</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" value={form.current_owner || ''} onChange={e => setForm({...form, current_owner: e.target.value})} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="No team members yet — type name" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Owner Role</label>
                      <input type="text" value={form.current_owner_role || ''} onChange={e => setForm({...form, current_owner_role: e.target.value})} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Dev Start</label>
                      <input type="date" value={form.date_dev_start || ''} onChange={e => setForm({...form, date_dev_start: e.target.value})} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Dev Complete</label>
                      <input type="date" value={form.date_dev_complete || ''} onChange={e => setForm({...form, date_dev_complete: e.target.value})} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">QA Start</label>
                      <input type="date" value={form.date_qa_start || ''} onChange={e => setForm({...form, date_qa_start: e.target.value})} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">QA Complete</label>
                      <input type="date" value={form.date_qa_complete || ''} onChange={e => setForm({...form, date_qa_complete: e.target.value})} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Prod Release Date</label>
                    <input type="date" value={form.date_release_prod || ''} onChange={e => setForm({...form, date_release_prod: e.target.value})} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
              </div>
              )}
              
              {activeTab === 'history' && (
                <div className="space-y-6">
                  {form.date_dev_start && form.date_dev_complete && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl flex items-center gap-4">
                      <div className="p-3 bg-indigo-100 dark:bg-indigo-800/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <Clock size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Time Spent in Dev</h4>
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                          {Math.max(1, Math.ceil((new Date(form.date_dev_complete).getTime() - new Date(form.date_dev_start).getTime()) / (1000 * 60 * 60 * 24)))} Days
                        </p>
                      </div>
                    </div>
                  )}

                  {form.date_qa_start && form.date_qa_complete && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl flex items-center gap-4 mt-4">
                      <div className="p-3 bg-purple-100 dark:bg-purple-800/50 rounded-xl text-purple-600 dark:text-purple-400">
                        <Clock size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100">Time Spent in QA</h4>
                        <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                          {Math.max(1, Math.ceil((new Date(form.date_qa_complete).getTime() - new Date(form.date_qa_start).getTime()) / (1000 * 60 * 60 * 24)))} Days
                        </p>
                      </div>
                    </div>
                  )}

                  {form.requested_date && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl flex items-center gap-4 mt-4">
                      <div className="p-3 bg-emerald-100 dark:bg-emerald-800/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Task Age</h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                          {Math.max(1, Math.ceil((new Date().getTime() - new Date(form.requested_date).getTime()) / (1000 * 60 * 60 * 24)))} Days Since Request
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="relative pl-6 border-l-2 border-slate-100 dark:border-zinc-800 space-y-8 mt-6">
                    {historyLogs.map((log: any) => (
                      <div key={log.id} className="relative">
                        <div className="absolute -left-[33px] top-1 bg-white dark:bg-zinc-900 border-2 border-indigo-500 rounded-full p-1.5 shadow-sm">
                          <History size={12} className="text-indigo-500" />
                        </div>
                        <p className="text-sm text-slate-800 dark:text-zinc-200">
                          {log.old_state === 'Given to QA' && log.new_state === 'In Dev' ? (
                            <><span className="font-bold">{log.user_name || 'QA'}</span> <span className="text-red-500 font-bold">reverted back to Dev</span></>
                          ) : (
                            <><span className="font-bold">{log.user_name || 'Someone'}</span> moved this ticket from <span className="font-bold text-slate-500 dark:text-zinc-400">{log.old_state}</span> to <span className="font-bold text-slate-900 dark:text-white">{log.new_state}</span></>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(log.moved_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    {historyLogs.length === 0 && (
                      <p className="text-sm text-slate-500 italic">No history available for this ticket yet.</p>
                    )}
                  </div>
                </div>
              )}
              
              {activeTab === 'notes' && (
                <div className="space-y-6">
                  <div className="space-y-4 mb-6">
                    {ticketNotes.map(n => (
                      <div key={n.id} className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2"><User size={14}/> {n.user_name}</span>
                          <span className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">{n.note}</p>
                      </div>
                    ))}
                    {ticketNotes.length === 0 && <p className="text-sm text-slate-500 italic">No notes added yet.</p>}
                  </div>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={newNote} 
                      onChange={e => setNewNote(e.target.value)} 
                      placeholder="Add a new note or requirements..." 
                      className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button type="button" onClick={submitNote} disabled={!newNote.trim()} className="px-5 py-2.5 bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">Post Note</button>
                  </div>
                </div>
              )}
              
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                {selectedTicket?.id && (
                  <button 
                    type="button" 
                    className="mr-auto px-5 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    onClick={async () => {
                      if (confirm("Delete this ticket?")) {
                        await fetch(`${API_BASE_URL}/projects/tickets/${selectedTicket.id}`, { method: "DELETE" });
                        setShowModal(false);
                        fetchTickets();
                      }
                    }}
                  >
                    Delete Ticket
                  </button>
                )}
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-md">
                  Save Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revert Prompt Modal */}
      {revertPrompt.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg p-6 rounded-3xl shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 text-red-500">Revert to Developer</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">You are reverting <strong>"{revertPrompt.task}"</strong> back to Dev. Please provide the requirements or reason for revert.</p>
            <textarea 
              autoFocus
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-red-500 outline-none min-h-[100px] mb-4"
              placeholder="Why is this being reverted? What needs to be fixed?"
              value={revertPrompt.reason}
              onChange={e => setRevertPrompt({...revertPrompt, reason: e.target.value})}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setRevertPrompt({isOpen: false, reason: ""})} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button 
                disabled={!revertPrompt.reason.trim()}
                onClick={() => {
                  executeStatusUpdate(revertPrompt.ticketId!, revertPrompt.newStatus!, tickets.find(t=>t.id===revertPrompt.ticketId), revertPrompt.reason);
                  setRevertPrompt({isOpen: false, reason: ""});
                }}
                className="px-4 py-2 font-bold bg-red-600 text-white hover:bg-red-700 rounded-xl disabled:opacity-50 transition-colors">Submit Revert & Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
