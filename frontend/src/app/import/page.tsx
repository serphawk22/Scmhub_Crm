"use client";

import { ChangeEvent, useState } from "react";
import { UploadCloud, ArrowRight, FileSpreadsheet } from "lucide-react";
import { API_BASE_URL } from "@/config";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Ready to import");
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setStatus(selected ? `${selected.name} selected` : "Ready to import");
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus("Please choose a CSV or Excel file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("module", "leads");

    setLoading(true);
    setStatus("Uploading and previewing data…");

    try {
      const res = await fetch(`${API_BASE_URL}/api/import/preview`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Import preview failed.");
      }

      setPreview(data.preview || data.rows || []);
      setStatus(`Preview ready for ${data.row_count ?? preview.length ?? 0} rows.`);
    } catch (err: any) {
      setStatus(err.message || "Import preview failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Import</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Lead import</h1>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-5 md:flex-row md:items-end">
          <label className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:border-indigo-500 dark:hover:bg-zinc-800">
            <UploadCloud className="mb-3 h-8 w-8 text-indigo-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">Choose CSV or Excel file</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </label>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing…" : "Preview import"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          <span>{status}</span>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 dark:border-zinc-800 dark:text-zinc-200">
            Preview rows
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-zinc-800/70">
                <tr>
                  {Object.keys(preview[0]).map((key) => (
                    <th key={key} className="px-4 py-3 font-bold text-slate-700 dark:text-zinc-200">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className="border-t border-slate-200 dark:border-zinc-800">
                    {Object.values(row).map((value: any, i) => (
                      <td key={i} className="px-4 py-3 text-slate-600 dark:text-zinc-300">{String(value ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
