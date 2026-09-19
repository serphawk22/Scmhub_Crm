"use client";
import { useRef } from "react";
import { FileText, Plus } from "lucide-react";
import Quotes, { QuotesHandle } from "./Quotes";
import { ExportActions } from "@/components/ExportActions";
import { API_BASE_URL } from "@/config";

export default function BillingManage() {
  const quotesRef = useRef<QuotesHandle>(null);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">Billing</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Manage quotes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportActions
            downloadUrl={`${API_BASE_URL}/quotes/export-pdf`}
            emailUrl={`${API_BASE_URL}/quotes/export-pdf`}
            filename="quotes.pdf"
            label="Quotes"
            formats={[
              { format: "pdf", ext: "pdf", label: "PDF" },
              { format: "xlsx", ext: "xlsx", label: "Excel" },
              { format: "csv", ext: "csv", label: "CSV" },
            ]}
          />
          <button onClick={() => quotesRef.current?.openCreate()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:opacity-90 shadow-md transition-all active:scale-95">
            <Plus className="w-4 h-4" /> New Quote
          </button>
        </div>
      </div>

      {/* Content */}
      <Quotes embedded ref={quotesRef} />
    </div>
  );
}