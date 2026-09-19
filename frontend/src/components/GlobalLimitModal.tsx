"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, Rocket, CheckCircle2 } from "lucide-react";
import { API_BASE_URL } from "@/config";

export function GlobalLimitModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [limitType, setLimitType] = useState<string>("feature");
  const [message, setMessage] = useState<string>("You have reached the limit for this feature.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleLimitReached = (e: CustomEvent) => {
      setLimitType(e.detail?.limit_type || "feature");
      setMessage(e.detail?.message || "You have reached the limit for this feature.");
      setSuccess(false);
      setIsOpen(true);
    };

    window.addEventListener("limit-reached", handleLimitReached as EventListener);
    return () => window.removeEventListener("limit-reached", handleLimitReached as EventListener);
  }, []);

  const handleRequestUpgrade = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tenant/request-upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit_type: limitType })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setIsOpen(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl overflow-hidden"
          >
            {/* Background effects */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
            
            <button
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 bg-slate-100 dark:bg-zinc-800 rounded-full transition-colors z-10"
            >
              <X size={16} />
            </button>

            {!success ? (
              <div className="flex flex-col items-center text-center mt-4 relative z-10">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                
                <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mb-2">
                  Trial Limit Reached
                </h2>
                
                <p className="text-slate-500 dark:text-zinc-400 mb-8 max-w-sm">
                  {message}
                </p>

                <button
                  onClick={handleRequestUpgrade}
                  disabled={isSubmitting}
                  className="w-full relative group bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-slate-900 font-bold py-4 px-6 rounded-2xl transition-all disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden flex items-center justify-center gap-2 shadow-lg"
                >
                  <Rocket size={18} className={isSubmitting ? "animate-bounce" : "group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform"} />
                  {isSubmitting ? "Sending Request..." : "Request Plan Upgrade"}
                </button>
                
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-4">
                  Our team will be notified and will reach out to help you upgrade your account limits.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center mt-4 py-6 relative z-10">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mb-2">
                  Request Sent!
                </h2>
                <p className="text-slate-500 dark:text-zinc-400 max-w-sm">
                  Your upgrade request has been sent to our team. We'll be in touch shortly to assist you.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
