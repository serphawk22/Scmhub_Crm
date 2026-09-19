import { useState, useEffect } from "react";
import { Plus, Users, Mail, Shield, Loader2, Briefcase, User, Trash2 } from "lucide-react";
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

export default function TeamTab({ projectId, onUpdate }: { projectId: string; onUpdate: () => void }) {
  const [emails, setEmails] = useState<string>("");
  const [roles, setRoles] = useState<string>("ProjectMember");
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<ProjectTeam>({ employees: [], interns: [], projectMembers: [] });
  const [fetching, setFetching] = useState(true);

  const fetchTeam = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}`);
      const data = await res.json();
      if (data.team) setTeam(data.team);
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
    if (!emails.trim()) return;
    
    setLoading(true);
    const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);
    const roleList = Array(emailList.length).fill(roles);
    
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emailList, roles: roleList }),
      });
      if (res.ok) {
        setEmails("");
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
        <h3 className="text-lg font-black text-slate-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-500" />
          Add Project Members
        </h3>
        
        <form onSubmit={handleAddTeam} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              Email Addresses (comma separated)
            </label>
            <input 
              type="text" 
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="e.g. varshith@example.com, john@example.com"
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" />
              Assign Role
            </label>
            <select 
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ProjectMember">Project Member (Limited Access)</option>
              <option value="ProjectManager">Project Manager</option>
            </select>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
              Users added here will automatically have their accounts created with password <b>password123</b>. They will only have access to this project.
            </p>
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Provision Accounts & Add to Team
          </button>
        </form>
      </div>
    </div>
  );
}
