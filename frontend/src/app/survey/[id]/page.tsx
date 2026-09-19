"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Star, CheckCircle } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

export default function SurveyPage() {
  const { t } = useLanguage();
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score === null) return;
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/nps/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, feedback }),
    });
    setDone(true);
    setSubmitting(false);
  }

  const getLabel = (s: number) =>
    s <= 6 ? t("survey.label_bad") : s <= 8 ? t("survey.label_ok") : t("survey.label_great");

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-50 mb-2">{t("survey.thank_you")}</h1>
          <p className="text-gray-500 dark:text-zinc-400">{t("survey.thank_you_desc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-10 w-full max-w-lg">
        <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-50 mb-2">{t("survey.heading")}</h1>
        <p className="text-gray-500 dark:text-zinc-400 mb-8">
          {t("survey.description")}
        </p>

        <form onSubmit={submit} className="space-y-6">
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={cn(
                  "w-10 h-10 rounded-xl font-black text-sm border-2 transition-all",
                  score === i
                    ? i <= 6 ? "bg-red-500 text-white border-red-500"
                      : i <= 8 ? "bg-amber-500 text-white border-amber-500"
                      : "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 border-gray-200 dark:border-zinc-700 hover:border-gray-400"
                )}
              >{i}</button>
            ))}
          </div>

          {score !== null && (
            <p className="text-center text-sm font-semibold text-gray-600 dark:text-zinc-300">{getLabel(score)}</p>
          )}

          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1 block">
              {t("survey.reason_label")}
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder={t("survey.ph_feedback")}
            />
          </div>

          <button
            type="submit"
            disabled={score === null || submitting}
            className="w-full py-3 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("survey.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
