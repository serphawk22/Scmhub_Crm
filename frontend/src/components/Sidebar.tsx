"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Bell, Users, FolderOpen, CheckSquare, CheckCircle, Radar, Mail,
  Zap, LayoutList, Globe, BarChart2, Activity, FileText, FileEdit, ShoppingBag, Settings,
  Moon, Sun, ChevronDown, ChevronRight, Search, PanelLeftClose, PanelLeftOpen, Calendar,
  Phone, Package, ShoppingCart, Truck, HeadphonesIcon, BookOpen, FileBarChart2, Briefcase, Edit2, GripVertical, Check,
  Trophy, Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole, Role } from "@/context/RoleContext";
import { useSidebar } from "@/context/SidebarContext";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/config";
import { useLanguage } from "@/context/LanguageContext";

// --- DND Kit Imports ---
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Icon mapping for dynamically loaded sections
const iconMap: Record<string, any> = {
  LayoutDashboard, Bell, Users, FolderOpen, CheckSquare, CheckCircle, Radar, Mail,
  Zap, LayoutList, Globe, BarChart2, Activity, FileText, FileEdit, ShoppingBag, Settings,
  Moon, Sun, ChevronDown, ChevronRight, Search, PanelLeftClose, PanelLeftOpen, Calendar,
  Phone, Package, ShoppingCart, Truck, HeadphonesIcon, BookOpen, FileBarChart2, Briefcase, Trophy, Star
};

interface SidebarProps {
  role: Role;
}

const defaultSidebarSections = [
  {
    id: "section-home",
    heading: null,
    items: [
      { id: "item-dashboard", name: "Dashboard", icon: "LayoutDashboard", href: "/", roles: ["Admin", "Employee", "Client", "Intern", "SalesManager", "Demo"] },
      { id: "item-work-queue", name: "My Work Queue", icon: "LayoutList", href: "/work-queue", roles: ["Demo", "Employee", "Intern"] },
      { id: "item-notifications", name: "Notifications", icon: "Bell", href: "/notifications", roles: ["Admin", "Demo", "SalesManager", "Employee"] },
    ],
  },
  {
    id: "section-crm",
    heading: "CRM",
    items: [
      { id: "item-leads", name: "Leads", icon: "Radar", href: "/leads", roles: ["Admin", "SalesManager", "Demo"] },
      { id: "item-contacts", name: "Contacts", icon: "Users", href: "/contacts", roles: ["Admin", "SalesManager", "Demo"] },
      { id: "item-clients", name: "Clients", icon: "CheckCircle", href: "/clients", roles: ["Admin", "SalesManager", "Demo"] },
      { id: "item-deals", name: "Deals", icon: "Briefcase", href: "/pipeline", roles: ["Admin", "SalesManager", "Demo"] },
    ],
  },
  {
    id: "section-projects",
    heading: "PROJECTS & ACTIVITIES",
    items: [
      { id: "item-projects", name: "Projects", icon: "FolderOpen", href: "/projects", roles: ["Admin", "Employee", "Intern", "ProjectMember", "Demo"] },
      { id: "item-task-sheet", name: "Task Sheet", icon: "FileBarChart2", href: "/task-sheet", roles: ["Admin", "Employee", "SalesManager", "ProjectMember", "Demo"] },
      { id: "item-reports", name: "Reports", icon: "BarChart2", href: "/reports", roles: ["Admin", "SalesManager", "Demo"] },
      { id: "item-meetings", name: "Meetings", icon: "Calendar", href: "/meetings", roles: ["Admin", "SalesManager", "Demo"] },
      { id: "item-calls", name: "Calls", icon: "Phone", href: "/calls", roles: ["Admin", "SalesManager", "Demo"] },
    ],
  },
  {
    id: "section-teams",
    heading: "TEAMS",
    items: [
      { id: "item-teams", name: "Team Directory", icon: "Users", href: "/teams", roles: ["Admin", "Demo"] },
      { id: "item-leaderboard", name: "Leaderboard", icon: "Trophy", href: "/admin/leaderboard", roles: ["Admin", "SalesManager", "Demo"] },
    ],
  },
  {
    id: "section-ai-agents",
    heading: "AI AGENTS",
    items: [
      { id: "item-email-agent", name: "Email Agent", icon: "Mail", href: "/email-agent", roles: ["Admin", "Employee", "SalesManager", "Demo"] },
    ],
  },
  {
    id: "section-support",
    heading: "SUPPORT",
    items: [
      { id: "item-cases", name: "Cases", icon: "HeadphonesIcon", href: "/support/cases", roles: ["Admin", "Employee", "SalesManager", "ProjectMember", "Demo"] },
      { id: "item-solutions", name: "Solutions", icon: "BookOpen", href: "/support/solutions", roles: ["Admin", "SalesManager", "Demo"] },
    ],
  },
];

