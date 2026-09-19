"use client";

import React, { useState, useEffect } from 'react';
import { Database, Table, Download, ArrowUp, ArrowDown, ChevronRight, Lock } from 'lucide-react';
import { useLanguage } from "@/context/LanguageContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://crmbackend.serphawk.in';

export default function DatabaseManagementPage() {
  const { t } = useLanguage();
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  
  const [columns, setColumns] = useState<{name: string, type: string}[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticate user via localStorage user object to ensure only Admins can view this
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('crm_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'Admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin === true) {
      fetchTables();
    }
  }, [isAdmin]);

  const fetchTables = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/db/tables`);
      if (!res.ok) throw new Error('Failed to fetch tables');
      const json = await res.json();
      setTables(json.tables || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTableData = async (tableName: string, currentPage = page, currentSortCol = sortCol, currentSortDir = sortDir) => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE_URL}/admin/db/tables/${tableName}?page=${currentPage}&per_page=${perPage}`;
      if (currentSortCol) {
        url += `&sort_col=${encodeURIComponent(currentSortCol)}&sort_dir=${currentSortDir}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch data for ${tableName}`);
      const json = await res.json();
      setColumns(json.columns || []);
      setData(json.data || []);
      setTotal(json.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable, page, sortCol, sortDir);
    }
  }, [selectedTable, page, sortCol, sortDir]);

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colName);
      setSortDir('asc');
    }
    setPage(1); // Reset to first page on sort
  };

  const handleExport = () => {
    if (!selectedTable) return;
    window.open(`${API_BASE_URL}/admin/db/export/${selectedTable}`, '_blank');
  };

  if (isAdmin === null) return null; // Loading state

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="text-center">
          <Lock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 mb-2">{t("database_management.access_denied")}</h1>
          <p className="text-slate-500">{t("database_management.only_master_admins")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Sidebar for Tables */}
      <div className="w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col shadow-xl z-20 relative">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-gradient-to-br from-slate-50 to-white dark:from-zinc-900 dark:to-zinc-900">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Database className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Neon DB</h1>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-widest pl-1">{t("database_management.super_admin_core")}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {tables.map(t => (
            <button
              key={t}
              onClick={() => { setSelectedTable(t); setPage(1); setSortCol(null); }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                selectedTable === t 
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-500/10 dark:text-indigo-400' 
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent dark:text-zinc-400 dark:hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Table className={`w-4 h-4 ${selectedTable === t ? 'opacity-100' : 'opacity-50'}`} />
                {t}
              </div>
              {selectedTable === t && <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-zinc-950/50 relative">
        {selectedTable ? (
          <>
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 p-6 flex items-center justify-between shadow-sm z-10 sticky top-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 flex items-center gap-3">
                  {selectedTable}
                  <span className="text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/50">
                    {total} {t("database_management.entries")}
                  </span>
                </h2>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 dark:from-white dark:to-slate-100 dark:hover:from-slate-200 dark:hover:to-slate-300 text-white dark:text-slate-900 text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  {t("database_management.export_csv")}
                </button>
              </div>
            </div>

            {/* Data Grid */}
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-medium border border-red-100 flex items-center gap-3 shadow-sm">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  {error}
                </div>
              )}
              
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/5">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                        {columns.map(col => (
                          <th 
                            key={col.name} 
                            onClick={() => handleSort(col.name)}
                            className="p-4 text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors select-none group border-r border-slate-100 dark:border-zinc-800 last:border-r-0"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span>{col.name}</span>
                              <span className="text-slate-300 dark:text-zinc-600 group-hover:text-slate-400 flex-shrink-0 bg-slate-200 dark:bg-zinc-800 p-1 rounded-md transition-colors">
                                {sortCol === col.name ? (
                                  sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading && data.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="p-12 text-center text-slate-400 font-medium">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                              {t("database_management.querying_db")}
                            </div>
                          </td>
                        </tr>
                      ) : data.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="p-12 text-center text-slate-500 font-medium bg-slate-50/50 dark:bg-zinc-900/50">
                            {t("database_management.no_records")}
                          </td>
                        </tr>
                      ) : (
                        data.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 dark:border-zinc-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-colors group">
                            {columns.map(col => (
                              <td key={col.name} className="p-4 text-sm font-medium text-slate-600 dark:text-zinc-300 max-w-sm truncate border-r border-slate-50 dark:border-zinc-800/30 last:border-r-0 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                {typeof row[col.name] === 'object' && row[col.name] !== null 
                                  ? JSON.stringify(row[col.name]) 
                                  : String(row[col.name] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex items-center justify-between">
                  <div className="text-sm text-slate-500 dark:text-zinc-400 font-semibold">
                    {t("database_management.showing_to_of").replace("{from}", String(((page - 1) * perPage) + (total > 0 ? 1 : 0))).replace("{to}", String(Math.min(page * perPage, total))).replace("{total}", String(total))}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1 || loading}
                      className="px-4 py-2 text-sm font-bold rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors shadow-sm bg-slate-100 dark:bg-zinc-900"
                    >
                      {t("database_management.previous")}
                    </button>
                    <button 
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * perPage >= total || loading}
                      className="px-4 py-2 text-sm font-bold rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors shadow-sm bg-slate-100 dark:bg-zinc-900"
                    >
                      {t("database_management.next")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] dark:opacity-[0.02]">
              <Database className="w-96 h-96" />
            </div>
            <div className="w-24 h-24 bg-white dark:bg-zinc-900 shadow-xl rounded-2xl flex items-center justify-center mb-8 rotate-3 border border-slate-100 dark:border-zinc-800 relative z-10">
              <Database className="w-10 h-10 text-indigo-500" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 mb-3 relative z-10">{t("database_management.db_connected")}</h2>
            <p className="text-slate-500 dark:text-zinc-400 max-w-md mx-auto font-medium leading-relaxed relative z-10">
              {t("database_management.select_table_desc")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
