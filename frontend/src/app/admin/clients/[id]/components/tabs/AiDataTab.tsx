'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Brain, CheckCircle2, Loader2, RefreshCw, Store } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_BASE_URL } from '@/config';

interface AiDataTabProps {
  clientId: string;
  websiteUrl?: string;
  onClientRefresh?: () => void;
  resourceType?: 'clients' | 'leads';
}

type AnalysisStatus = 'idle' | 'pending' | 'done' | 'error';

const errorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
);

export default function AiDataTab({ clientId, websiteUrl, onClientRefresh, resourceType = 'clients' }: AiDataTabProps) {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<{ count: number; marketplace: number } | null>(null);
  const [extractError, setExtractError] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resourcePath = `${API_BASE_URL}/${resourceType}/${clientId}`;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const readAnalysis = useCallback(async () => {
    const response = await fetch(resourceType === 'clients' ? `${resourcePath}/full-analysis` : `${resourcePath}/research`);
    if (!response.ok) return null;
    const data = await response.json();
    if (resourceType === 'clients') {
      setServices(data.extracted_services || data.services_offered || data.ai_data?.extracted_services || []);
      return data;
    }

    const research = data.research || {};
    let agentData = research.email_agent_data;
    if (typeof agentData === 'string') {
      try { agentData = JSON.parse(agentData); } catch { agentData = null; }
    }
    const report = agentData?.full_markdown_report || (Object.keys(research).length > 0 ? JSON.stringify(research, null, 2) : null);
    setServices(agentData?.extracted_services || agentData?.product_portfolio || research.extracted_services || []);
    return report ? { status: 'done', report } : { status: 'pending' };
  }, [resourcePath, resourceType]);

  const startPolling = useCallback(() => {
    stopPolling();
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const data = await readAnalysis();
        if (data?.status === 'done' && data.report) {
          setReport(data.report);
          setStatus('done');
          stopPolling();
        } else if (data?.status === 'error' || attempts >= 36) {
          setStatus('error');
          setError(data?.message || 'AI data extraction timed out. Please try again.');
          stopPolling();
        }
      } catch {
        if (attempts >= 36) {
          setStatus('error');
          setError('Could not retrieve the AI data. Please try again.');
          stopPolling();
        }
      }
    }, 5000);
  }, [readAnalysis, stopPolling]);

  const runAnalysis = useCallback(async () => {
    setStatus('pending');
    setReport(null);
    setError('');
    try {
      const response = await fetch(
        resourceType === 'clients' ? `${resourcePath}/full-analysis` : `${resourcePath}/auto-research`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Could not start AI data extraction.');
      startPolling();
    } catch (err: unknown) {
      setStatus('error');
      setError(errorMessage(err, 'Could not start AI data extraction.'));
    }
  }, [resourcePath, resourceType, startPolling]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await readAnalysis();
        if (!active) return;
        if (data?.status === 'done' && data.report) {
          setReport(data.report);
          setStatus('done');
        } else if (data?.status === 'pending') {
          setStatus('pending');
          startPolling();
        } else {
          await runAnalysis();
        }
      } catch {
        if (active) await runAnalysis();
      }
    };
    load();
    return () => {
      active = false;
      stopPolling();
    };
  }, [readAnalysis, runAnalysis, startPolling, stopPolling]);

  const extractServices = async () => {
    setIsExtracting(true);
    setExtractResult(null);
    setExtractError('');
    try {
      const response = await fetch(`${resourcePath}/extract-services`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.detail || data.message || 'Failed to extract services.');
      }
      setExtractResult({
        count: data.services?.length ?? data.extracted_count ?? 0,
        marketplace: data.marketplace_entries_added ?? data.marketplace_count ?? 0,
      });
      onClientRefresh?.();
    } catch (err: unknown) {
      setExtractError(errorMessage(err, 'Could not extract services.'));
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <Brain size={20} />
            <div>
              <h2 className="text-base font-black tracking-tight">AI DATA</h2>
              <p className="text-xs text-indigo-100">Website intelligence powered by your scraper and GPT-4o</p>
            </div>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={status === 'pending'}
            className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs font-bold transition hover:bg-white/25 disabled:cursor-wait disabled:opacity-60"
          >
            {status === 'pending' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {status === 'pending' ? 'Extracting...' : 'Refresh AI Data'}
          </button>
        </div>

        {status === 'pending' && (
          <div className="flex items-center gap-3 bg-indigo-50 px-5 py-4 text-indigo-700">
            <Loader2 size={20} className="shrink-0 animate-spin" />
            <div>
              <p className="text-sm font-bold">Extracting company information...</p>
              <p className="text-xs text-indigo-600">Scraping the website and asking GPT-4o to organize the full company profile. This can take a few minutes.</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 bg-red-50 px-5 py-4 text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">AI data extraction failed</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}

        {status === 'done' && report && (
          <div className="prose prose-slate max-w-none px-5 py-5 text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </div>
        )}

        {status === 'idle' && !report && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Preparing AI data extraction{websiteUrl ? ` for ${websiteUrl}` : ''}...
          </div>
        )}
      </section>

      {services.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">Extracted Services</h3>
            <span className="text-xs font-bold text-slate-400">{services.length} detected</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {services.map((service: any, index: number) => (
              <div key={`${service.name || service.service_name || service}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-800">{typeof service === 'string' ? service : service.name || service.service_name}</p>
                {(service.brief || service.description || service.why_relevant) && <p className="mt-1 text-xs text-slate-500">{service.brief || service.description || service.why_relevant}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Store size={18} /></div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Extract Services</h3>
              <p className="text-xs text-slate-500">Find services on the company website and add them to the marketplace.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={extractServices}
            disabled={isExtracting || !websiteUrl}
            title={!websiteUrl ? 'Add a website URL first' : 'Extract services from website'}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExtracting ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
            {isExtracting ? 'Extracting Services...' : 'Extract Services'}
          </button>
        </div>
        {extractResult && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} /> Services extracted.
          </div>
        )}
        {extractError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{extractError}</div>
        )}
      </section>
    </div>
  );
}