// --- Sortable Section Component ---
const DEFAULT_HEADINGS = ["CRM", "PROJECTS & ACTIVITIES", "TEAMS", "AI AGENTS", "SUPPORT"];
const ITEM_KEY_OVERRIDES: Record<string, string> = {
  "item-teams": "team_directory",
  "item-products": "catalog",
  "item-import": "import_data",
};
function sidebarItemKey(id: string): string {
  return ITEM_KEY_OVERRIDES[id] || String(id).replace("item-", "").replace(/-/g, "_");
}
function sidebarSectionKey(id: string): string {
  return String(id).replace("section-", "").replace(/-/g, "_");
}

function SortableSection({ section, role, pathname, collapsed, isEditMode, onRenameSection, unreadCount, favourites, onToggleFavourite, searchQuery, isOpen, onToggleSection }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const { t } = useLanguage();
  const itemLabel = (item: any) => {
    const k = `sidebar.${sidebarItemKey(item.id)}`;
    const v = t(k);
    return v === k ? item.name : v;
  };
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as any,
    zIndex: isDragging ? 10 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(section.heading || "");

  const handleSave = () => {
    onRenameSection(section.id, editValue);
    setIsEditing(false);
  };

  const visibleItems = section.items
    .filter((item: any) => (role === 'SuperAdmin' || item.roles.includes(role)) && !(item.id === 'item-reports' && !['Admin', 'SuperAdmin'].includes(role)))
    .filter((item: any) => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (visibleItems.length === 0) return null;

  const hasHeading = section.heading !== null;
  const chevronVisible = hasHeading && !collapsed;

  return (
    <div ref={setNodeRef} style={style} className={cn("flex flex-col mt-2")}>
      <AnimatePresence>
        {chevronVisible && (
          <div className="flex items-center group px-2 pt-1 pb-1 gap-1">
            {isEditMode && (
              <div {...attributes} {...listeners} className="cursor-grab hover:bg-slate-200 dark:hover:bg-slate-700 p-0.5 rounded">
                <GripVertical className="w-2.5 h-2.5 text-slate-400" />
              </div>
            )}
            
            {isEditing && isEditMode ? (
              <div className="flex items-center gap-1 flex-1">
                <input 
                  type="text" 
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="bg-transparent text-[9px] font-bold tracking-[0.1em] uppercase text-slate-600 dark:text-slate-300 outline-none w-full border-b border-blue-500"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <Check onClick={handleSave} className="w-3 h-3 text-green-500 cursor-pointer" />
              </div>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => onToggleSection(section.id)}
                className="flex-1 text-[9px] font-bold tracking-[0.1em] uppercase flex justify-between items-center cursor-pointer select-none hover:opacity-80 transition-opacity"
                style={{ color: "var(--text-secondary)" }}
              >
                <span>{DEFAULT_HEADINGS.includes(section.heading || "") ? t(`sidebar.section_${sidebarSectionKey(section.id)}`) : section.heading}</span>
                <div className="flex items-center gap-1">
                  {isEditMode && (
                    <Edit2 onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-3 h-3" style={{ color: "var(--text-secondary)" }} />
                  </motion.div>
                </div>
              </motion.button>
            )}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {(isOpen || collapsed) && (
          <motion.div
            initial={collapsed ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-[1px]">
              {visibleItems.map((item: any) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                const IconComp = iconMap[item.icon] || LayoutDashboard;
                const isFav = favourites?.includes(item.id);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative group flex items-center gap-2 rounded-[8px] transition-all duration-150 select-none shrink-0",
                      collapsed ? "w-9 h-9 justify-center mx-auto" : "py-[4px] px-2 h-[28px]",
                      !isActive && "hover:bg-gray-50 dark:hover:bg-slate-800/50"
                    )}
                    style={isActive ? { background: "rgba(37,99,235,0.08)", color: "#2563eb" } : { color: "var(--sidebar-text)" }}
                  >
                    {isActive && !collapsed && (
                      <motion.span layoutId="sidebar-active-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-[18px] rounded-full bg-blue-600" />
                    )}
                    <IconComp className={cn("w-[16px] h-[16px] shrink-0 transition-colors", isActive ? "text-blue-600" : "group-hover:text-blue-500")} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.14 }}
                          className={cn("flex-1 text-[13px] font-medium truncate", isActive && "font-semibold")}
                        >
                          {itemLabel(item)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {(item.id === "item-notifications" ? unreadCount : item.badge) > 0 && !collapsed && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                        {item.id === "item-notifications" ? unreadCount : item.badge}
                      </span>
                    )}
                    {!collapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleFavourite(item.id);
                        }}
                        title={isFav ? t("sidebar.remove_favourite") : t("sidebar.add_favourite")}
                        className={cn(
                          "p-0.5 rounded transition-all shrink-0 hover:scale-110",
                          isFav 
                            ? "opacity-100" 
                            : "opacity-0 group-hover:opacity-40 hover:!opacity-100"
                        )}
                      >
                        <Star 
                          className={cn(
                            "w-3.5 h-3.5 transition-colors",
                            isFav 
                              ? "fill-amber-400 text-amber-400" 
                              : "text-slate-400 dark:text-slate-500 hover:text-amber-400"
                          )} 
                        />
                      </button>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useRole();
  const { collapsed, setCollapsed } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  
  const [sections, setSections] = useState<any[]>(defaultSidebarSections);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    // Default: all sections with headings start open
    const initial: Record<string, boolean> = {};
    for (const sec of defaultSidebarSections) {
      if (sec.heading !== null) initial[sec.id] = true;
    }
    return initial;
  });

  // Auto-expand the section containing the current route
  useEffect(() => {
    if (!pathname) return;
    setOpenSections(prev => {
      const next = { ...prev };
      let changed = false;
      for (const sec of sections) {
        if (sec.heading === null) continue;
        const hasActive = sec.items?.some((item: any) =>
          pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
        );
        if (hasActive && !next[sec.id]) {
          next[sec.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, sections]);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try { localStorage.setItem(`crm_sections_open_${user?.id || 'default'}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Load saved section open state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`crm_sections_open_${user?.id || 'default'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setOpenSections(prev => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, [user?.id]);

  const fetchSidebarPrefs = useCallback(async () => {
    const localFavKey = `crm_favourites_${user?.id || 'default'}`;
    try {
      const cachedFavs = localStorage.getItem(localFavKey);
      if (cachedFavs) {
        setFavourites(JSON.parse(cachedFavs));
      }
    } catch {}

    if (!user?.id) return;

    try {
      const url = `${API_BASE_URL}/users/me/sidebar-preferences?user_id=${user.id}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.sidebar_preferences) {
          if (data.sidebar_preferences.sections) {
            const savedSections = data.sidebar_preferences.sections;
            const savedSectionIds = new Set(savedSections.map((s: any) => s.id));
            const missingSections = defaultSidebarSections.filter(s => !savedSectionIds.has(s.id));
            
            // Deep merge: update existing items with latest roles/icons and add missing items
            const mergedSections = savedSections.map((savedSec: any) => {
              const updatedSavedItems = savedSec.items.map((savedItem: any) => {
                let defaultItemRef = null;
                for (const ds of defaultSidebarSections) {
                  const found = ds.items.find(i => i.id === savedItem.id);
                  if (found) { defaultItemRef = found; break; }
                }
                if (defaultItemRef) {
                  return { ...savedItem, roles: defaultItemRef.roles, icon: defaultItemRef.icon, href: defaultItemRef.href, name: defaultItemRef.name };
                }
                return null;
              }).filter(Boolean);

              const defaultSec = defaultSidebarSections.find(s => s.id === savedSec.id);
              if (!defaultSec) return { ...savedSec, items: updatedSavedItems };
              
              const savedItemIds = new Set(updatedSavedItems.map((i: any) => i.id));
              const missingItems = defaultSec.items.filter(i => !savedItemIds.has(i.id));
              
              return { ...savedSec, items: [...updatedSavedItems, ...missingItems] };
            });

            const stripDisabled = (sec: any) => ({
              ...sec,
              items: (sec.items || []).filter((i: any) =>
                !String(i.id || "").toLowerCase().includes("automation") &&
                !String(i.href || "").toLowerCase().includes("automation")),
            });
            const mergedSectionsClean = mergedSections.map(stripDisabled);
            
            if (missingSections.length > 0) {
              setSections([...mergedSectionsClean, ...missingSections.map(stripDisabled)]);
            } else {
              setSections(mergedSectionsClean);
            }
          }
          if (Array.isArray(data.sidebar_preferences.favourites)) {
            setFavourites(data.sidebar_preferences.favourites);
            try {
              localStorage.setItem(localFavKey, JSON.stringify(data.sidebar_preferences.favourites));
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn("Could not load sidebar preferences from server, using local fallback.", e);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSidebarPrefs();
    
    if (!user?.id) return;
    const fetchNotifs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/${user.id}?unread_only=true`);
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user?.id, fetchSidebarPrefs]);

  const saveSidebarPrefs = async (newSections: any[], newFavourites?: string[]) => {
    const favsToSave = newFavourites !== undefined ? newFavourites : favourites;
    const localFavKey = `crm_favourites_${user?.id || 'default'}`;
    try {
      localStorage.setItem(localFavKey, JSON.stringify(favsToSave));
    } catch {}

    if (!user?.id) return;

    try {
      const url = `${API_BASE_URL}/users/me/sidebar-preferences?user_id=${user.id}`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sidebar_preferences: { 
            sections: newSections,
            favourites: favsToSave 
          } 
        }),
      });
    } catch (e) {
      console.warn("Could not save sidebar preferences to server:", e);
    }
  };

  const handleToggleFavourite = (itemId: string) => {
    setFavourites((prev) => {
      const exists = prev.includes(itemId);
      const updated = exists ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      saveSidebarPrefs(sections, updated);
      return updated;
    });
  };

  const handleRenameSection = (sectionId: string, newName: string) => {
    const updated = sections.map(sec => sec.id === sectionId ? { ...sec, heading: newName } : sec);
    setSections(updated);
    saveSidebarPrefs(updated);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = sections.findIndex(sec => sec.id === active.id);
      const newIndex = sections.findIndex(sec => sec.id === over.id);
      const updated = arrayMove(sections, oldIndex, newIndex);
      setSections(updated);
      saveSidebarPrefs(updated);
    }
  };

  // Collect map of all items across sections and defaults
  const allItemsMap = new Map<string, any>();
  sections.forEach(sec => {
    sec.items?.forEach((item: any) => {
      allItemsMap.set(item.id, item);
    });
  });
  defaultSidebarSections.forEach(sec => {
    sec.items?.forEach((item: any) => {
      if (!allItemsMap.has(item.id)) {
        allItemsMap.set(item.id, item);
      }
    });
  });

  const favouriteItems = favourites
    .map(id => allItemsMap.get(id))
    .filter(Boolean)
    .filter(item => role === 'SuperAdmin' || item.roles?.includes(role))
    .filter(item => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const labelFor = (item: any) => {
    const k = `sidebar.${sidebarItemKey(item.id)}`;
    const v = t(k);
    return v === k ? item.name : v;
  };

  // ── Language (English only) ──
  const { t } = useLanguage();

  return (
    <>
      <motion.div
        initial={false}
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          background: "var(--sidebar-bg)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.06)",
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        {/* ── TOP BRANDING ── */}
        <div className={cn("shrink-0 flex items-center py-2.5", collapsed ? "justify-center px-2" : "px-4 gap-3")}>
          <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M12 3L3 8.5V15.5L12 21L21 15.5V8.5L12 3Z" fill="white" fillOpacity="0.9" />
              <path d="M12 7L7 10V14L12 17L17 14V10L12 7Z" fill="white" fillOpacity="0.5" />
              <circle cx="12" cy="12" r="2" fill="white" />
            </svg>
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0 overflow-hidden flex items-center justify-between"
              >
                <div>
                  <span className="block font-bold text-[14px] leading-tight tracking-tight truncate" style={{ color: "var(--text-primary)" }}>SERP Hawk</span>
                  <span className="block text-[10px] font-medium truncate" style={{ color: "var(--text-secondary)" }}>{t("sidebar.corporate_hq")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsEditMode(!isEditMode)} 
                    className={cn("p-1.5 rounded-lg transition-colors", isEditMode ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")}
                    title={t("sidebar.customize_sidebar")}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── THEME TOGGLE (top-left, below branding) ── */}
        <div className={cn("shrink-0 pb-1.5", collapsed ? "flex flex-col items-center gap-2 px-2" : "px-3")}>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className={cn(
              "flex items-center justify-center transition-all hover:bg-white/10 rounded-xl",
              collapsed ? "w-8 h-8" : "w-full px-3 py-1.5 gap-1.5"
            )}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            {!collapsed && (
              <span className="text-[10px] font-black" style={{ color: "var(--text-secondary)" }}>
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            )}
          </button>
        </div>

        {/* ── SEARCH BAR ── */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="shrink-0 px-3 pb-1.5"
            >
              <div
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-secondary)" }} />
                <input
                  type="text"
                  placeholder={t("sidebar.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-[12px] outline-none placeholder-gray-400"
                  style={{ color: "var(--text-primary)" }}
                />
                <span className="text-[9px] font-medium px-1 rounded border shrink-0" style={{ color: "var(--text-secondary)", borderColor: "var(--border)", background: "var(--background)" }}>
                  ⌘K
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MAIN NAVIGATION ── */}
        <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 flex flex-col gap-0.5 pb-2", collapsed ? "px-2" : "px-3")}>
          
          {/* ── FAVOURITES SECTION ── */}
          {favouriteItems.length > 0 && (
            <div className="flex flex-col mb-1 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              {!collapsed && (
                <div className="flex items-center justify-between px-2 pt-1 pb-1">
                  <span 
                    className="text-[9px] font-bold tracking-[0.1em] uppercase flex items-center gap-1.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    {t("sidebar.favourites")}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800">
                    {favouriteItems.length}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-[1px]">
                {favouriteItems.map((item: any) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                  const IconComp = iconMap[item.icon] || LayoutDashboard;
                  return (
                    <Link
                      key={`fav-${item.id}-${item.href}`}
                      href={item.href}
                      className={cn(
                        "relative group flex items-center gap-2 rounded-[8px] transition-all duration-150 select-none shrink-0",
                        collapsed ? "w-9 h-9 justify-center mx-auto" : "py-[4px] px-2 h-[28px]",
                        !isActive && "hover:bg-gray-50 dark:hover:bg-slate-800/50"
                      )}
                      style={isActive ? { background: "rgba(37,99,235,0.08)", color: "#2563eb" } : { color: "var(--sidebar-text)" }}
                    >
                      {isActive && !collapsed && (
                        <motion.span layoutId="sidebar-fav-active-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-[18px] rounded-full bg-blue-600" />
                      )}
                      <IconComp className={cn("w-[16px] h-[16px] shrink-0 transition-colors", isActive ? "text-blue-600" : "group-hover:text-blue-500")} />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            transition={{ duration: 0.14 }}
                            className={cn("flex-1 text-[13px] font-medium truncate", isActive && "font-semibold")}
                          >
                            {labelFor(item)}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {(item.id === "item-notifications" ? unreadCount : item.badge) > 0 && !collapsed && (
                        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                          {item.id === "item-notifications" ? unreadCount : item.badge}
                        </span>
                      )}
                      {!collapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleFavourite(item.id);
                          }}
                          title={t("sidebar.remove_favourite")}
                          className="p-0.5 rounded transition-all shrink-0 hover:scale-110 opacity-100"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 transition-colors" />
                        </button>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SortableSection 
                  key={section.id} 
                  section={section} 
                  unreadCount={unreadCount}
                  role={role} 
                  pathname={pathname} 
                  collapsed={collapsed} 
                  isEditMode={isEditMode}
                  onRenameSection={handleRenameSection}
                  favourites={favourites}
                  onToggleFavourite={handleToggleFavourite}
                  searchQuery={searchQuery}
                  isOpen={section.heading === null ? true : (openSections[section.id] ?? false)}
                  onToggleSection={toggleSection}
                />
              ))}
            </SortableContext>
          </DndContext>
        </nav>

        {/* ── BOTTOM SECTION REMOVED ── */}
      </motion.div>

      <motion.button
        animate={{ left: collapsed ? 72 : 280 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        onClick={() => setCollapsed(!collapsed)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        title={collapsed ? t("sidebar.expand_sidebar") : t("sidebar.collapse_sidebar")}
        className="fixed top-[52px] z-[60] -translate-x-1/2 flex items-center justify-center w-7 h-7 rounded-full border-2 shadow-md transition-colors"
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
        }}
      >
        {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
      </motion.button>
    </>
  );
}
