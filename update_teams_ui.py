with open("frontend/src/app/teams/page.tsx", "r") as f:
    content = f.read()

# Add framer-motion import
if "import { motion" not in content:
    content = content.replace(
        'import { useState, useEffect } from "react";',
        'import { useState, useEffect } from "react";\nimport { motion, AnimatePresence } from "framer-motion";'
    )

# Add extra icons
if "Target" not in content:
    content = content.replace(
        'Briefcase, GraduationCap } from "lucide-react";',
        'Briefcase, GraduationCap, Target, Ticket, CheckCircle, PlayCircle, Layers, Activity } from "lucide-react";'
    )

# Add state
state_code = """
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleUserClick = async (u: any) => {
    setSelectedUser(u);
    setUserStats(null);
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${u.id}/stats`);
      if (res.ok) {
        setUserStats(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };
"""
if "selectedUser" not in content:
    content = content.replace(
        'const [role, setRole] = useState("Employee");',
        'const [role, setRole] = useState("Employee");\n' + state_code
    )

# Add onClick to user items
content = content.replace(
    'className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-950/50 transition-colors"',
    'className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-950/50 transition-colors cursor-pointer"\n                onClick={() => handleUserClick(u)}'
)

# Add the drawer UI at the end
drawer_code = """
      {/* User Stats Drawer */}
      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-lg">
                    {selectedUser.name?.charAt(0) || selectedUser.email?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white leading-none">
                      {selectedUser.name || "Unnamed Member"}
                    </h2>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {selectedUser.role}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 flex-1">
                {loadingStats ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm font-bold text-gray-500 dark:text-zinc-400">Loading performance stats...</p>
                  </div>
                ) : userStats ? (
                  <div className="space-y-8 animate-in fade-in duration-500">
                    {userStats.type === "sales" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                              <Briefcase className="w-5 h-5" />
                              <span className="text-xs font-black uppercase tracking-wider">Clients</span>
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                              {userStats.clients_handling}
                            </p>
                            <p className="text-xs font-bold text-gray-400 mt-1">Active Accounts</p>
                          </div>
                          
                          <div className="bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-500/10">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                              <Target className="w-5 h-5" />
                              <span className="text-xs font-black uppercase tracking-wider">Leads</span>
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                              {userStats.leads_converted}
                            </p>
                            <p className="text-xs font-bold text-gray-400 mt-1">Converted</p>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-black text-gray-900 dark:text-zinc-100 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-500" /> Active Sales Tasks
                          </h3>
                          {userStats.active_tasks?.length > 0 ? (
                            <div className="space-y-3">
                              {userStats.active_tasks.map((t: any) => (
                                <div key={t.id} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm">
                                  <p className="font-bold text-sm text-gray-900 dark:text-white">{t.title}</p>
                                  <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                                      {t.status}
                                    </span>
                                    <span className={`text-xs font-bold ${
                                      t.priority === 'High' || t.priority === 'Urgent' 
                                      ? 'text-red-500' : 'text-blue-500'
                                    }`}>
                                      {t.priority} Priority
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl">
                              <p className="text-sm font-bold text-gray-400">No active tasks</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {userStats.type === "dev" && (
                      <div className="space-y-6">
                        <div className="bg-indigo-50 dark:bg-indigo-500/5 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-500/10 text-center">
                          <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">Total Assigned</h4>
                          <p className="text-5xl font-black text-gray-900 dark:text-white">{userStats.total_tickets}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                              <PlayCircle className="w-5 h-5" />
                              <span className="font-bold text-sm">In Development</span>
                            </div>
                            <span className="font-black text-lg text-gray-900 dark:text-white">{userStats.in_dev}</span>
                          </div>
                          
                          <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                              <Layers className="w-5 h-5" />
                              <span className="font-bold text-sm">Given to QA</span>
                            </div>
                            <span className="font-black text-lg text-gray-900 dark:text-white">{userStats.in_qa}</span>
                          </div>
                          
                          <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="w-5 h-5" />
                              <span className="font-bold text-sm">Prod Release</span>
                            </div>
                            <span className="font-black text-lg text-gray-900 dark:text-white">{userStats.in_prod}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-gray-500">No data available.</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
"""

if "{/* User Stats Drawer */}" not in content:
    content = content.replace(
        '<PageGuide',
        drawer_code + '\n      <PageGuide'
    )

with open("frontend/src/app/teams/page.tsx", "w") as f:
    f.write(content)

print("Updated teams page UI with stats drawer!")
