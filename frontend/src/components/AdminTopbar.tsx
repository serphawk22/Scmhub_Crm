"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Bell, Settings, ChevronDown, LogOut, User, X, Sparkles, Clock, Command,
  LayoutDashboard, Users, FolderKanban, CheckSquare, Bot, Phone, MessageCircle,
  FileText, FileSignature, LayoutGrid, Inbox, GraduationCap, UserCog, Briefcase,
  BarChart2, Activity, Zap, UserCheck, Store, Sun, Moon
} from "lucide-react";
import { useRole, Role } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import LanguageSelector from "./LanguageSelector";
import GlobalActivityFeed from "./GlobalActivityFeed";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard", "/clients": "Clients", "/projects": "Projects", "/tasks": "Task Board",
  "/invoices": "Invoices", "/proposals": "Proposals", "/rankings": "Keyword Rankings",
  "/notifications": "Notifications", "/email-agent": "Email Agent", "/calls": "Call Center", "/admin/radar": "Radar Analysis",
  "/messages": "Messages", "/interns": "Intern Pool", "/employees": "Employees",
  "/sales-manager": "Sales Manager", "/admin/services-overview": "Services Overview", "/admin/requests": "Request Board",
  "/admin/sales-team": "Sales Team", "/admin/services": "Services", "/admin/marketplace": "Marketplace", "/audit": "Audit Center", "/pricing": "Pricing"
};

const PAGE_TITLE_KEYS: Record<string, string> = {
  "/": "navigation.home", "/clients": "navigation.clients", "/projects": "navigation.projects", "/tasks": "navigation.tasks",
  "/invoices": "navigation.invoices", "/proposals": "navigation.proposals", "/rankings": "navigation.rankings",
  "/notifications": "navigation.notifications", "/email-agent": "navigation.email_agent", "/calls": "navigation.calls", "/admin/radar": "navigation.radar",
  "/messages": "navigation.messages", "/interns": "navigation.intern_pool", "/employees": "navigation.employees",
  "/sales-manager": "navigation.sales_manager", "/admin/services-overview": "navigation.services_overview", "/admin/requests": "navigation.request_board",
  "/admin/sales-team": "navigation.sales_team", "/admin/services": "navigation.services", "/admin/marketplace": "navigation.marketplace", "/audit": "navigation.audit_center", "/pricing": "navigation.pricing"
};

