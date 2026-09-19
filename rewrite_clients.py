import re

with open('frontend/src/app/clients/page_backup.tsx', 'r') as f:
    content = f.read()

parts = content.split('      {/* Modals remain structurally similar, but updated with glassmorphism */}')
if len(parts) < 2:
    print("Could not find Modals marker")
    exit(1)

top_part = parts[0]
modals_part = '      {/* Modals remain structurally similar, but updated with glassmorphism */}' + parts[1]

ret_idx = top_part.find('  return (\n    <div className="max-w-[1500px] mx-auto space-y-8">')

new_render = """  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#0f172a]">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t("clients.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t("clients.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.open(`${API_BASE_URL}/clients/export-csv`, '_blank')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => { setIsSheetImportOpen(true); setSheetImportState('idle'); setSheetPreview([]); setSheetUrl(''); setSheetImportResult(null); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
              <FileSpreadsheet className="w-4 h-4" /> Import Sheet
            </button>
            <button onClick={() => setIsOCRModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
              <FileScan className="w-4 h-4" /> <span className="hidden sm:inline">{t("clients.ocr_scan")}</span>
            </button>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all hover:shadow-md active:scale-95">
              <Plus className="w-4 h-4" /> {t("clients.add_client")}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-transparent">
             <p className="text-xl font-black text-blue-600">{loading ? "—" : totalCount}</p>
             <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{t("clients.total_accounts")}</p>
          </div>
          {statuses.slice(0, 3).map((status, idx) => {
            const colors = ["text-violet-600", "text-amber-600", "text-emerald-600"];
            const bgs = ["bg-violet-500/10", "bg-amber-500/10", "bg-emerald-500/10"];
            return (
              <div key={status.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${bgs[idx % 3]} border border-transparent`}>
                <p className={`text-xl font-black ${colors[idx % 3]}`}>{loading ? "—" : clients.filter(c => c.status === status.name).length}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{status.name}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 flex-wrap gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Search clients..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewSwitcher currentView={viewMode as any} onViewChange={(v: any) => setViewMode(v)} />
          {["All", ...statuses.map(s => s.name)].map(s => (
            <button key={s} onClick={() => { setFilter(s === "All" ? "All" : s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${(filter === "All" ? "All" : filter) === s ? "bg-blue-600 dark:bg-white text-white dark:text-black shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto bg-white dark:bg-[#1e293b]">
          {loading && clients.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="flex gap-4 p-6 overflow-x-auto h-full items-start">
              {statuses.map(status => {
                const colClients = filteredClients.filter(c => c.status === status.name);
                return (
                  <div key={status.id} className="w-80 shrink-0 flex flex-col bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl max-h-full">
                    <div className="p-4 font-bold text-slate-800 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-[#222222]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color.replace('bg-', '') || '#6366f1' }}></div>
                        <span>{status.name}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-[#222222] text-xs text-slate-600 dark:text-[#a3a3a3]">{colClients.length}</span>
                    </div>
                    <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[200px]">
                      {colClients.map(client => (
                        <ContextMenu 
                          key={client.id}
                          onCtrlClick={() => window.open(`/admin/clients/${client.id}`, '_blank')}
                          actions={[
                            { label: 'Open in New Tab', icon: <ExternalLink className="w-4 h-4" />, onClick: () => window.open(`/admin/clients/${client.id}`, '_blank') },
                            { label: 'Open Client', icon: <ChevronRight className="w-4 h-4" />, onClick: () => router.push(`/admin/clients/${client.id}`) },
                            { label: 'AI Call Pitch', icon: <Phone className="w-4 h-4" />, onClick: () => handleSimulateCall(client.id) },
                            { label: 'Delete Client', icon: <XCircle className="w-4 h-4" />, danger: true, onClick: () => handleDeleteClient(client.id) },
                          ]}
                        >
                          <motion.div layoutId={`client-${client.id}`} onClick={() => router.push(`/admin/clients/${client.id}`)}
                            className="p-4 bg-white dark:bg-[#000000] rounded-xl shadow-sm border border-slate-200 dark:border-[#222222] cursor-pointer hover:border-blue-500 dark:hover:border-white transition-colors group">
                            <div className="font-semibold text-slate-900 dark:text-white text-sm">{client.companyName || client.projectName || client.email || 'Unnamed Client'}</div>
                            {client.website && <div className="text-[12px] text-slate-500 mt-1 line-clamp-1">{client.website}</div>}
                            {client.email && <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><Mail className="w-3 h-3"/>{client.email}</div>}
                          </motion.div>
                        </ContextMenu>
                      ))}
                      {colClients.length === 0 && <div className="p-4 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-[#222222] rounded-xl">No clients</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : viewMode === 'graph' ? (
            <div className="p-8 h-full">
              <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-[#222222] h-[500px]">
                <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Clients by Status</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statuses.map(s => ({ name: s.name, count: filteredClients.filter(c => c.status === s.name).length }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#000', borderColor: '#222', color: '#fff'}} />
                    <Bar dataKey="count" fill="currentColor" className="fill-blue-500 dark:fill-white" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : viewMode === 'pivot' ? (
            <div className="p-6 h-full overflow-auto">
              <table className="w-full text-left border-collapse bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl overflow-hidden shadow-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#000000] border-b border-slate-200 dark:border-[#222222] text-xs uppercase tracking-wider text-slate-500 dark:text-[#a3a3a3]">
                    <th className="p-4 font-semibold">Assignee \ Status</th>
                    {statuses.map(s => <th key={s.id} className="p-4 font-semibold text-center">{s.name}</th>)}
                    <th className="p-4 font-bold text-center border-l border-slate-200 dark:border-[#222222]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#222222]">
                  {Array.from(new Set(filteredClients.map(c => c.assignedEmployeeName || 'Unassigned'))).map(assignee => {
                    const assigneeClients = filteredClients.filter(c => (c.assignedEmployeeName || 'Unassigned') === assignee);
                    return (
                      <tr key={assignee} className="hover:bg-slate-50 dark:hover:bg-[#0a0a0a]">
                        <td className="p-4 font-medium text-slate-900 dark:text-white">{assignee}</td>
                        {statuses.map(s => <td key={s.id} className="p-4 text-center text-slate-600 dark:text-[#a3a3a3]">{assigneeClients.filter(c => c.status === s.name).length || '-'}</td>)}
                        <td className="p-4 text-center font-bold text-slate-900 dark:text-white border-l border-slate-200 dark:border-[#222222]">{assigneeClients.length}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'map' ? (
            <div className="p-6 h-[700px]">
              <ClientMapView clients={filteredClients} />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="px-6 py-4 font-medium">Client</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Assignee</th>
                  <th className="px-6 py-4 font-medium">Website</th>
                  <th className="px-6 py-4 font-medium">Last Activity</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <AnimatePresence>
                  {filteredClients.map((client, idx) => (
                    <motion.tr 
                      key={client.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/clients/${client.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1">
                            {client.companyName || client.projectName || client.email || 'Unnamed Client'}
                          </span>
                          {client.email && (
                            <span className="text-[12px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" /> {client.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border bg-blue-500/10 text-blue-600 border-blue-500/20`}>
                          {client.status || "Active"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] text-slate-600 dark:text-slate-300">
                          {client.assignedEmployeeName || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] text-slate-600 dark:text-slate-300">
                          {client.website || client.websiteUrl ? (client.website || client.websiteUrl).replace(/^https?:\/\//, '') : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] text-slate-600 dark:text-slate-300">
                          {client.lastActivity ? client.lastActivity : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleSimulateCall(client.id); }} title="AI Call Pitch" className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-slate-400 hover:text-green-600 transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); window.open(`/admin/clients/${client.id}`, '_blank'); }} title="Open in New Tab" className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id); }} title="Delete Client" className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
          {viewMode !== 'kanban' && viewMode !== 'graph' && viewMode !== 'pivot' && viewMode !== 'map' && filteredClients.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No clients found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">Try adjusting filters or click "Add Client" to get started.</p>
            </div>
          )}
        </div>

        {/* Activity Sidebar */}
        <motion.div
          initial="hidden" animate="show"
          className="w-full xl:w-[400px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] flex flex-col h-full overflow-hidden"
        >
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
            <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl"><Zap className="w-5 h-5" /></div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No activity yet.</p>
            ) : (
              activities.map(act => (
                <Link href={act.clientId ? `/admin/clients/${act.clientId}` : '#'} key={act.id} className="block p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">{act.action}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{new Date(act.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">{act.content}</p>
                  {act.details && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-1">{act.details}</p>
                  )}
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </div>\n"""

new_content = top_part[:ret_idx] + new_render + modals_part

with open('frontend/src/app/clients/page.tsx', 'w') as f:
    f.write(new_content)

print("Rewrite complete!")
