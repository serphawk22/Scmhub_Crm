"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { useRole } from "@/context/RoleContext";
import { API_BASE_URL } from "@/config";
import { Lock, Mail, Loader2, Eye, EyeOff, ArrowRight, Globe, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import "@/i18n/config";


// ── Language options shown on the Sign Up page: English + Spanish ONLY ──────
const SIGNUP_LANGUAGES = [
  { code: "en", nativeName: "English", name: "English", flag: "🇺🇸" },
  { code: "es", nativeName: "Español", name: "Spanish", flag: "🇪🇸" },
] as const;

function SignupLanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentCode = SIGNUP_LANGUAGES.find((l) => l.code === i18n.language)
    ? i18n.language
    : "en";

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const changeLanguage = (code: string) => {
    setIsOpen(false);
    i18n.changeLanguage(code);
    localStorage.setItem("crm-language", code);
    localStorage.setItem("language", code);

    if (code === "en") {
      sessionStorage.setItem("crm_gt_restore_en", "1");
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`;
      window.location.reload();
    } else {
      document.cookie = `googtrans=/en/${code}; path=/;`;
      document.cookie = `googtrans=/en/${code}; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=/en/${code}; path=/; domain=.${window.location.hostname}`;
      document.documentElement.classList.remove("notranslate");
      document.documentElement.removeAttribute("translate");
      const tryTrigger = (attempts = 0) => {
        const sel = document.querySelector<HTMLSelectElement>(".goog-te-combo");
        if (sel) { sel.value = code; sel.dispatchEvent(new Event("change")); }
        else if (attempts < 25) setTimeout(() => tryTrigger(attempts + 1), 100);
      };
      tryTrigger();
    }
  };

  const current = SIGNUP_LANGUAGES.find((l) => l.code === currentCode) ?? SIGNUP_LANGUAGES[0];

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border text-sm font-semibold ${
          isOpen
            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
            : "hover:bg-slate-50 border-transparent text-slate-600 hover:border-slate-200"
        }`}
      >
        <Globe className="w-4 h-4 text-slate-400" />
        <span className="hidden sm:block">Language</span>
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-base leading-none">{current.flag}</span>
          <span className="uppercase text-[10px] font-black tracking-wider text-slate-400">
            {current.code}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Select Language
              </p>
            </div>
            <div className="p-2 space-y-1">
              {SIGNUP_LANGUAGES.map((lang) => {
                const isActive = lang.code === currentCode;
                return (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group text-left ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg leading-none">{lang.flag}</span>
                      <div className="flex flex-col">
                        <span className={`text-sm font-semibold leading-tight ${isActive ? "text-indigo-700" : "group-hover:text-indigo-600"}`}>
                          {lang.nativeName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{lang.name}</span>
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FEATURES = [

  { icon: "🚀", title: "Growth Engine", desc: "Radar analysis & AI-powered outreach" },
  { icon: "📊", title: "Smart Pipeline", desc: "Visual sales tracking in real-time" },
  { icon: "🤖", title: "AI Automations", desc: "Let AI handle repetitive workflows" },
  { icon: "💼", title: "Client CRM", desc: "360° view of every client relationship" },
];

function FloatingCard({
  icon,
  title,
  desc,
  delay,
  x,
  y,
}: {
  icon: string;
  title: string;
  desc: string;
  delay: number;
  x: string;
  y: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className="absolute hidden lg:flex items-start gap-3 p-4 rounded-2xl backdrop-blur-md shadow-xl"
      style={{
        left: x,
        top: y,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.12)",
        maxWidth: 220,
      }}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-white font-semibold text-sm leading-tight">{title}</p>
        <p className="text-blue-200/70 text-xs mt-0.5">{desc}</p>
      </div>
    </motion.div>
  );
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "email" | "password" | null>(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const { login } = useRole();
  const router = useRouter();

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleSubmitting(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE_URL}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Google login failed");
        
        localStorage.setItem("crm_user", JSON.stringify(data.user));
        
        if (data.is_new_user) {
          window.location.href = "/onboarding";
        } else {
          window.location.href = "/dashboard";
        }
      } catch (err: any) {
        setError(err.message || "An error occurred with Google Login.");
      } finally {
        setGoogleSubmitting(false);
      }
    },
    onError: () => {
      setError("Google Login failed. Please try again.");
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/demo/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create account");
      
      // Attempt login after signup
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden font-sans">
      {/* ── LEFT PANEL – Visual branding ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative flex-col items-center justify-center overflow-hidden p-12"
        style={{
          background: "linear-gradient(135deg, #0f1729 0%, #111827 40%, #0d1f5c 100%)",
        }}
      >
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)",
            top: "-15%",
            left: "-15%",
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
            bottom: "-10%",
            right: "-10%",
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* Grid pattern */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="lgrid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lgrid)" />
        </svg>

        {/* Floating feature cards */}
        <FloatingCard {...FEATURES[0]} delay={0.5} x="5%" y="12%" />
        <FloatingCard {...FEATURES[1]} delay={0.7} x="62%" y="10%" />
        <FloatingCard {...FEATURES[2]} delay={0.9} x="5%" y="74%" />
        <FloatingCard {...FEATURES[3]} delay={1.1} x="62%" y="78%" />

        {/* Center brand content */}
        <motion.div
          className="relative z-10 flex flex-col items-center text-center gap-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Logo */}
          <motion.div
            className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
              boxShadow: "0 0 60px rgba(37,99,235,0.4)",
            }}
            animate={{
              boxShadow: [
                "0 0 40px rgba(37,99,235,0.3)",
                "0 0 80px rgba(99,102,241,0.5)",
                "0 0 40px rgba(37,99,235,0.3)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3L3 8.5V15.5L12 21L21 15.5V8.5L12 3Z" fill="white" fillOpacity="0.9" />
              <path d="M12 7L7 10V14L12 17L17 14V10L12 7Z" fill="white" fillOpacity="0.5" />
              <circle cx="12" cy="12" r="2" fill="white" />
            </svg>
          </motion.div>

          <div>
            <h1 className="text-5xl font-extrabold text-white tracking-tight leading-none mb-3">
              SERP Hawk
              <span
                className="block mt-1 text-3xl font-bold"
                style={{
                  background: "linear-gradient(90deg, #60a5fa, #818cf8, #a78bfa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Growth Platform
              </span>
            </h1>
            <p className="text-blue-200/70 text-lg font-medium max-w-xs mx-auto leading-relaxed">
              The all-in-one CRM for SEO agencies that want to dominate their market.
            </p>
          </div>

          {/* Stats row */}
          <motion.div
            className="flex items-center gap-8 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {[
              { value: "500+", label: "Clients Managed" },
              { value: "98%", label: "Retention Rate" },
              { value: "3x", label: "Revenue Growth" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-extrabold text-white">{stat.value}</p>
                <p className="text-xs font-medium text-blue-300/60 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ── RIGHT PANEL – Login form ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative"
        style={{ background: "#ffffff" }}
      >
        {/* Language selector in top right — English + Spanish only */}
        <div className="absolute top-5 right-6 z-20">
          <SignupLanguageSwitcher />
        </div>

        {/* Mobile logo (shows only on small screens) */}
        <div className="lg:hidden mb-8 flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
            style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7">
              <path d="M12 3L3 8.5V15.5L12 21L21 15.5V8.5L12 3Z" fill="white" fillOpacity="0.9" />
              <path d="M12 7L7 10V14L12 17L17 14V10L12 7Z" fill="white" fillOpacity="0.5" />
              <circle cx="12" cy="12" r="2" fill="white" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">SERP Hawk CRM</h2>
        </div>

        <motion.div
          className="w-full max-w-[420px]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
              Create Demo Account
            </h2>
            <p className="text-gray-500 text-[15px] font-medium">
              Join the SERP Hawk CRM showcase
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Full Name
              </label>
              <div
                className={`relative flex items-center rounded-xl border transition-all duration-200 ${
                  focusedField === "name"
                    ? "border-blue-500 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="absolute left-4 w-4 h-4 text-gray-400">👤</div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full pl-11 pr-4 py-3.5 bg-transparent border-none text-[15px] font-medium text-gray-900 placeholder:text-gray-400 focus:ring-0 outline-none"
                  placeholder="John Doe"
                />
              </div>
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Email Address
              </label>
              <div
                className={`relative flex items-center rounded-xl border transition-all duration-200 ${
                  focusedField === "email"
                    ? "border-blue-500 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Mail
                  className={`absolute left-4 w-4 h-4 transition-colors ${
                    focusedField === "email" ? "text-blue-500" : "text-gray-400"
                  }`}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full pl-11 pr-4 py-3.5 bg-transparent text-gray-900 placeholder-gray-400 text-[15px] outline-none rounded-xl"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div
                className={`relative flex items-center rounded-xl border transition-all duration-200 ${
                  focusedField === "password"
                    ? "border-blue-500 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Lock
                  className={`absolute left-4 w-4 h-4 transition-colors ${
                    focusedField === "password" ? "text-blue-500" : "text-gray-400"
                  }`}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full pl-11 pr-12 py-3.5 bg-transparent text-gray-900 placeholder-gray-400 text-[15px] outline-none rounded-xl"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium"
                >
                  <span className="text-base">⚠️</span>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <motion.button
                type="submit"
                whileHover={{ scale: isSubmitting ? 1 : 1.01, y: isSubmitting ? 0 : -1 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                disabled={isSubmitting || !name || !email || !password}
                className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-[15px] font-bold rounded-xl text-white shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background:
                    isSubmitting || (!name || !email || !password)
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #2563eb, #4f46e5)",
                }}
              >
                <span className="relative flex items-center gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </motion.button>

              <Link href="/login" className="flex-1">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full h-full py-4 rounded-xl font-bold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-[15px] flex items-center justify-center gap-2.5 transition-all shadow-sm"
                >
                  Sign In Instead
                  <ArrowRight className="w-4 h-4 opacity-50" />
                </motion.button>
              </Link>
            </div>

            {/* Divider */}
            <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">Or continue with</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={() => googleLogin()}
              disabled={googleSubmitting}
              className="w-full relative py-3.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 text-[15px] flex items-center justify-center gap-3 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {googleSubmitting ? "Authenticating..." : "Continue with Google"}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-gray-400 text-sm font-medium mt-8">
            Authorized personnel only.{" "}
            <a
              href="mailto:support@serphawk.com"
              className="text-blue-600 font-semibold hover:underline"
            >
              Contact Support
            </a>
          </p>

          {/* Security badges */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {["🔒 SSL Secured", "🛡️ SOC 2", "🔑 2FA Ready"].map((badge) => (
              <span
                key={badge}
                className="text-[11px] font-medium text-gray-400"
              >
                {badge}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
