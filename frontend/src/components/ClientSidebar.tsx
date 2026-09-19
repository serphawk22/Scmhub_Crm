"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Grid3x3,
  FileText,
  Menu,
  Settings,
  LogOut,
  Target,
  Upload,
  Bell,
  CheckSquare,
  Receipt,
  FileSignature,
  BarChart2,
  ChevronRight,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { useSidebar } from "@/context/SidebarContext";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Sun, Moon } from "lucide-react";

const NAV_ITEMS = [
  { icon: Grid3x3, href: "/", labelKey: "navigation.home" },
  { icon: FileText, href: "/store", labelKey: "navigation.services" },
  { icon: CheckSquare, href: "/tasks", labelKey: "navigation.tasks" },
  { icon: Receipt, href: "/invoices", labelKey: "navigation.invoices" },
  { icon: FileSignature, href: "/proposals", labelKey: "navigation.proposals" },
  { icon: BarChart2, href: "/rankings", labelKey: "navigation.rankings" },
  { icon: Menu, href: "/messages", labelKey: "navigation.messages" },
  { icon: Target, href: "/milestones", labelKey: "navigation.milestones" },
  { icon: Upload, href: "/my-files", labelKey: "navigation.my_files" },
  { icon: Bell, href: "/notifications", labelKey: "navigation.notifications" },
  { icon: Settings, href: "/setup", labelKey: "common.settings" },
];

export function ClientSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useRole();
  const { collapsed, setCollapsed } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const initial = user?.name?.charAt(0).toUpperCase() || "S";

  return (
    <>
      <motion.div
        initial={false}
        animate={{ width: collapsed ? 72 : 220 }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col py-6 overflow-hidden"
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      >
        {/* Company Logo */}
        <div className={cn("flex items-center gap-3 mb-8 shrink-0", collapsed ? "justify-center px-0" : "px-5")}>
          <Link
            href="/"
            className="w-11 h-11 bg-amber-600 rounded-lg flex items-center justify-center text-white font-black text-lg hover:bg-amber-500 transition-colors shadow-lg shrink-0"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            {initial}
          </Link>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col overflow-hidden flex-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-base leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>SERP Hawk</span>
                  <button
                    onClick={toggleTheme}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  >
                    {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-yellow-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
                  </button>
                </div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest -mt-1">{t("clients.clientPortal", "Client Portal")}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav Icons */}
        <nav className={cn("flex flex-col gap-1 flex-1 overflow-y-auto", collapsed ? "items-center px-0" : "px-3")}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-lg flex items-center transition-all group shrink-0",
                  collapsed ? "w-11 h-11 justify-center" : "gap-3 px-3 py-2.5",
                  isActive ? "text-amber-500" : ""
                )}
                style={isActive
                  ? { background: "rgba(217,119,6,0.15)" }
                  : { color: "var(--text-secondary)" }
                }
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg border border-amber-600/30"
                    style={{ background: "rgba(217,119,6,0.12)" }}
                  />
                )}
                <item.icon className="w-5 h-5 relative z-10 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "text-[13px] font-semibold relative z-10 truncate",
                        isActive ? "font-bold text-amber-500" : ""
                      )}
                      style={!isActive ? { color: "var(--text-secondary)" } : {}}
                    >
                      {t(item.labelKey)}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* Tooltip only when collapsed */}
                {collapsed && (
                  <span
                    className="absolute left-full ml-3 px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl"
                    style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    {t(item.labelKey)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout at bottom */}
        <div
          className={cn("shrink-0 pt-3", collapsed ? "px-0 flex flex-col items-center" : "px-3")}
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border mb-2"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate" style={{ color: "var(--text-primary)" }}>{user?.name || t("clients.client", "Client")}</p>
                  <p className="text-[10px] font-semibold text-amber-500">{t("clients.client", "Client")}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {collapsed && (
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="w-11 h-11 rounded-lg flex items-center justify-center hover:bg-white/5 transition-all text-slate-400 mb-2"
            >
              {theme === "dark" ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-indigo-500" />}
            </button>
          )}

          <button
            onClick={handleLogout}
            className={cn(
              "relative rounded-lg flex items-center transition-all group hover:text-red-400",
              collapsed ? "w-11 h-11 justify-center" : "gap-3 px-3 py-2.5 w-full"
            )}
            style={{ color: "var(--text-muted)" }}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[13px] font-semibold"
                >
                  {t("auth.logout", "Logout")}
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && (
              <span
                className="absolute left-full ml-3 px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl"
                style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                {t("auth.logout", "Logout")}
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Expand / Collapse toggle button */}
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        animate={{ left: collapsed ? 72 : 220 }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        whileHover={{ x: 3 }}
        whileTap={{ scale: 0.92 }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-14 rounded-r-xl bg-amber-600 shadow-lg shadow-amber-900/40 text-white hover:bg-amber-500 transition-colors"
      >
        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-300", !collapsed && "rotate-180")} />
      </motion.button>
    </>
  );
}
