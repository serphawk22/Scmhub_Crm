"use client";

import { CheckCircle2, Circle } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
  compact?: boolean;
}

export function getPasswordScore(password: string) {
  if (!password) return null;
  const rules = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "12+ characters", met: password.length >= 12 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /\d/.test(password) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const metCount = rules.filter((r) => r.met).length;
  const score = Math.round((metCount / rules.length) * 100);
  if (score <= 25) return { label: "Very Weak", color: "#ef4444", bar: "16%", score, rules };
  if (score <= 45) return { label: "Weak", color: "#f97316", bar: "38%", score, rules };
  if (score <= 65) return { label: "Fair", color: "#f59e0b", bar: "58%", score, rules };
  if (score <= 85) return { label: "Good", color: "#3b82f6", bar: "78%", score, rules };
  return { label: "Strong", color: "#10b981", bar: "100%", score, rules };
}

export default function PasswordStrengthMeter({ password, compact = false }: PasswordStrengthMeterProps) {
  const strength = getPasswordScore(password);

  if (!strength || !password) return null;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/50 p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: strength.bar, background: strength.color }}
          />
        </div>
        <span
          className="text-[11px] font-bold whitespace-nowrap rounded-md px-1.5 py-0.5"
          style={{ color: strength.color, background: `${strength.color}18` }}
        >
          {strength.label} · {strength.score}/100
        </span>
      </div>
      <div className={`grid gap-x-3 gap-y-1.5 mt-2 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
        {strength.rules.map((rule) => (
          <div key={rule.label} className="flex items-center gap-1.5">
            {rule.met ? (
              <CheckCircle2
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: "#10b981" }}
              />
            ) : (
              <Circle className="w-3.5 h-3.5 shrink-0 text-slate-300 dark:text-zinc-600" />
            )}
            <span
              className={`text-[11px] font-medium ${
                rule.met ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-zinc-400"
              }`}
            >
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}