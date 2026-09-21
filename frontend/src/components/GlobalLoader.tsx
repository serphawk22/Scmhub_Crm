"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const STEPS = [
  "Initializing workspace…",
  "Loading your data…",
  "Connecting services…",
  "Almost ready…",
];

function OrbitRing({
  radius,
  duration,
  delay,
  dotSize = 6,
  color,
}: {
  radius: number;
  duration: number;
  delay: number;
  dotSize?: number;
  color: string;
}) {
  return (
    <motion.div
      className="absolute"
      style={{
        width: radius * 2,
        height: radius * 2,
        top: "50%",
        left: "50%",
        marginTop: -radius,
        marginLeft: -radius,
        borderRadius: "50%",
      }}
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear", delay }}
    >
      {/* Ring circle (static, faint) */}
      <span
        className="absolute inset-0 rounded-full border"
        style={{ borderColor: color, opacity: 0.15 }}
      />
      {/* Orbiting dot */}
      <span
        className="absolute rounded-full shadow-md"
        style={{
          width: dotSize,
          height: dotSize,
          background: color,
          top: 0,
          left: "50%",
          marginLeft: -dotSize / 2,
          marginTop: -dotSize / 2,
          boxShadow: `0 0 ${dotSize * 3}px ${color}`,
        }}
      />
    </motion.div>
  );
}

function Particle({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * 360;
  const distance = 90 + Math.random() * 40;
  const x = Math.cos((angle * Math.PI) / 180) * distance;
  const y = Math.sin((angle * Math.PI) / 180) * distance;
  const delay = Math.random() * 1.5;
  const size = 2 + Math.random() * 3;

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: `hsl(${220 + Math.random() * 40}, 80%, 70%)`,
        top: "50%",
        left: "50%",
        marginTop: -size / 2,
        marginLeft: -size / 2,
      }}
      animate={{
        x: [0, x * 0.5, x],
        y: [0, y * 0.5, y],
        opacity: [0, 1, 0],
        scale: [0, 1.5, 0],
      }}
      transition={{
        duration: 2.5,
        repeat: Infinity,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

export function GlobalLoader() {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stepTimer = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 1200);

    let prog = 0;
    const progressTimer = setInterval(() => {
      prog = Math.min(prog + Math.random() * 4, 92);
      setProgress(prog);
    }, 120);

    return () => {
      clearInterval(stepTimer);
      clearInterval(progressTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: "var(--background)",
      }}
    >
      {/* Subtle background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(37,99,235,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Grid lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2563eb" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Main loader container */}
      <div className="relative flex flex-col items-center gap-10">
        {/* Orbit system */}
        <div className="relative" style={{ width: 180, height: 180 }}>
          {/* Particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <Particle key={i} index={i} total={12} />
          ))}

          {/* Orbit rings */}
          <OrbitRing radius={75} duration={4} delay={0} dotSize={8} color="#2563eb" />
          <OrbitRing radius={55} duration={3} delay={-1} dotSize={6} color="#6366f1" />
          <OrbitRing radius={35} duration={2} delay={-0.5} dotSize={5} color="#8b5cf6" />

          {/* Center logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                boxShadow: [
                  "0 0 0px rgba(37,99,235,0.3)",
                  "0 0 32px rgba(37,99,235,0.5)",
                  "0 0 0px rgba(37,99,235,0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L3 8.5V15.5L12 21L21 15.5V8.5L12 3Z" fill="white" fillOpacity="0.9" />
                <path d="M12 7L7 10V14L12 17L17 14V10L12 7Z" fill="white" fillOpacity="0.5" />
                <circle cx="12" cy="12" r="2" fill="white" />
              </svg>
            </motion.div>
          </div>
        </div>

        {/* Brand + Step text */}
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.h2
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            SERP Hawk{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #2563eb, #6366f1)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              CRM
            </span>
          </motion.h2>

          {/* Animated step message */}
          <div className="h-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {STEPS[step]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-64 flex flex-col gap-2">
          <div
            className="relative h-1 rounded-full overflow-hidden"
            style={{ background: "var(--border)" }}
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: "linear-gradient(90deg, #2563eb, #6366f1, #8b5cf6)",
                backgroundSize: "200% 100%",
              }}
              animate={{
                width: `${progress}%`,
                backgroundPosition: ["0% 0%", "100% 0%"],
              }}
              transition={{
                width: { duration: 0.4, ease: "easeOut" },
                backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" },
              }}
            />
            {/* Shimmer */}
            <motion.div
              className="absolute inset-y-0 w-16 rounded-full opacity-60"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
              }}
              animate={{ left: ["-4rem", "110%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Loading workspace
            </span>
            <motion.span
              className="text-[11px] font-bold"
              style={{ color: "var(--primary)" }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {Math.round(progress)}%
            </motion.span>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              animate={{
                width: i === step ? 20 : 6,
                background: i === step ? "#2563eb" : "var(--border)",
              }}
              style={{ height: 6 }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
