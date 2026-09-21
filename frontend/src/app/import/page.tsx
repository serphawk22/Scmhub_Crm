"use client";
import { API_BASE_URL } from "@/config";
import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, Link, CheckCircle, X, Loader2,
  AlertTriangle, ArrowRight, Download, ChevronRight, Table2
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type ImportTarget = "leads" | "clients";
type ImportResult = { created: number; skipped: number; errors: string[] };

const SAMPLE_CSV = `company_name,email,phone,website,industry,source,status,address,notes
Acme Corp,contact@acme.com,+1-555-0001,https://acme.com,Technology,LinkedIn,New,"123 Main St, San Francisco CA",Great prospect
Tech Startup Inc,hello@techstartup.io,,https://techstartup.io,SaaS,Referral,Qualified,,Referred by John
Global Retail Co,info@globalretail.com,+44-20-1234-5678,,Retail,Website,Contacted,"London UK",Follow up next week`;

export default function ImportPage() {
  const { t } = useLanguage();
  const [target, setTarget] = useState<ImportTarget>("leads");
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<"file" | "google">("file");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
    const rows = lines.slice(1).map(line => {
      const cols: string[] = [];
      let inQuote = false, current = "";
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { cols.push(current.trim()); current = ""; }
        else current += ch;
      }
      cols.push(current.trim());
      return cols;
    }).filter(r => r.some(c => c.trim()));
    return { headers, rows };
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setPreview(parsed);
      setStep("preview");
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      handleFile(f);
    }
  }, [handleFile]);

  const handleGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) return;
    // Convert Google Sheets URL to CSV export URL
    let csvUrl = googleSheetUrl;
    const match = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }
    setImporting(true);
    try {
      const res = await fetch(csvUrl);
      if (res.ok) {
        const text = await res.text();
        const parsed = parseCSV(text);
        setPreview(parsed);
        setStep("preview");
      } else {
        alert(t("import.google_fetch_error"));
      }
    } catch {
      alert(t("import.google_load_error"));
    } finally { setImporting(false); }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      let csvContent: string;
      if (file) {
        csvContent = await file.text();
      } else {
        // Rebuild CSV from preview
        csvContent = [preview.headers, ...preview.rows].map(row => row.join(",")).join("\n");
      }
      const blob = new Blob([csvContent], { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", blob, "import.csv");

      const res = await fetch(`${API_BASE_URL}/import/${target}/csv`, {
        method: "POST", body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setStep("result");
      }
    } finally { setImporting(false); }
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_leads_import.csv";
    a.click();
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setGoogleSheetUrl("");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-black p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("import.title")}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("import.subtitle")}</p>
            </div>
          </div>
          <button onClick={handleDownloadSample}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all">
            <Download className="w-3.5 h-3.5" /> {t("import.sample_csv")}
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8">
          {["upload", "preview", "result"].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${step === s ? "bg-blue-600 text-white" : i < ["upload", "preview", "result"].indexOf(step) ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                {i < ["upload", "preview", "result"].indexOf(step) ? <CheckCircle className="w-3 h-3" /> : <span>{i + 1}</span>}
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300" />}
            </React.Fragment>
          ))}
        </div>

        {/* Target Toggle */}
        {step !== "result" && (
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t("import.import_as")}</span>
            {(["leads", "clients"] as const).map(t => (
              <button key={t} onClick={() => setTarget(t)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${target === t ? "bg-blue-600 text-white shadow-sm" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {/* Mode Switch */}
            <div className="flex gap-2 mb-4">
              {(["file", "google"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${mode === m ? "bg-slate-900 dark:bg-white text-white dark:text-black" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                  {m === "file" ? t("import.upload_file") : t("import.google_sheet")}
                </button>
              ))}
            </div>

            {mode === "file" ? (
              <>
                {/* Drop Zone */}
                <div onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)} onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" : "border-slate-200 dark:border-slate-700 hover:border-blue-400 bg-white dark:bg-[#111]"}`}>
                  <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FileSpreadsheet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t("import.drop_file")}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t("import.drop_file_desc")}</p>
                  <button className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all">
                    {t("import.browse_files")}
                  </button>
                </div>

                {/* Column Mapping Guide */}
                <div className="mt-6 bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3 flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-slate-500" /> {t("import.supported_columns")}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { col: "company_name / company / name", desc: t("import.col_company") },
                      { col: "email / e-mail", desc: t("import.col_email") },
                      { col: "phone / mobile / tel", desc: t("import.col_phone") },
                      { col: "website / url", desc: t("import.col_website") },
                      { col: "industry / sector", desc: t("import.col_industry") },
                      { col: "source / lead source", desc: t("import.col_source") },
                      { col: "status", desc: t("import.col_status") },
                      { col: "address / location", desc: t("import.col_address") },
                      { col: "notes / comments", desc: t("import.col_notes") },
                    ].map(c => (
                      <div key={c.col} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900">
                        <code className="text-xs font-mono text-blue-600 dark:text-blue-400">{c.col}</code>
                        <p className="text-[11px] text-slate-500 mt-0.5">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-2">{t("import.import_from_google")}</h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                  {t("import.google_share_tip")}
                </p>
                <div className="flex gap-2">
                  <input value={googleSheetUrl} onChange={e => setGoogleSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleGoogleSheet} disabled={importing || !googleSheetUrl.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {t("import.load")}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 2: Preview */}
        {step === "preview" && preview && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">{t("import.data_preview")}</h2>
                <p className="text-sm text-slate-500">{t("import.rows_found").replace("{rows}", String(preview.rows.length)).replace("{columns}", String(preview.headers.length))}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={reset} className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all">
                  {t("import.back")}
                </button>
                <button onClick={handleImport} disabled={importing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {t("import.import_count").replace("{count}", String(preview.rows.length)).replace("{target}", target)}
                </button>
              </div>
            </div>

            {/* Data cleaning note */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl mb-4 text-xs text-blue-700 dark:text-blue-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              {t("import.auto_cleaned")}
            </div>

            {/* Table Preview */}
            <div className="bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 w-8">#</th>
                      {preview.headers.map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-3 py-2.5 text-[11px] text-slate-400">{i + 1}</td>
                        {preview.headers.map((_, j) => (
                          <td key={j} className="px-4 py-2.5 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{row[j] || ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 20 && (
                <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                  {t("import.showing_of").replace("{total}", String(preview.rows.length))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* STEP 3: Result */}
        {step === "result" && result && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center py-12">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${result.created > 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
              {result.created > 0 ? <CheckCircle className="w-10 h-10 text-emerald-600" /> : <AlertTriangle className="w-10 h-10 text-amber-600" />}
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
              {result.created > 0 ? t("import.import_successful") : t("import.import_complete")}
            </h2>
            <div className="flex items-center gap-6 mt-4 mb-6">
              <div className="text-center">
                <p className="text-3xl font-black text-emerald-600">{result.created}</p>
                <p className="text-sm text-slate-500">{t("import.created").replace("{target}", target)}</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-amber-600">{result.skipped}</p>
                <p className="text-sm text-slate-500">{t("import.rows_skipped")}</p>
              </div>
              {result.errors.length > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-black text-red-600">{result.errors.length}</p>
                  <p className="text-sm text-slate-500">{t("import.errors")}</p>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="w-full max-w-lg p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-6 text-left">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">{t("import.errors_label")}</p>
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={reset}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-200 transition-all">
                {t("import.import_more")}
              </button>
              <a href={`/${target}`} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all flex items-center gap-2">
                {t("import.view_target").replace("{target}", target.charAt(0).toUpperCase() + target.slice(1))} <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
