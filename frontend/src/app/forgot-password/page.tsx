"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/config";
import { Loader2, ArrowRight, ShieldCheck, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AuthThemeToggle from "@/components/AuthThemeToggle";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Backend returns 200 regardless of whether email exists to prevent user enumeration
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
          
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors mb-6 group uppercase tracking-widest">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back to login
          </Link>

          {!success ? (
            <>
              <div className="flex flex-col items-start mb-8 text-left">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Reset password</h1>
                <p className="text-slate-500 dark:text-zinc-400 text-sm">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                  disabled={isSubmitting || !email}
                  className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold tracking-wide transition-all shadow-md hover:shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-70 disabled:scale-100 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-6 shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Check your inbox</h2>
              <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed mb-8">
                We've sent a password reset link to <br/>
                <span className="font-semibold text-slate-900 dark:text-zinc-200">{email}</span>. <br/>
                Please check your email and click the link to reset your password.
              </p>
              
              <Link 
                href="/login"
                className="w-full py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl text-sm font-bold tracking-wide transition-all shadow-md hover:shadow-lg flex items-center justify-center"
              >
                Return to Login
              </Link>
            </motion.div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
