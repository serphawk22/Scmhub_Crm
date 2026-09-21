import { useState, useEffect } from "react";
import { Plus, Users, Mail, Shield, Loader2, UserPlus } from "lucide-react";
import { API_BASE_URL } from "@/config";

interface TeamMember {
  id: number;
  name: string;
  email: string;
}

interface ProjectTeam {
  employees: TeamMember[];
  interns: TeamMember[];
  projectMembers: TeamMember[];
}

interface DirectoryUser extends TeamMember {
  role: string;
}

export default function TeamTab({ projectId, onUpdate }: { projectId: string; onUpdate: () => void }) {
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [newMember, setNewMember] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<ProjectTeam>({ employees: [], interns: [], projectMembers: [] });
  const [fetching, setFetching] = useState(true);

  const fetchTeam = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}`);
      const data = await res.json();
      if (data.team) setTeam(data.team);
      const usersRes = await fetch(`${API_BASE_URL}/users`);
      const usersData = await usersRes.json();
      setDirectoryUsers((usersData.users || []).filter((user: DirectoryUser) => ["Admin", "Employee", "Intern", "ProjectMember"].includes(user.role)));
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [projectId]);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIds.length && (!newMember.name.trim() || !newMember.email.trim() || newMember.password.length < 8)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: selectedIds, new_member: newMember.name.trim() ? newMember : null }),
      });
      if (res.ok) {
        setSelectedIds([]);
        setNewMember({ name: "", email: "", password: "" });
        onUpdate();
        fetchTeam();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const allMembers = [
    ...team.employees.map(m => ({ ...m, role: 'Employee' })),
    ...team.interns.map(m => ({ ...m, role: 'Intern' })),
    ...team.projectMembers.map(m => ({ ...m, role: 'Project Member' })),
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Current Team Members */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Current Team Members ({allMembers.length})
        </h3>

        {fetching ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading team...
          </div>
        ) : allMembers.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-semibold">No team members assigned yet</p>
            <p className="text-xs text-slate-400 mt-1">Add members using the form below</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {allMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3 group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.email}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Team Form */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 dark:text-zinc-50 mb-2 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-indigo-500" />
          Assign people to this project
        </h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">Select people already in Team Directory, or create a new Project Member with explicit credentials.</p>
        
        <form onSubmit={handleAddTeam} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              Existing Team Directory users
            </label>
            <select multiple value={selectedIds.map(String)} onChange={e => setSelectedIds(Array.from(e.target.selectedOptions, option => Number(option.value)))} className="w-full min-h-32 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {directoryUsers.map(member => <option key={member.id} value={member.id}>{member.name || member.email} · {member.email} · {member.role}</option>)}
            </select>
            {directoryUsers.length === 0 && <p className="mt-2 text-xs text-amber-600">No eligible directory users found.</p>}
          </div>
          <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Or create new Project Member</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input required={!selectedIds.length} value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} placeholder="Full name" className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm" />
              <input required={!selectedIds.length} type="email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} placeholder="Email" className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm" />
              <input required={!selectedIds.length} minLength={8} type="password" value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} placeholder="Password (8+ chars)" className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">New accounts are created as Project Member and immediately assigned to this project.</p>
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Assign selected / create member
          </button>
        </form>
      </div>
    </div>
  );
}
