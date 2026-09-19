"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  children: React.ReactNode;
  actions: ContextMenuAction[];
  onCtrlClick?: () => void;
  className?: string;
}

export function ContextMenu({ children, actions, onCtrlClick, className }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - (actions.length * 40));
    setPosition({ x, y });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (onCtrlClick) {
        e.preventDefault();
        onCtrlClick();
      }
    } else {
      if (open) setOpen(false);
    }
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1 && onCtrlClick) {
      e.preventDefault();
      onCtrlClick();
    }
  };

  useEffect(() => {
    const closeMenu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  return (
    <div 
      onContextMenu={handleContextMenu} 
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      className={className || "contents"}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[9999] w-52 py-1 rounded-md shadow-lg border"
            style={{ 
              top: position.y, 
              left: position.x,
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text-primary)"
            }}
          >
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setOpen(false); action.onClick(); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors group
                  ${action.danger ? "hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400" 
                                  : "hover:bg-gray-100 dark:hover:bg-[var(--sidebar-hover)] text-[var(--text-primary)]"}`}
              >
                {action.icon && <span className={`w-4 h-4 shrink-0 ${!action.danger ? "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" : ""}`}>{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
