"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Loader2, Sparkles, RefreshCw, Copy, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MOCK_RESPONSES: Record<string, string> = {
  default: `**Great question!** Here's a tailored approach based on your request:

**Subject:** Unlock More Patients Through Google — Quick Win for Your Practice

Hi [Name],

I came across [Business Name] while researching top dental practices in [City]. I noticed your Google presence could be significantly stronger — a few of your competitors are ranking for "emergency dentist [city]" and getting 200+ monthly calls from it.

We've helped 3 similar clinics in your area increase new patient inquiries by **40–60% within 90 days** through targeted local SEO.

Would a quick 15-min call this week make sense to see if there's a fit?

Best,
[Your Name] | SERP Hawk

---
💡 **Pro Tips:**
- Personalize the competitor mention with a real name
- Add a specific ranking data point if you have it
- Follow up 3 days later if no reply`,
};

export default function SalesCopilotPage() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);

  const SUGGESTIONS = [
    t("agents_copilot.suggestion_1"),
    t("agents_copilot.suggestion_2"),
    t("agents_copilot.suggestion_3"),
    t("agents_copilot.suggestion_4"),
  ];

  useEffect(() => {
    const saved = localStorage.getItem("salesCopilotMessages");
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) {}
    } else {
      setMessages([
        {
          role: "assistant",
          content:
            "👋 Hi! I'm your **Sales Copilot**. I can help you write cold emails, handle objections, draft proposals, and craft follow-up sequences. What would you like help with today?",
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("salesCopilotMessages", JSON.stringify(messages));
    }
  }, [messages]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;

    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");
    setLoading(true);

    await new Promise((r) => setTimeout(r, 1800));

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: MOCK_RESPONSES.default },
    ]);
    setLoading(false);
  };

  const copyMsg = (idx: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-3xl mx-auto py-6 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
          style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
        >
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {t("agents_copilot.title")}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("agents_copilot.subtitle")}
          </p>
        </div>
        <button
          onClick={() =>
            setMessages([
              {
                role: "assistant",
                content:
                  "👋 Hi! I'm your **Sales Copilot**. How can I help you today?",
              },
            ])
          }
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors hover:bg-gray-100"
          style={{ color: "var(--text-secondary)" }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t("agents_copilot.new_chat")}
        </button>
      </motion.div>

      {/* Suggestion chips */}
      {messages.length === 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap gap-2 mb-5"
        >
          {SUGGESTIONS.map((s, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => sendMessage(s)}
              className="px-3 py-2 rounded-xl text-[12px] font-medium transition-all hover:border-blue-400"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <Sparkles className="w-3 h-3 inline mr-1.5 text-blue-500" />
              {s}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1"
        style={{ scrollbarWidth: "none" }}
      >
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
              >
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[82%] group ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className="px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === "user"
                    ? { background: "#2563eb", color: "white", borderBottomRightRadius: 6 }
                    : {
                        background: "var(--surface)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                        borderBottomLeftRadius: 6,
                      }
                }
                dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\n/g, "<br/>"),
                }}
              />
              {msg.role === "assistant" && (
                <button
                  onClick={() => copyMsg(idx, msg.content)}
                  className="flex items-center gap-1 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded-md hover:bg-gray-100"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {copied === idx ? (
                    <><Check className="w-3 h-3 text-green-500" /> {t("agents_copilot.copied")}</>
                  ) : (
                    <><Copy className="w-3 h-3" /> {t("agents_copilot.copy")}</>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
            >
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#7c3aed" }} />
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {t("agents_copilot.writing")}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div
        className="flex items-end gap-3 p-3 rounded-2xl border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={t("agents_copilot.placeholder")}
          rows={2}
          className="flex-1 bg-transparent text-[13.5px] outline-none resize-none"
          style={{ color: "var(--text-primary)" }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 transition-all"
          style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
        >
          <Send className="w-4 h-4 text-white" />
        </motion.button>
      </div>
    </div>
  );
}
