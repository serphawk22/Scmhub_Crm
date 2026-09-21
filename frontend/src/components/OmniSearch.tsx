"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Briefcase, CheckSquare, Target, X, Command } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRouter } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import { useLanguage } from "@/context/LanguageContext";

export default function OmniSearch() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { isAuthenticated } = useRole();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      fetch(`${API_BASE_URL}/omnisearch?q=${encodeURIComponent(query)}`)
        .then(async res => { if (!res.ok) throw new Error("Search failed"); return res.json(); })
        .then(data => {
          setResults(data.results || []);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  if (!isAuthenticated) return null;

  const getIcon = (type: string) => {
    switch(type) {
      case 'Client': return <Briefcase className="w-5 h-5 text-blue-500" />;
      case 'Lead': return <User className="w-5 h-5 text-emerald-500" />;
      case 'Task': return <CheckSquare className="w-5 h-5 text-violet-500" />;
      case 'Deal': return <Target className="w-5 h-5 text-orange-500" />;
      default: return <Search className="w-5 h-5 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95">
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
          <Search className="w-6 h-6 text-slate-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-lg text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            placeholder={t("omni_search.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? (
            <div className="p-8 text-center text-slate-500">{t("omni_search.searching")}</div>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-1">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(result.route);
                  }}
                  className="flex items-center p-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer rounded-xl transition-colors group"
                >
                  <div className="bg-slate-100 dark:bg-zinc-800 p-2 rounded-lg mr-4 group-hover:bg-white dark:group-hover:bg-zinc-700 transition-colors">
                    {getIcon(result.type)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-zinc-100">{result.title}</h4>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">{result.type} • {result.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-8 text-center text-slate-500">{t("omni_search.no_results")} "{query}"</div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
              <Command className="w-12 h-12 mb-4 opacity-20" />
              <p>{t("omni_search.type_to_search")}</p>
              <div className="mt-4 flex gap-2">
                <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs font-mono">clients</span>
                <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs font-mono">leads</span>
                <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs font-mono">tasks</span>
                <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs font-mono">deals</span>
              </div>
            </div>
          )}
        </div>
        <div className="bg-slate-50 dark:bg-zinc-950 px-4 py-3 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center text-xs text-slate-500">
          <span>{t("omni_search.pro_tip")} <kbd className="bg-slate-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">ESC</kbd> {t("omni_search.to_close")}</span>
          <span>{t("omni_search.powered_by")}</span>
        </div>
      </div>
    </div>
  );
}
