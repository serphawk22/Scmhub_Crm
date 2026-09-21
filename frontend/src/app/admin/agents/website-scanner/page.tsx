"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Search,
  Loader2,
  ExternalLink,
  UserPlus,
  CheckCircle,
  AlertCircle,
  X,
  Building2,
  Mail,
  Phone,
  MapPin,
  Star,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface SiteData {
  url: string;
  title: string;
  description: string;
  industry: string;
  score: number;
  issues: string[];
  opportunities: string[];
  tech: string[];
}

function mockAnalyze(url: string): Promise<SiteData> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const domain = url.replace(/https?:\/\//, "").split("/")[0];
      resolve({
        url,
        title: domain.charAt(0).toUpperCase() + domain.slice(1).replace(/\./g, " "),
        description: `${domain} is a business website that could benefit from SEO optimization and growth services.`,
        industry: ["E-Commerce", "SaaS", "Agency", "Healthcare", "Finance", "Real Estate"][
          Math.floor(Math.random() * 6)
        ],
        score: Math.floor(Math.random() * 40) + 40,
        issues: [
          "Missing meta descriptions on 12 pages",
          "Slow page load speed (4.2s avg)",
          "No structured data / schema markup",
          "Weak backlink profile (DR 18)",
          "Mobile UX issues detected",
        ],
        opportunities: [
          "Local SEO — high-volume keywords untapped",
          "Content gap: 40+ competitor keywords missing",
          "Email capture funnel not optimized",
          "Google Business Profile incomplete",
        ],
        tech: ["WordPress", "Cloudflare", "Google Analytics", "WooCommerce"].slice(
          0,
          Math.floor(Math.random() * 3) + 2
        ),
      });
    }, 2500);
  });
}

function ScoreRing({ score }: { score: number }) {
  const { t } = useLanguage();
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <motion.circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          className="text-2xl font-extrabold"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
          {t("agents_scanner.seo_score")}
        </span>
      </div>
    </div>
  );
}

