"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { Lock, Mail, Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LanguageSelector from "@/components/LanguageSelector";

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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
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
        if (!data.user || !data.user.email) {
          throw new Error("No email found in Google account. Please verify your email.");
        }
        
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
    
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.message || "Invalid credentials. Please try again.");
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
        {/* Language selector in top right */}
        <div className="absolute top-5 right-6 z-20">
          <LanguageSelector />
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
              Welcome back
            </h2>
            <p className="text-gray-500 text-[15px] font-medium">
              Sign in to your workspace to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                onClick={() => {
                  setEmail("admin@serphawk.com");
                  setPassword("password");
                  setError("Demo credentials autofilled.");
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Use Demo Account
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
                disabled={isSubmitting}
                whileHover={{ scale: isSubmitting ? 1 : 1.01, y: isSubmitting ? 0 : -1 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                className="relative flex-1 py-4 rounded-xl font-bold text-white text-[15px] flex items-center justify-center gap-2.5 overflow-hidden transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                  boxShadow: "0 4px 20px rgba(37,99,235,0.35)",
                }}
              >
                {/* Shimmer */}
                {!isSubmitting && (
                  <motion.div
                    className="absolute inset-0 opacity-20"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                  />
                )}

                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>

              <Link href="/signup" className="flex-1">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full h-full py-4 rounded-xl font-bold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-[15px] flex items-center justify-center gap-2.5 transition-all shadow-sm"
                >
                  Create Demo
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
