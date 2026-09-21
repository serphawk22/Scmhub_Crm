"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useGoogleLogin } from "@react-oauth/google";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { Loader2, ArrowRight, ShieldCheck, Mail, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AuthThemeToggle from "@/components/AuthThemeToggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useRole();

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
        if (!res.ok) throw new Error(data.detail || "Google login failed");
        if (!data.user || !data.user.email) {
          throw new Error("No email found in Google account. Please verify your email.");
        }
        
        localStorage.setItem("crm_user", JSON.stringify(data.user));
        
        if (data.is_new_user) {
          window.location.href = "/onboarding";
        } else {
          window.location.href = "/";
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
    setIsSubmitting(true);
    setError("");

    try {
      const result = await login(email, password);
      
      if (result.success) {
        if (result.is_new_user) {
          window.location.href = "/onboarding";
        } else {
          window.location.href = "/";
        }
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail("admin@serphawk.com");
    setPassword("Admin123!");
    setError("");
  };

  if (!mounted) return <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0b]" />;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fafafa] dark:bg-[#0a0a0b] text-slate-900 dark:text-zinc-100 font-sans relative overflow-hidden">
      
      {/* Background Subtle Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 transition-opacity duration-500">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200 dark:bg-indigo-900/40 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-3xl opacity-50 animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-200 dark:bg-blue-900/40 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
      </div>

      <div className="absolute top-6 right-6 z-50">
        <AuthThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] px-6 relative z-10"
      >
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl rounded-3xl p-8 sm:p-10">
          
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-600/20">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L3 8.5V15.5L12 21L21 15.5V8.5L12 3Z" className="fill-white" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Welcome back</h1>
            <p className="text-slate-500 dark:text-zinc-400 text-sm">Sign in to your SERP Hawk workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 tracking-wide uppercase">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400 dark:text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-sm"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 tracking-wide uppercase">Password</label>
                  <Link href="/forgot-password" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400 dark:text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-sm"
                    placeholder="••••••••••••"
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
                  <div className="mt-1 text-sm text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3 py-2.5 rounded-lg flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl text-sm font-bold tracking-wide transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:scale-100 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 dark:text-zinc-600 text-xs font-medium uppercase tracking-widest">Or</span>
              <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
            </div>

            <button
              type="button"
              onClick={() => googleLogin()}
              disabled={googleSubmitting}
              className="w-full py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-sm text-slate-700 dark:text-zinc-300 font-semibold transition-all shadow-sm flex items-center justify-center gap-2.5 disabled:opacity-70 active:scale-[0.98]"
            >
              {googleSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 dark:text-zinc-500" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800/60 flex flex-col items-center gap-3">
            <button 
              onClick={handleDemoLogin}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Try the Admin Demo Account
            </button>
            <p className="text-center text-sm text-slate-500 dark:text-zinc-500">
              New to SERP Hawk?{" "}
              <Link href="/signup" className="text-slate-900 dark:text-zinc-200 font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Create a demo workspace
              </Link>
            </p>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