function AddClientModal({
  siteData,
  onClose,
  onAdd,
}: {
  siteData: SiteData;
  onClose: () => void;
  onAdd: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(siteData.title);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    await new Promise((r) => setTimeout(r, 1500));
    setAdding(false);
    setDone(true);
    setTimeout(onAdd, 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {done ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4 py-8 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{t("agents_scanner.client_added")}</h3>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                {name} {t("agents_scanner.added_to_crm")}
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {t("agents_scanner.add_as_client")}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {siteData.url}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { icon: Building2, label: t("agents_scanner.business_name"), value: name, set: setName, type: "text", placeholder: t("agents_scanner.ph_company_name") },
                { icon: Mail, label: t("agents_scanner.email"), value: email, set: setEmail, type: "email", placeholder: "contact@company.com" },
                { icon: Phone, label: t("agents_scanner.phone"), value: phone, set: setPhone, type: "tel", placeholder: "+1 234 567 8900" },
                { icon: MapPin, label: t("agents_scanner.location"), value: location, set: setLocation, type: "text", placeholder: t("agents_scanner.ph_city_country") },
              ].map(({ icon: Icon, label, value, set, type, placeholder }) => (
                <div key={label}>
                  <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    {label}
                  </label>
                  <div
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
                    <input
                      type={type}
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      className="flex-1 text-[13px] bg-transparent outline-none"
                      style={{ color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Website summary */}
            <div
              className="mt-4 p-3 rounded-xl flex items-center gap-3"
              style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)" }}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {t("agents_scanner.seo_score")} {siteData.score}/100 · {siteData.industry}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {siteData.issues.length} {t("agents_scanner.issues")} · {siteData.opportunities.length} {t("agents_scanner.growth_opportunities")}
                </p>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={adding}
              className="mt-5 w-full py-3 rounded-xl font-bold text-white text-[14px] flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #2563eb, #6366f1)",
                boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
              }}
            >
              {adding ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t("agents_scanner.adding_to_crm")}</>
              ) : (
                <><UserPlus className="w-4 h-4" /> {t("agents_scanner.add_as_client")}</>
              )}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function WebsiteScannerPage() {
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [addedUrls, setAddedUrls] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem("websiteScannerUrl");
    const savedData = localStorage.getItem("websiteScannerData");
    if (savedUrl) setUrl(savedUrl);
    if (savedData) {
      try { setSiteData(JSON.parse(savedData)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("websiteScannerUrl", url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem("websiteScannerData", JSON.stringify(siteData));
  }, [siteData]);

  const handleScan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) return;

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http")) cleanUrl = "https://" + cleanUrl;

    setError("");
    setSiteData(null);
    setLoading(true);

    try {
      const data = await mockAnalyze(cleanUrl);
      setSiteData(data);
    } catch {
      setError(t("agents_scanner.scan_error"));
    } finally {
      setLoading(false);
    }
  };

  const isAdded = siteData && addedUrls.includes(siteData.url);

  return (
    <div className="min-h-screen py-8 px-4 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}
          >
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {t("agents_scanner.title")}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t("agents_scanner.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search bar */}
      <motion.form
        onSubmit={handleScan}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-3 mb-8"
      >
        <div
          className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <Globe className="w-5 h-5 shrink-0" style={{ color: "var(--text-secondary)" }} />
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("agents_scanner.placeholder_url")}
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {url && (
            <button type="button" onClick={() => { setUrl(""); setSiteData(null); }}>
              <X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
            </button>
          )}
        </div>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={loading || !url.trim()}
          className="px-6 py-3 rounded-2xl font-bold text-white text-[14px] flex items-center gap-2 disabled:opacity-50 transition-all"
          style={{
            background: "linear-gradient(135deg, #2563eb, #6366f1)",
            boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
          }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? t("agents_scanner.scanning") : t("agents_scanner.scan")}
        </motion.button>
      </motion.form>

      {/* Loading skeleton */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl skeleton-loader"
                style={{ opacity: 1 - i * 0.2 }}
              />
            ))}
            <p
              className="text-center text-sm font-medium mt-4"
              style={{ color: "var(--text-secondary)" }}
            >
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🔍 {t("agents_scanner.crawling")}
              </motion.span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl mb-6"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-500">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {siteData && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Overview card */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
              }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  {/* Favicon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, #2563eb20, #6366f120)", border: "1px solid var(--border)" }}
                  >
                    <Globe className="w-6 h-6" style={{ color: "#2563eb" }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                      {siteData.title}
                    </h2>
                    <a
                      href={siteData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[12px] font-medium text-blue-500 hover:underline"
                    >
                      {siteData.url} <ExternalLink className="w-3 h-3" />
                    </a>
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: "rgba(37,99,235,0.1)", color: "#2563eb" }}
                    >
                      {siteData.industry}
                    </span>
                  </div>
                </div>

                <ScoreRing score={siteData.score} />
              </div>

              <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                {siteData.description}
              </p>

              {/* Tech stack */}
              <div className="mt-4 flex flex-wrap gap-2">
                {siteData.tech.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                    style={{ background: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Issues & Opportunities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Issues */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <h3 className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>
                    {t("agents_scanner.issues_found")}
                  </h3>
                  <span className="ml-auto text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                    {siteData.issues.length}
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {siteData.issues.map((issue, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-2 text-[13px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      {issue}
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Opportunities */}
              <div
                className="rounded-2xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <h3 className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>
                    {t("agents_scanner.opportunities")}
                  </h3>
                  <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {siteData.opportunities.length}
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {siteData.opportunities.map((opp, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-2 text-[13px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      {opp}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CTA — Add as Client */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
              style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(99,102,241,0.06))",
                border: "1px solid rgba(37,99,235,0.15)",
              }}
            >
              <div>
                <h3 className="font-bold text-[15px]" style={{ color: "var(--text-primary)" }}>
                  {isAdded ? t("agents_scanner.added_to_crm_badge") : t("agents_scanner.ready_onboard")}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {isAdded
                    ? `${siteData.title} ${t("agents_scanner.now_in_client_list")}`
                    : `${siteData.issues.length} ${t("agents_scanner.issues_to_fix")} + ${siteData.opportunities.length} ${t("agents_scanner.growth_opps")}`}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: isAdded ? 1 : 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => !isAdded && setShowModal(true)}
                disabled={!!isAdded}
                className="px-6 py-3 rounded-xl font-bold text-[14px] flex items-center gap-2 transition-all"
                style={
                  isAdded
                    ? { background: "#10b981", color: "white", cursor: "default" }
                    : {
                        background: "linear-gradient(135deg, #2563eb, #6366f1)",
                        color: "white",
                        boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
                      }
                }
              >
                {isAdded ? (
                  <><CheckCircle className="w-4 h-4" /> {t("agents_scanner.client_added")}</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> {t("agents_scanner.add_as_client")}</>
                )}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showModal && siteData && (
          <AddClientModal
            siteData={siteData}
            onClose={() => setShowModal(false)}
            onAdd={() => {
              setAddedUrls((prev) => [...prev, siteData.url]);
              setShowModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