const ROLE_BADGE: Record<Role, { key: string; color: string }> = {
  Admin: { key: "topbar.role_admin", color: "bg-indigo-100 text-indigo-700 border border-indigo-200" },
  Employee: { key: "topbar.role_employee", color: "bg-sky-100 text-sky-700 border border-sky-200" },
  Client: { key: "topbar.role_client", color: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  Intern: { key: "topbar.role_intern", color: "bg-amber-100 text-amber-700 border border-amber-200" },
  SalesManager: { key: "topbar.role_sales_manager", color: "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200" },
  SuperAdmin: { key: "topbar.role_admin", color: "bg-purple-100 text-purple-700 border border-purple-200" },
  Supplier: { key: "topbar.role_employee", color: "bg-zinc-100 text-zinc-700 border border-zinc-200" },
  Demo: { key: "topbar.role_employee", color: "bg-rose-100 text-rose-700 border border-rose-200" },
  ProjectMember: { key: "topbar.role_employee", color: "bg-teal-100 text-teal-700 border border-teal-200" },
};

const NAV_MENUS_BASE = [
  {
    label_key: "navigation.core",
    items: [
      { name_key: "navigation.home", icon: LayoutDashboard, href: "/", roles: ["Admin", "Employee", "Intern", "Demo"] },
      { name_key: "navigation.my_queue", icon: Inbox, href: "/my-queue", roles: ["Admin", "Employee", "Intern", "Demo"] },
      { name_key: "navigation.clients", icon: Users, href: "/clients", roles: ["Admin", "Employee", "Demo"] },
      { name_key: "navigation.projects", icon: FolderKanban, href: "/projects", roles: ["Admin", "Employee", "Intern", "Demo"] },
      { name_key: "navigation.tasks", icon: CheckSquare, href: "/tasks", roles: ["Admin", "Employee", "Intern", "Demo"] },
    ]
  },
  {
    label_key: "navigation.growth_engine",
    items: [
      { name_key: "navigation.email_agent", icon: Bot, href: "/email-agent", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
      { name_key: "navigation.sales_team", icon: UserCheck, href: "/admin/sales-team", roles: ["Admin"] },
      { name_key: "navigation.sales_manager", icon: UserCheck, href: "/sales-manager", roles: ["Employee", "SalesManager"] },
      { name_key: "navigation.calls", icon: Phone, href: "/calls", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
      { name_key: "navigation.messages", icon: MessageCircle, href: "/messages", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
      { name_key: "navigation.notifications", icon: Bell, href: "/notifications", roles: ["Admin", "Employee", "Intern", "SalesManager", "Demo"] },
    ]
  },
  {
    label_key: "navigation.revenue",
    items: [
      { name_key: "navigation.invoices", icon: FileText, href: "/invoices", roles: ["Admin", "Employee"] },
      { name_key: "navigation.proposals", icon: FileSignature, href: "/proposals", roles: ["Admin", "Employee"] },
    ]
  },
  {
    label_key: "navigation.organization",
    items: [
      { name_key: "navigation.services_overview", icon: LayoutGrid, href: "/admin/services-overview", roles: ["Admin", "Employee"] },
      { name_key: "navigation.request_board", icon: Inbox, href: "/admin/requests", roles: ["Admin", "Employee"] },
      { name_key: "navigation.marketplace", icon: Store, href: "/admin/marketplace", roles: ["Admin"] },
      { name_key: "navigation.sales_team", icon: UserCheck, href: "/admin/sales-team", roles: ["Admin"] },
      { name_key: "navigation.interns", icon: GraduationCap, href: "/interns", roles: ["Admin", "Employee"] },
      { name_key: "navigation.employees", icon: UserCog, href: "/employees", roles: ["Admin"] },
      { name_key: "navigation.services", icon: Briefcase, href: "/admin/services", roles: ["Admin"] },
    ]
  },
  {
    label_key: "navigation.tools",
    items: [
      { name_key: "navigation.rankings", icon: BarChart2, href: "/rankings", roles: ["Admin", "Employee"] },
      { name_key: "navigation.audit", icon: Activity, href: "/audit", roles: ["Employee"] },
      { name_key: "navigation.pricing", icon: Zap, href: "/pricing", roles: ["Employee"] },
    ]
  }
];

function getTranslatedNavMenus(t: (key: string) => string) {
  return NAV_MENUS_BASE.map(menu => ({
    label: t(menu.label_key),
    items: menu.items.map(item => ({
      ...item,
      name: t(item.name_key)
    }))
  }));
}

export function AdminTopbar() {
  const { role, email, logout, user } = useRole();
  const { t, language } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  
  const searchRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const badge = ROLE_BADGE[role as Role];

  const loadNotifs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/${user?.id}?unread_only=true`);
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
        setRecentNotifs((data.notifications || []).slice(0, 3));
      } catch {}
  };

  useEffect(() => {
    let int: NodeJS.Timeout;
    if (user) {
      loadNotifs();
      int = setInterval(loadNotifs, 30000); // refresh every 30s
    }
    return () => clearInterval(int);
  }, [user]);

  const handleOpenNotifs = async () => {
    const isOpening = !notifOpen;
    setNotifOpen(isOpening);
    setUserMenuOpen(false);
    
    if (isOpening && unreadCount > 0 && user) {
      // Mark all as read when opening the dropdown
      try {
        await fetch(`${API_BASE_URL}/notifications/read-all/${user.id}`, { method: 'POST' });
        setUnreadCount(0);
      } catch (err) {
        console.error("Failed to mark notifications read", err);
      }
    }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus();
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center px-4 md:px-6 justify-between shadow-sm" style={{ background: "var(--topbar-bg)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
      
      {/* ── Left: Logo & Nav Menus ── */}
      <div className="flex items-center gap-6" ref={navRef}>
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="btn-glow-indigo w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0">
            SH
          </div>
          <div className="hidden md:flex flex-col">
            <span className="font-black text-slate-800 dark:text-zinc-100 text-sm leading-tight tracking-tight group-hover:text-indigo-600 transition-colors">SERP Hawk</span>
            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
              CRM
            </span>
          </div>
        </Link>

        {/* Divider */}
        <div className="hidden lg:block w-px h-6" style={{ background: "var(--border)" }} />

        {/* Desktop Nav Items */}
        <nav className="hidden lg:flex items-center gap-1">
          {getTranslatedNavMenus(t).map((menu) => {
            const allowedItems = menu.items.filter(i => i.roles.includes(role as Role));
            if (allowedItems.length === 0) return null;
            
            const isActive = allowedItems.some(i => pathname === i.href || (i.href !== "/" && pathname.startsWith(i.href)));

            return (
              <div 
                key={menu.label}
                className="relative"
                onMouseEnter={() => setActiveDropdown(menu.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                    isActive
                      ? "text-indigo-600"
                      : "hover:text-slate-900 dark:text-zinc-50"
                  )}
                  style={isActive
                    ? { background: "var(--accent-subtle)", color: "var(--accent)" }
                    : { color: "var(--text-secondary)" }
                  }
                >
                  {menu.label}
                  <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </button>

                <AnimatePresence>
                  {activeDropdown === menu.label && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-56 rounded-xl shadow-lg p-2 z-50"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
                    >
                      {allowedItems.map(item => {
                        const isItemActive = pathname === item.href;
                        return (
                          <Link key={item.href} href={item.href}>
                            <div className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                              isItemActive ? "text-indigo-700" : "hover:text-slate-700 dark:text-zinc-200"
                            )}
                            style={isItemActive
                              ? { background: "var(--accent-subtle)", color: "var(--accent)" }
                              : { color: "var(--text-secondary)" }
                            }>
                              <item.icon className={cn("w-4 h-4 shrink-0 transition-colors", isItemActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500")} />
                              <span className="text-sm font-semibold">{item.name}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>
      </div>

      {/* ── Right Controls ── */}
      <div className="flex items-center gap-2 md:gap-3">
        
        {/* Search Bar Trigger */}
        <motion.button
          onClick={() => setSearchOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center md:justify-start gap-3 md:px-4 p-2 md:py-2 rounded-xl border text-[13px] md:min-w-[200px] transition-all"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          <Search className="w-4 h-4 md:w-3.5 md:h-3.5" />
          <span className="hidden md:inline">{t("common.search")}</span>
          <div className="ml-auto hidden md:flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-0.5 border shadow-sm" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <Command className="w-3 h-3" />K
          </div>
        </motion.button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenNotifs}
            className="relative p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:bg-zinc-800 transition-all"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-xl overflow-hidden z-50"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
              >
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>{t("navigation.notifications")}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{unreadCount > 0 ? `${unreadCount} ${t("notifications.unread")}` : t("notifications.allCaughtUp")}</p>
                </div>
                {recentNotifs.length > 0 ? recentNotifs.map((n: any) => (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors th-hover">
                    <span className="text-lg mt-0.5">
                      {n.type === "success" ? "✅" : n.type === "warning" ? "⚠️" : n.type === "error" ? "❌" : "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{n.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-400">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-[12px] text-slate-400">{t("notifications.noNotifications")}</div>
                )}
                <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <Link href="/notifications" onClick={() => setNotifOpen(false)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 w-full text-center block transition-colors">
                    {t("notifications.viewAll")}
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Activity Feed Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setActivityFeedOpen(true)}
          className="relative p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:bg-zinc-800 transition-all"
          title={t("topbar.activity_feed")}
        >
          <Activity className="w-4.5 h-4.5" />
        </motion.button>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-zinc-700 mx-1" />

        {/* Language Selector */}
        <LanguageSelector />

        {/* Theme Toggle */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={toggleTheme}
          className="p-2 rounded-xl transition-all"
          style={{
            background: theme === "dark" ? "rgba(255,255,255,0.06)" : "#F1F5F9",
            color: theme === "dark" ? "#F9D94B" : "#6366f1",
            border: `1px solid ${theme === "dark" ? "#2A2A2A" : "#E5E7EB"}`,
          }}
          title={theme === "dark" ? t("topbar.switch_light") : t("topbar.switch_dark")}
        >
          {theme === "dark"
            ? <Sun className="w-4 h-4" />
            : <Moon className="w-4 h-4" />}
        </motion.button>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-zinc-700 mx-1" />

        {/* User Menu */}
        <div className="relative" ref={userRef}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 dark:bg-zinc-950 transition-all border border-transparent hover:border-slate-200 dark:border-zinc-700"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-[13px] shadow-sm">
              {email ? email[0].toUpperCase() : "U"}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-bold text-slate-700 dark:text-zinc-200 leading-tight max-w-[120px] truncate">{email || t("topbar.user_fallback")}</p>
              <p className="text-[10px] text-indigo-500 font-semibold">{role}</p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
          </motion.button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-xl overflow-hidden z-50"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
              >
                <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-inner">
                    {email ? email[0].toUpperCase() : "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--text-primary)" }}>{email || t("topbar.user_fallback")}</p>
                    <span className={`inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded-full ${badge?.color}`}>
                      {t(badge?.key || "topbar.role_admin")}
                    </span>
                  </div>
                </div>
                
                <div className="py-2">
                  <button onClick={() => { setUserMenuOpen(false); router.push("/profile"); }} className="flex items-center gap-3 w-full px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-zinc-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                    <User className="w-4 h-4" /> {t("common.profile")}
                  </button>
                  <button className="flex items-center gap-3 w-full px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-zinc-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                    <Settings className="w-4 h-4" /> {t("common.settings")}
                  </button>
                </div>
                
                <div className="py-2" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <button
                    onClick={() => { logout(); router.push("/login"); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-[13px] font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-100/50 transition-all"
                  >
                    <LogOut className="w-4 h-4" /> {t("auth.logout")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Full-screen Search Modal ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}
          >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              className="relative w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-lg)" }}
            >
              <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <Search className="w-5 h-5 text-indigo-500 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("common.searchPlaceholder")}
                  className="flex-1 bg-transparent text-[15px] placeholder:text-slate-400 outline-none font-medium"
                  style={{ color: "var(--text-primary)" }}
                />
                {searching && <div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin shrink-0" />}
                <button
                  onClick={() => setSearchOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:text-zinc-300 transition-all bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 max-h-80 overflow-y-auto">
                {searchQuery.trim() && searchResults.length > 0 ? (
                  <>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">{t("admin_topbar.results")}</p>
                    {searchResults.map((r: any, i: number) => {
                      const icons: Record<string, string> = { client: '👤', project: '📁', task: '✅', invoice: '💰' };
                      return (
                        <button key={`${r.type}-${r.id}-${i}`}
                          onClick={() => { router.push(r.link); setSearchOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 transition-all text-left group">
                          <span className="text-sm bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-lg group-hover:bg-indigo-100">{icons[r.type] || '🔍'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-slate-700 dark:text-zinc-200 group-hover:text-indigo-700 truncate">{r.title}</p>
                            {r.sub && <p className="text-[11px] text-slate-400 truncate group-hover:text-indigo-500">{r.sub}</p>}
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 shrink-0">{r.type}</span>
                        </button>
                      );
                    })}
                  </>
                ) : searchQuery.trim() && !searching ? (
                  <p className="text-[13px] text-slate-500 dark:text-zinc-400 text-center py-8 font-medium">{t("topbar.no_results")} &ldquo;{searchQuery}&rdquo;</p>
                ) : (
                  <>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">{t("admin_topbar.quick_nav")}</p>
                    {["/", "/clients", "/projects", "/email-agent", "/calls", "/admin/services-overview", "/admin/marketplace"].map((href) => (
                      <button key={href}
                        onClick={() => { router.push(href); setSearchOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:bg-zinc-950 transition-all group">
                        <span className="text-[13px] font-semibold text-slate-600 dark:text-zinc-300 group-hover:text-indigo-600 transition-colors capitalize">
                          {(() => {
                          const k = PAGE_TITLE_KEYS[href];
                          if (k) {
                            const v = t(k);
                            if (v !== k) return v;
                          }
                          return PAGE_TITLES[href] || href;
                        })()}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                <span className="text-[11px] font-medium text-slate-400">{t("admin_topbar.press")} <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-slate-500 dark:text-zinc-400 font-sans mx-1">ESC</kbd> {t("admin_topbar.to_close")}</span>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <Sparkles className="w-3 h-3 text-indigo-400" /> {t("admin_topbar.powered_by_ai")}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <GlobalActivityFeed isOpen={activityFeedOpen} onClose={() => setActivityFeedOpen(false)} />
    </header>
  );
}
