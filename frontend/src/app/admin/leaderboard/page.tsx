"use client";

import { useState, useEffect, useRef } from "react";
import { Trophy, Star, Ticket, DollarSign, Camera, Download, Sparkles } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

interface LeaderboardEntry {
  user_id: number;
  name: string;
  role: string;
  deals_closed: number;
  revenue_closed: number;
  meetings_booked: number;
  calls_made: number;
  leads_managed?: number;
  clients_managed?: number;
  tickets_assigned?: number;
  tickets_in_production?: number;
  tickets_completed?: number;
}

function SalesPodium({ top3 }: { top3: LeaderboardEntry[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-12 min-h-[260px]">
        {top3[1] && (
          <div className="flex flex-col items-center group w-full md:w-48 order-2 md:order-1">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shadow-lg border-4 border-slate-300 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-slate-600 dark:text-zinc-300">2</span>
            </div>
            <div className="w-full h-40 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-800/50 rounded-t-xl border border-b-0 border-slate-200 dark:border-zinc-700 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-44">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full text-center">{top3[1].name}</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-2">${top3[1].revenue_closed.toLocaleString()}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{top3[1].deals_closed} Deals</span>
            </div>
          </div>
        )}
        {top3[0] && (
          <div className="flex flex-col items-center group w-full md:w-56 order-1 md:order-2 relative">
            <div className="absolute top-10 pointer-events-none">
              <Star className="w-6 h-6 text-yellow-400 absolute -left-10 -top-5 animate-pulse" />
              <Star className="w-4 h-4 text-orange-400 absolute left-12 -top-10 animate-bounce" />
            </div>
            <div className="w-20 h-20 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shadow-xl border-4 border-yellow-400 relative z-10 mb-[-25px] transition-transform group-hover:scale-110">
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="w-full h-52 bg-gradient-to-t from-yellow-200 via-yellow-100 to-yellow-50 dark:from-yellow-900/40 dark:via-yellow-900/20 dark:to-transparent rounded-t-xl border border-b-0 border-yellow-300 dark:border-yellow-700/50 flex flex-col items-center pt-10 px-4 transition-all group-hover:h-56 shadow-[0_0_30px_rgba(250,204,21,0.2)]">
              <span className="font-black text-lg text-yellow-900 dark:text-yellow-500 truncate w-full text-center">{top3[0].name}</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-2">${top3[0].revenue_closed.toLocaleString()}</span>
              <span className="text-xs text-yellow-700 dark:text-yellow-600 uppercase tracking-wider mt-1 font-bold">{top3[0].deals_closed} Deals Won</span>
            </div>
          </div>
        )}
        {top3[2] && (
          <div className="flex flex-col items-center group w-full md:w-48 order-3">
            <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shadow-lg border-4 border-orange-400 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-orange-600 dark:text-orange-500">3</span>
            </div>
            <div className="w-full h-32 bg-gradient-to-t from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-transparent rounded-t-xl border border-b-0 border-orange-200 dark:border-orange-800/50 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-36">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full text-center">{top3[2].name}</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-2">${top3[2].revenue_closed.toLocaleString()}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{top3[2].deals_closed} Deals</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketsPodium({ top3 }: { top3: LeaderboardEntry[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-12 min-h-[260px]">
        {top3[1] && (
          <div className="flex flex-col items-center group w-full md:w-48 order-2 md:order-1">
            <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/20 flex items-center justify-center shadow-lg border-4 border-cyan-300 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">2</span>
            </div>
            <div className="w-full h-40 bg-gradient-to-t from-cyan-100 to-cyan-50 dark:from-cyan-900/30 dark:to-transparent rounded-t-xl border border-b-0 border-cyan-200 dark:border-cyan-800/50 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-44">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full text-center">{top3[1].name}</span>
              <span className="text-sm font-black text-cyan-600 dark:text-cyan-400 mt-2">{top3[1].tickets_assigned ?? 0} tickets</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{top3[1].tickets_in_production ?? 0} in prod</span>
            </div>
          </div>
        )}
        {top3[0] && (
          <div className="flex flex-col items-center group w-full md:w-56 order-1 md:order-2 relative">
            <div className="absolute top-10 pointer-events-none">
              <Star className="w-6 h-6 text-cyan-400 absolute -left-10 -top-5 animate-pulse" />
              <Star className="w-4 h-4 text-blue-400 absolute left-12 -top-10 animate-bounce" />
            </div>
            <div className="w-20 h-20 rounded-full bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center shadow-xl border-4 border-cyan-400 relative z-10 mb-[-25px] transition-transform group-hover:scale-110">
              <Ticket className="w-8 h-8 text-cyan-500" />
            </div>
            <div className="w-full h-52 bg-gradient-to-t from-cyan-200 via-cyan-100 to-cyan-50 dark:from-cyan-900/40 dark:via-cyan-900/20 dark:to-transparent rounded-t-xl border border-b-0 border-cyan-300 dark:border-cyan-700/50 flex flex-col items-center pt-10 px-4 transition-all group-hover:h-56 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
              <span className="font-black text-lg text-cyan-900 dark:text-cyan-400 truncate w-full text-center">{top3[0].name}</span>
              <span className="text-base font-black text-cyan-600 dark:text-cyan-400 mt-2">{top3[0].tickets_assigned ?? 0} tickets</span>
              <span className="text-xs text-cyan-700 dark:text-cyan-600 uppercase tracking-wider mt-1 font-bold">{top3[0].tickets_in_production ?? 0} in production</span>
            </div>
          </div>
        )}
        {top3[2] && (
          <div className="flex flex-col items-center group w-full md:w-48 order-3">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shadow-lg border-4 border-blue-400 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">3</span>
            </div>
            <div className="w-full h-32 bg-gradient-to-t from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-transparent rounded-t-xl border border-b-0 border-blue-200 dark:border-blue-800/50 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-36">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full text-center">{top3[2].name}</span>
              <span className="text-sm font-black text-cyan-600 dark:text-cyan-400 mt-2">{top3[2].tickets_assigned ?? 0} tickets</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{top3[2].tickets_in_production ?? 0} in prod</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [salesLeaderboard, setSalesLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ticketsLeaderboard, setTicketsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const boardRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [exporting, setExporting] = useState<"screenshot" | "pdf" | null>(null);
  const [exportMessage, setExportMessage] = useState("");

  const captureBoard = async (asPdf: boolean) => {
    if (!boardRef.current || exporting) return;
    setExporting(asPdf ? "pdf" : "screenshot");
    setExportMessage("");
    try {
      setRevealed(true);
      await new Promise(resolve => setTimeout(resolve, 650));
      if (asPdf) {
        const pdf = new jsPDF();
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(22);
        pdf.text("Leaderboard Reveal", 14, 20);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(`Generated ${new Date().toLocaleDateString()}`, 14, 28);
        let y = 40;
        const addRow = (values: string[]) => {
          if (y > 275) { pdf.addPage(); y = 20; }
          pdf.setFontSize(9);
          pdf.text(values.join(" | "), 14, y);
          y += 7;
        };
        pdf.setFont("helvetica", "bold");
        addRow(["Sales leaderboard", "Revenue", "Deals", "Meetings", "Calls"]);
        pdf.setFont("helvetica", "normal");
        salesBoard.forEach((entry, index) => addRow([`${index + 1}. ${entry.name}`, `$${entry.revenue_closed.toLocaleString()}`, String(entry.deals_closed), String(entry.meetings_booked), String(entry.calls_made)]));
        y += 8;
        pdf.setFont("helvetica", "bold");
        addRow(["Tickets leaderboard", "Assigned", "In production", "Completed"]);
        pdf.setFont("helvetica", "normal");
        ticketsBoard.forEach((entry, index) => addRow([`${index + 1}. ${entry.name}`, String(entry.tickets_assigned ?? 0), String(entry.tickets_in_production ?? 0), String(entry.tickets_completed ?? 0)]));
        pdf.save("leaderboard-reveal.pdf");
        setExportMessage("PDF saved successfully.");
      } else {
        const canvas = await html2canvas(boardRef.current, { backgroundColor: "#f8fafc", scale: Math.min(window.devicePixelRatio * 2, 3), useCORS: true, logging: false });
        const link = document.createElement("a");
        link.download = "leaderboard-reveal.png";
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        link.remove();
        setExportMessage("Screenshot downloaded successfully.");
      }
    } catch (error) {
      console.error("Leaderboard export failed", error);
      setExportMessage(asPdf ? "Could not save the PDF. Please try again." : "Could not capture the screenshot. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const startReveal = () => {
    setRevealed(false);
    window.setTimeout(() => setRevealed(true), 40);
  };

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const [salesResponse, ticketsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/leaderboard?kind=sales`),
          fetch(`${API_BASE_URL}/leaderboard?kind=tickets`),
        ]);
        if (salesResponse.ok) setSalesLeaderboard(await salesResponse.json());
        if (ticketsResponse.ok) setTicketsLeaderboard(await ticketsResponse.json());
      } catch (error) {
        console.error("Failed to fetch leaderboard", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const salesBoard = [...salesLeaderboard].sort((a, b) => b.revenue_closed - a.revenue_closed);
  const salesTop3 = salesBoard.slice(0, 3);
  const ticketsBoard = [...ticketsLeaderboard].sort((a, b) => (b.tickets_assigned ?? 0) - (a.tickets_assigned ?? 0));
  const ticketsTop3 = ticketsBoard.slice(0, 3);

  return (
    <div ref={boardRef} className={`p-6 md:p-8 max-w-7xl mx-auto space-y-14 min-h-[calc(100vh-64px)] transition-all duration-500 ${revealed ? "ring-4 ring-yellow-300/70 shadow-2xl shadow-yellow-500/20" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-yellow-200 bg-gradient-to-r from-yellow-50 via-white to-cyan-50 p-5 shadow-lg dark:border-yellow-800/40 dark:from-yellow-950/20 dark:via-zinc-900 dark:to-cyan-950/20">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-yellow-400 p-3 text-white shadow-lg shadow-yellow-400/30"><Sparkles size={20} /></div><div><p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">Grand Reveal</p><h1 className="text-2xl font-black text-slate-900 dark:text-white">Leaderboard Spotlight</h1></div></div>
        <div className="flex flex-wrap items-center gap-2"><button onClick={startReveal} className="flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5"><Sparkles size={15} /> Start Reveal</button><button onClick={() => captureBoard(false)} disabled={!!exporting} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"><Camera size={15} /> {exporting === "screenshot" ? "Capturing..." : "Screenshot"}</button><button onClick={() => captureBoard(true)} disabled={!!exporting} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"><Download size={15} /> {exporting === "pdf" ? "Saving..." : "Save PDF"}</button></div>
      </div>
      {exportMessage && <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">{exportMessage}</p>}

      {/* ── SALES LEADERBOARD ───────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-xl"><DollarSign className="w-5 h-5 text-yellow-600" /></div>
          <div>
            <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-yellow-600 to-orange-500 bg-clip-text text-transparent">
              Sales Leaderboard
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Ranked by revenue closed &amp; deals won</p>
          </div>
        </div>
        {salesTop3.length > 0 && <div className={revealed ? "animate-[zoomIn_700ms_ease-out]" : ""}><SalesPodium top3={salesTop3} /></div>}
        <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden ${revealed ? "animate-[fadeInUp_700ms_ease-out]" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium text-right">Revenue</th>
                  <th className="px-6 py-4 font-medium text-center">Deals Won</th>
                  <th className="px-6 py-4 font-medium text-center">Meetings</th>
                  <th className="px-6 py-4 font-medium text-center">Calls</th>
                  <th className="px-6 py-4 font-medium text-center">Leads</th>
                  <th className="px-6 py-4 font-medium text-center">Clients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {salesBoard.map((entry, index) => (
                  <tr key={entry.user_id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-slate-100 text-slate-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        {entry.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-400">${entry.revenue_closed.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-bold">{entry.deals_closed}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-zinc-300">{entry.meetings_booked}</td>
                    <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-zinc-300">{entry.calls_made}</td>
                    <td className="px-6 py-4 text-center font-bold text-amber-600">{entry.leads_managed || 0}</td>
                    <td className="px-6 py-4 text-center font-bold text-indigo-600">{entry.clients_managed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── TICKETS LEADERBOARD ─────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-xl"><Ticket className="w-5 h-5 text-cyan-600" /></div>
          <div>
            <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              Tickets Leaderboard
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Ranked by employee tickets assigned &amp; in production</p>
          </div>
        </div>
        {ticketsTop3.length > 0 && ticketsTop3.some(e => (e.tickets_assigned ?? 0) > 0) && (
          <div className={revealed ? "animate-[zoomIn_700ms_ease-out]" : ""}><TicketsPodium top3={ticketsTop3} /></div>
        )}
        <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden ${revealed ? "animate-[fadeInUp_700ms_ease-out]" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium text-center">Tickets Assigned</th>
                  <th className="px-6 py-4 font-medium text-center">In Production</th>
                  <th className="px-6 py-4 font-medium text-center">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {ticketsBoard.map((entry, index) => (
                  <tr key={entry.user_id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                        index === 0 ? "bg-cyan-100 text-cyan-700" :
                        index === 1 ? "bg-slate-100 text-slate-700" :
                        index === 2 ? "bg-blue-100 text-blue-700" :
                        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-700 dark:text-cyan-400">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        {entry.name}
                        <span className="text-[10px] text-slate-400 font-medium">{entry.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400 font-bold">{entry.tickets_assigned || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-bold">{entry.tickets_in_production || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-indigo-600">{entry.tickets_completed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}

