"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";
import { Loader2, ArrowRight, ShieldCheck, Mail, Lock, CheckCircle2, Globe, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LANGUAGES = [
  { code: "en", nativeName: "English", name: "English", flag: "🇺🇸" },
  { code: "es", nativeName: "Español", name: "Spanish", flag: "🇪🇸" },
] as const;

function LoginLanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentCode = LANGUAGES.find((l) => l.code === language) ? language : "en";

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const changeLanguage = (code: string) => {
    setIsOpen(false);
    setLanguage(code);
    localStorage.setItem("crm-language", code);
    localStorage.setItem("language", code);
  };

  const current = LANGUAGES.find((l) => l.code === currentCode) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border text-sm font-semibold ${
          isOpen
            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
            : "hover:bg-zinc-800 border-transparent text-zinc-400 hover:border-zinc-700"
        }`}
      >
        <Globe className="w-4 h-4 text-zinc-500" />
        <span className="hidden sm:block">{t("auth.language")}</span>
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-base leading-none">{current.flag}</span>
          <span className="uppercase text-[10px] font-black tracking-wider text-zinc-500">{current.code}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-52 bg-[#0a0a0a] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t("auth.select_language")}</p>
            </div>
            <div className="p-2 space-y-1">
              {LANGUAGES.map((lang) => {
                const isActive = lang.code === currentCode;
                return (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group text-left ${
                      isActive ? "bg-indigo-50 text-indigo-700" : "hover:bg-zinc-900 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg leading-none">{lang.flag}</span>
                      <div className="flex flex-col">
                        <span className={`text-sm font-semibold leading-tight ${isActive ? "text-indigo-700" : "group-hover:text-indigo-600"}`}>{lang.nativeName}</span>
                        <span className="text-[10px] text-zinc-500 font-medium">{lang.name}</span>
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useRole();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

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
        if (!res.ok) throw new Error(data.detail || t("auth.google_login_error"));
        if (!data.user || !data.user.email) {
          throw new Error(t("auth.google_no_email"));
        }
        
        localStorage.setItem("crm_user", JSON.stringify(data.user));
        
        if (data.is_new_user) {
          window.location.href = "/onboarding";
        } else {
          window.location.href = "/";
        }
      } catch (err: any) {
        setError(err.message || t("auth.google_login_error"));
      } finally {
        setGoogleSubmitting(false);
      }
    },
    onError: () => {
      setError(t("auth.google_failed"));
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const result = (await login(email, password)) as {
        success: boolean;
        message?: string;
        error?: string;
        is_new_user?: boolean;
      };
      
      if (result.success) {
        if (result.is_new_user) {
          window.location.href = "/onboarding";
        } else {
          window.location.href = "/";
        }
      } else {
        setError(result.error || t("auth.login_failed"));
      }
    } catch (err: any) {
      setError(err.message || t("auth.unexpected_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail("admin@serphawk.com");
    setPassword("Admin123!");
    setError(t("auth.demo_credentials"));
  };

  if (!mounted) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="min-h-screen w-full flex bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-hidden">
      
      {/* ── LEFT PANEL (Form) ── */}
      <div className="flex-1 flex flex-col justify-center relative z-20 px-6 sm:px-12 lg:px-24 xl:px-32">
        <div className="w-full max-w-[440px] mx-auto flex flex-col">
          
          {/* Language selector in top right */}
          <div className="absolute top-5 right-6 z-20">
            <LoginLanguageSwitcher />
          </div>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L3 8.5V15.5L12 21L21 15.5V8.5L12 3Z" fill="#0a0a0a" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight text-zinc-100">{t("auth.app_name")}</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 mb-2">{t("auth.login_title")}</h1>
            <p className="text-zinc-400 text-sm">{t("auth.login_subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">{t("auth.email_label")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    placeholder={t("auth.email_placeholder")}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400">{t("auth.password_label")}</label>
                  <div className="flex items-center gap-3">
                    <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                      {t("auth.forgot_password")}
                    </Link>
                    <button type="button" onClick={handleDemoLogin} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                      {t("auth.demo_login")}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    placeholder={t("auth.password_placeholder")}
                  />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t("auth.sign_in")}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              
              <Link href="/signup" className="flex-1">
                <button
                  type="button"
                  className="w-full h-full py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center"
                >
                  {t("auth.create_demo")}
                </button>
              </Link>
            </div>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink-0 mx-4 text-zinc-500 text-xs">{t("auth.or")}</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            <button
              type="button"
              onClick={() => googleLogin()}
              disabled={googleSubmitting}
              className="w-full py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {googleSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {googleSubmitting ? t("auth.authenticating") : t("auth.continue_google")}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            {t("auth.no_account")}{" "}
            <Link href="/signup" className="text-zinc-300 hover:text-white underline underline-offset-4 transition-colors">
              {t("auth.request_access")}
            </Link>
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL (Visual/Abstract) ── */}
      <div className="relative hidden lg:flex flex-1 items-center justify-center overflow-hidden border-l border-zinc-800 bg-[#0f0f11]">
        
        {/* Subtle mesh background */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay z-10 pointer-events-none" />
        
        {/* Elegant abstract glow */}
        <div className="absolute w-[800px] h-[800px] rounded-full bg-indigo-500/10 blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-violet-500/10 blur-[100px] top-1/2 left-1/2 -translate-x-1/2 translate-y-1/4" />

        {/* Clean central graphic or quote */}
        <div className="relative z-20 max-w-md w-full px-8 flex flex-col items-start gap-8">
          <div className="w-full rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-medium text-zinc-400 uppercase tracking-widest">{t("auth.enterprise_ready")}</span>
            </div>
            <p className="text-xl font-medium text-zinc-200 leading-relaxed mb-8">
              {t("auth.testimonial")}
            </p>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800" />
              <div>
                <p className="text-sm font-semibold text-zinc-200">{t("auth.testimonial_author")}</p>
                <p className="text-xs text-zinc-500">{t("auth.testimonial_role")}</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-6 opacity-40 ml-2">
            {/* Abstract geometric accents */}
            <div className="w-2 h-2 rounded-full bg-zinc-500" />
            <div className="w-2 h-2 rounded-full bg-zinc-700" />
            <div className="w-2 h-2 rounded-full bg-zinc-700" />
          </div>
        </div>
      </div>

    </div>
  );
}
