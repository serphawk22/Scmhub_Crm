"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2,
  Search,
  Globe,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  AlertTriangle,
  CheckCircle,
  Plus,
  X,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface CompetitorResult {
  domain: string;
  dr: number;
  traffic: string;
  keywords: number;
  backlinks: string;
  topPages: string[];
  strengths: string[];
  weaknesses: string[];
  vs: "ahead" | "behind" | "equal";
}

function mockCompetitorAnalysis(domains: string[]): Promise<CompetitorResult[]> {
  return new Promise((res) =>
    setTimeout(() => {
      res(
        domains.map((d, i) => ({
          domain: d.replace(/https?:\/\//, "").split("/")[0],
          dr: Math.floor(30 + Math.random() * 55),
          traffic: `${(Math.floor(Math.random() * 90) + 10)}K`,
          keywords: Math.floor(500 + Math.random() * 4500),
          backlinks: `${(Math.floor(Math.random() * 50) + 5)}K`,
          topPages: [
            "Homepage",
            `Blog: Top ${["SEO", "Local SEO", "E-com SEO"][i % 3]} Strategies`,
            `Service: ${["Technical Audit", "Link Building", "Content Marketing"][i % 3]}`,
          ],
          strengths: [
            "Strong domain authority",
            "Rich content library",
            `High ${["local", "organic", "referral"][i % 3]} traffic`,
          ],
          weaknesses: [
            "Slow mobile performance",
            "Thin product pages",
            "Weak social signals",
          ],
          vs: (["ahead", "behind", "equal"] as const)[i % 3],
        }))
      );
    }, 2200)
  );
}

function VsBadge({ vs }: { vs: CompetitorResult["vs"] }) {
  const { t } = useLanguage();
  if (vs === "ahead") return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3" /> {t("agents_competitor.vs_ahead")}
    </span>
  );
  if (vs === "behind") return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
      <TrendingDown className="w-3 h-3" /> {t("agents_competitor.vs_behind")}
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <Minus className="w-3 h-3" /> {t("agents_competitor.vs_equal")}
    </span>
  );
}

export default function CompetitorAnalysisPage() {
  const { t } = useLanguage();
  const [urls, setUrls] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompetitorResult[] | null>(null);
  const [addedDomains, setAddedDomains] = useState<string[]>([]);
  
  useEffect(() => {
    const saved = localStorage.getItem("competitorResults");
    if (saved) {
      try { setResults(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (results) {
      localStorage.setItem("competitorResults", JSON.stringify(results));
    }
  }, [results]);

  const addUrl = () => setUrls((prev) => [...prev, ""]);
  const removeUrl = (i: number) => setUrls((prev) => prev.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, val: string) =>
    setUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)));

  const analyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = urls.filter((u) => u.trim());
    if (!clean.length) return;
    setLoading(true);
    setResults(null);
    const data = await mockCompetitorAnalysis(clean);
    setResults(data);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #0891b2, #2563eb)" }}
          >
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {t("agents_competitor.title")}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t("agents_competitor.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Input form */}
      <motion.form
        onSubmit={analyze}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-8 space-y-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          {t("agents_competitor.enter_urls")}
        </p>
        {urls.map((u, i) => (
          <div key={i} className="flex gap-2">
            <div
              className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            >
              <Globe className="w-4 h-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
              <input
                type="text"
                value={u}
                onChange={(e) => updateUrl(i, e.target.value)}
                placeholder={`${t("agents_competitor.competitor")} ${i + 1} URL — e.g. competitor.com`}
                className="flex-1 text-[13px] bg-transparent outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
            {urls.length > 1 && (
              <button
                type="button"
                onClick={() => removeUrl(i)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        <div className="flex gap-3 pt-1">
          {urls.length < 5 && (
            <button
              type="button"
              onClick={addUrl}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: "var(--text-secondary)" }}
            >
              <Plus className="w-3.5 h-3.5" /> {t("agents_competitor.add_competitor")}
            </button>
          )}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            disabled={loading || !urls.some((u) => u.trim())}
            className="ml-auto px-6 py-2.5 rounded-xl font-bold text-white text-[13px] flex items-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #0891b2, #2563eb)" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? t("agents_competitor.analyzing") : t("agents_competitor.run_analysis")}
          </motion.button>
        </div>
      </motion.form>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 rounded-2xl skeleton-loader" />
            ))}
            <p className="text-center text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                📊 {t("agents_competitor.loading_metrics")}
              </motion.span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {results && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {results.map((r, i) => (
              <motion.div
                key={r.domain}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {/* Domain header */}
                <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(8,145,178,0.1)" }}
                    >
                      <Globe className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[15px]" style={{ color: "var(--text-primary)" }}>
                          {r.domain}
                        </span>
                        <a href={`https://${r.domain}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" />
                        </a>
                      </div>
                      <VsBadge vs={r.vs} />
                    </div>
                  </div>

                  <button
                    onClick={() => setAddedDomains((prev) => [...prev, r.domain])}
                    disabled={addedDomains.includes(r.domain)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-60"
                    style={
                      addedDomains.includes(r.domain)
                        ? { background: "#10b981", color: "white" }
                        : {
                            background: "linear-gradient(135deg, #2563eb, #6366f1)",
                            color: "white",
                            boxShadow: "0 2px 8px rgba(37,99,235,0.2)",
                          }
                    }
                  >
                    {addedDomains.includes(r.domain) ? (
                      <><CheckCircle className="w-3.5 h-3.5" /> {t("agents_competitor.added")}</>
                    ) : (
                      <><UserPlus className="w-3.5 h-3.5" /> {t("agents_competitor.add_as_lead")}</>
                    )}
                  </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: t("agents_competitor.domain_rating"), value: r.dr, suffix: "/100", color: r.dr > 60 ? "#ef4444" : r.dr > 40 ? "#f59e0b" : "#10b981" },
                    { label: t("agents_competitor.organic_traffic"), value: r.traffic, suffix: "/mo", color: "#2563eb" },
                    { label: t("agents_competitor.ranked_keywords"), value: r.keywords.toLocaleString(), suffix: "", color: "#7c3aed" },
                    { label: t("agents_competitor.backlinks"), value: r.backlinks, suffix: "", color: "#0891b2" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="flex flex-col gap-1 p-3 rounded-xl text-center"
                      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        {m.label}
                      </span>
                      <span className="text-xl font-extrabold" style={{ color: m.color }}>
                        {m.value}
                        {m.suffix && <span className="text-xs font-medium text-gray-400">{m.suffix}</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <Star className="w-3 h-3 text-amber-400" /> {t("agents_competitor.strengths")}
                    </p>
                    <ul className="space-y-1.5">
                      {r.strengths.map((s, j) => (
                        <li key={j} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <AlertTriangle className="w-3 h-3 text-green-500" /> {t("agents_competitor.weaknesses")}
                    </p>
                    <ul className="space-y-1.5">
                      {r.weaknesses.map((w, j) => (
                        <li key={j} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
