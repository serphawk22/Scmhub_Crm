"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Shield, CheckCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/config";

interface EmailOTPVerificationProps {
  email: string;
  purpose?: "smtp_settings" | "integration" | "signup";
  autoSend?: boolean;
  onVerified: () => void;
  onCancel?: () => void;
}

export default function EmailOTPVerification({
  email,
  purpose = "smtp_settings",
  autoSend = false,
  onVerified,
  onCancel,
}: EmailOTPVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [debugOtp, setDebugOtp] = useState("");

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (autoSend && email) {
      sendOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendOtp = async () => {
    setSending(true);
    setError("");
    setDebugOtp("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/email-otp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to send OTP");
        return;
      }
      setSent(true);
      setResendTimer(60);
      if (data.debug_otp) {
        setDebugOtp(data.debug_otp);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    // Auto-focus next input
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
    // Auto-submit when all 6 digits entered
    if (newOtp.every((d) => d !== "")) {
      verifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      const newOtp = paste.split("");
      setOtp(newOtp);
      verifyOtp(paste);
    }
  };

  const verifyOtp = async (code: string) => {
    setVerifying(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/email-otp/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, otp_code: code, purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Invalid OTP code");
        setOtp(["", "", "", "", "", ""]);
        document.getElementById("otp-0")?.focus();
        return;
      }
      setVerified(true);
      setTimeout(() => onVerified(), 1200);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4"
        >
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </motion.div>
        <p className="font-bold text-lg text-slate-800 dark:text-zinc-100">Email Verified!</p>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
          {email} has been verified successfully.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
          <Shield size={20} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">Verify Email Address</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            We'll send a 6-digit code to <span className="font-semibold">{email}</span>
          </p>
        </div>
      </div>

      {/* Send OTP Button */}
      {!sent && (
        <button
          onClick={sendOtp}
          disabled={sending || !email}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-sm"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Mail size={16} />
          )}
          {sending ? "Sending verification code..." : "Send Verification Code"}
        </button>
      )}

      {/* OTP Input */}
      {sent && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-zinc-300 text-center">
            Enter the 6-digit code sent to your email
          </p>
          <div className="flex justify-center gap-2">
            {otp.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                disabled={verifying}
                className="w-11 h-12 text-center text-lg font-bold rounded-xl border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
            ))}
          </div>

          {debugOtp && (
            <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                Demo mode: email delivery is not configured
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Use this code to continue:{" "}
                <span className="font-mono font-bold tracking-widest text-lg">{debugOtp}</span>
              </p>
            </div>
          )}

          {verifying && (
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
              <Loader2 size={14} className="animate-spin" />
              Verifying...
            </div>
          )}

          {/* Resend */}
          <div className="flex justify-center">
            {resendTimer > 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                Resend code in {resendTimer}s
              </p>
            ) : (
              <button
                onClick={sendOtp}
                disabled={sending}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <RefreshCw size={12} />
                Resend Code
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
