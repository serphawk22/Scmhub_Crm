import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useRole } from "@/context/RoleContext";
import { Moon, Sun, LogOut, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";

export function DeveloperHeader() {
  const { activeLang, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useRole();

  const switchLanguage = (lang: string) => {
    setLanguage(lang);
    if (lang === "en") {
      sessionStorage.setItem("crm_gt_restore_en", "1");
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`;
      window.location.reload();
      return;
    }
    document.documentElement.classList.remove("notranslate");
    document.documentElement.removeAttribute("translate");
    const triggerGT = (attempts = 0) => {
      const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
      if (select) {
        select.value = lang;
        select.dispatchEvent(new Event("change"));
      } else if (attempts < 25) {
        setTimeout(() => triggerGT(attempts + 1), 100);
      }
    };
    triggerGT();
  };

  return (
    <header className="w-full bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-zinc-800/50 sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
        
        {/* Logo / Branding */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Code2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight">{t("dev_header.workspace")}</h1>
            <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">{user?.name || t("dev_header.developer")}</p>
          </div>
          <div className="ml-4 flex items-center gap-2">
            <Link href="/work-queue" className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-xs font-black">My Work Queue</Link>
            <Link href="/task-sheet" className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-black">Task Sheet</Link>
            <Link href="/support/cases" className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-black">Cases</Link>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          
          {/* Language Toggle */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <button
              onClick={() => switchLanguage("en")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all",
                activeLang === "en" ? "bg-white dark:bg-zinc-800 shadow-sm text-slate-900 dark:text-zinc-100" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              🇺🇸 EN
            </button>
            <button
              onClick={() => switchLanguage("es")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all",
                activeLang === "es" ? "bg-white dark:bg-zinc-800 shadow-sm text-slate-900 dark:text-zinc-100" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              🇪🇸 ES
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 dark:bg-zinc-800 mx-1"></div>

          {/* Profile / Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors text-sm font-bold"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">{t("dev_header.logout")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
