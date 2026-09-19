import re

with open('frontend/src/app/signup/page.tsx', 'r') as f:
    signup_content = f.read()

with open('frontend/src/app/login/page.tsx', 'r') as f:
    login_content = f.read()

# We want to extract the right panel (visual abstract) from login_content
right_panel_match = re.search(r'\{/\* ── RIGHT PANEL \(Visual/Abstract\) ── \*/\}(.*?)\s+</div>\s+</div>\s+\);\s+\}', login_content, re.DOTALL)
right_panel = right_panel_match.group(0) if right_panel_match else ""

# We want to use the SignupLanguageSwitcher from signup_content
signup_lang_match = re.search(r'const SIGNUP_LANGUAGES = \[.*?\] as const;\s+function SignupLanguageSwitcher\(\) \{.*?\}\s+(?=const FEATURES|export default)', signup_content, re.DOTALL)
signup_lang = signup_lang_match.group(0) if signup_lang_match else ""

# The new signup page will combine:
# 1. Imports from signup_content (but we ensure they match what's needed for the dark layout)
imports = """"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";
import { API_BASE_URL } from "@/config";
import { Lock, Mail, Loader2, Eye, EyeOff, ArrowRight, Globe, ChevronDown, Check, Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import EmailOTPVerification from "@/components/EmailOTPVerification";
import { useTranslation } from "react-i18next";
import "@/i18n/config";

"""

# 2. SignupLanguageSwitcher logic
# but we need to adjust its CSS classes to match the dark theme in LoginLanguageSwitcher
dark_signup_lang = signup_lang.replace('bg-white border border-slate-200', 'bg-[#0a0a0a] border border-zinc-800')
dark_signup_lang = dark_signup_lang.replace('hover:bg-slate-50 border-transparent text-slate-600 hover:border-slate-200', 'hover:bg-zinc-800 border-transparent text-zinc-400 hover:border-zinc-700')
dark_signup_lang = dark_signup_lang.replace('bg-slate-50', 'bg-zinc-900')
dark_signup_lang = dark_signup_lang.replace('border-slate-100', 'border-zinc-800')
dark_signup_lang = dark_signup_lang.replace('text-slate-500', 'text-zinc-400')
dark_signup_lang = dark_signup_lang.replace('text-slate-700', 'text-zinc-300')
dark_signup_lang = dark_signup_lang.replace('hover:bg-slate-50', 'hover:bg-zinc-900')
dark_signup_lang = dark_signup_lang.replace('text-slate-400', 'text-zinc-500')

# 3. Main Component logic
main_logic = """
export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "email" | "password" | null>(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useRole();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  function suggestPassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnpqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%^&*";
    const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
    const parts = [
      rand(upper), rand(lower), rand(digits), rand(symbols),
      Array.from({ length: 8 }, () => rand(upper + lower + digits + symbols)).join(""),
    ];
    const shuffled = parts
      .map((part) => part.split(""))
      .flat()
      .sort(() => Math.random() - 0.5)
      .join("");
    return shuffled.slice(0, 16);
  }

  const useSuggestedPassword = () => {
    const pw = suggestPassword();
    setPassword(pw);
    setShowPassword(true);
  };

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
    setError("");
    setVerifyingOtp(true);
  };

  const createAccount = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/demo/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("auth.demo_failed_signup"));
      
      await login(email, password);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || t("auth.unexpected_error"));
      setVerifyingOtp(false);
      setIsSubmitting(false);
    }
  };

  if (!mounted) return <div className="min-h-screen bg-[#0a0a0a]" />;
"""

# 4. JSX Layout
jsx_layout = """
  return (
    <div className="min-h-screen w-full flex bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-hidden">
      
      {/* ── LEFT PANEL (Form) ── */}
      <div className="flex-1 flex flex-col justify-center relative z-20 px-6 sm:px-12 lg:px-24 xl:px-32">
        <div className="w-full max-w-[440px] mx-auto flex flex-col">
          
          <div className="absolute top-5 right-6 z-20">
            <SignupLanguageSwitcher />
          </div>

          <div className="flex items-center gap-3 mb-12">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L3 8.5V15.5L12 21L21 15.5V8.5L12 3Z" fill="#0a0a0a" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight text-zinc-100">{t("auth.app_name")}</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 mb-2">{t("auth.signup_title") || "Create Demo Account"}</h1>
            <p className="text-zinc-400 text-sm">{t("auth.signup_subtitle") || "Join the SERP Hawk CRM showcase"}</p>
          </div>

          {verifyingOtp ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
            >
              <EmailOTPVerification
                email={email}
                purpose="signup"
                autoSend
                onVerified={createAccount}
                onCancel={() => setVerifyingOtp(false)}
              />
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">{t("auth.full_name") || "Full Name"}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-zinc-500 text-sm">👤</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                      placeholder={t("auth.name_placeholder") || "John Doe"}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">{t("auth.email_label") || "Email Address"}</label>
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
                    <label className="text-xs font-medium text-zinc-400">{t("auth.password_label") || "Password"}</label>
                    <button
                      type="button"
                      onClick={useSuggestedPassword}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                      title={t("auth.suggest_password")}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t("auth.suggest_password") || "Suggest Password"}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-zinc-500" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                      placeholder={t("auth.enter_password") || "Enter your password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrengthMeter password={password} />
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
                  disabled={isSubmitting || !name || !email || !password}
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {t("auth.create_account") || "Create Account"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                
                <Link href="/login" className="flex-1">
                  <button
                    type="button"
                    className="w-full h-full py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center"
                  >
                    {t("auth.sign_in_instead") || "Sign In Instead"}
                  </button>
                </Link>
              </div>

              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink-0 mx-4 text-zinc-500 text-xs">{t("auth.or") || "OR"}</span>
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
                {googleSubmitting ? (t("auth.authenticating") || "Authenticating...") : (t("auth.continue_google") || "Continue with Google")}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-zinc-500">
            {t("auth.already_have_account") || "Already have an account?"}{" "}
            <Link href="/login" className="text-zinc-300 hover:text-white underline underline-offset-4 transition-colors">
              {t("auth.sign_in") || "Sign In"}
            </Link>
          </p>
        </div>
      </div>

"""

final_content = imports + dark_signup_lang + main_logic + jsx_layout + right_panel

with open('frontend/src/app/signup/page.tsx', 'w') as f:
    f.write(final_content)

print("Generated signup/page.tsx successfully!")
