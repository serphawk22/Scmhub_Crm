import re

with open("frontend/src/app/admin/telemetry/page.tsx", "r") as f:
    content = f.read()

# 1. Add activeTab and demoAccounts state
imports_end = content.find("interface AuditLog {")
new_imports = """
interface DemoAccount {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

"""
content = content[:imports_end] + new_imports + content[imports_end:]

state_end = content.find("const fetchLogs = async () => {")
new_state = """  const [activeTab, setActiveTab] = useState<"system" | "demo">("system");
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [selectedDemoUser, setSelectedDemoUser] = useState<DemoAccount | null>(null);

  const fetchDemoAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/demo-accounts`, {
        headers: { "X-Tenant-ID": user?.tenant_id?.toString() || "" }
      });
      const data = await res.json();
      setDemoAccounts(data.accounts || []);
    } catch (err) {}
  };

  useEffect(() => {
    if (activeTab === "demo") {
      fetchDemoAccounts();
    }
  }, [activeTab]);

  const fetchUserLogs = async (userId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/audit-logs?limit=50&offset=0&user_id=${userId}`, {
        headers: { "X-Tenant-ID": user?.tenant_id?.toString() || "" }
      });
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {}
    setLoading(false);
  };

"""
content = content[:state_end] + new_state + content[state_end:]

# 2. Add tabs in Header
header_end = content.find("{/* Analytics Cards */}")
tabs_ui = """
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => { setActiveTab("system"); fetchLogs(); }}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${activeTab === "system" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
        >
          System Logs
        </button>
        <button
          onClick={() => setActiveTab("demo")}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${activeTab === "demo" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
        >
          Demo Showcases
        </button>
      </div>

"""
content = content[:header_end] + tabs_ui + content[header_end:]


# 3. Conditional rendering
main_content_start = content.find("{/* Analytics Cards */}")
main_content_end = content.find("{/* JSON Viewer Modal */}")

main_content = content[main_content_start:main_content_end]

demo_view = """
      {activeTab === "demo" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {demoAccounts.map(demo => (
              <div 
                key={demo.id}
                onClick={() => { setSelectedDemoUser(demo); fetchUserLogs(demo.id); }}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center">
                    {demo.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-zinc-100">{demo.name}</h3>
                    <p className="text-xs text-slate-500">{demo.email}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Joined: {new Date(demo.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {demoAccounts.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-500">
                No demo accounts found.
              </div>
            )}
          </div>
        </div>
      ) : (
"""

system_view_end = """
      )}
"""

content = content[:main_content_start] + demo_view + main_content + system_view_end + content[main_content_end:]

# 4. User activity modal for demo user
modal_end = content.find("</div>\n  );\n}")
demo_modal = """
      {/* Demo User Activity Modal */}
      {selectedDemoUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                {selectedDemoUser.name}'s Activity Timeline
              </h3>
              <button 
                onClick={() => setSelectedDemoUser(null)}
                className="p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {loading ? (
                <div className="py-12 text-center text-slate-400">Loading activity...</div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-slate-500">No activity logged for this user yet.</div>
              ) : (
                <div className="space-y-4">
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-4 p-4 border border-slate-100 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-900/30">
                      <div className="text-xs font-semibold text-slate-400 min-w-[120px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getActionColor(log.action)}`}>{log.action}</span>
                          <span className="font-bold text-slate-700 dark:text-zinc-300">{log.table_name} #{log.record_id}</span>
                        </div>
                        {log.changes && (
                          <pre className="text-xs text-slate-500 bg-white dark:bg-black p-2 rounded border border-slate-200 dark:border-zinc-800 mt-2 overflow-x-auto">
                            {log.changes}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
"""
content = content[:modal_end] + demo_modal + content[modal_end:]

with open("frontend/src/app/admin/telemetry/page.tsx", "w") as f:
    f.write(content)

