"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string; // info | success | warning | error
  link?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refresh: () => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL = 15_000; // 15 seconds

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useRole();
  const userId = user?.id;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (e) {
      // silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch + re-fetch when user changes
  useEffect(() => {
    if (userId) {
      setLoading(true);
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [userId, fetchNotifications]);

  // Polling every 15s
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [userId, fetchNotifications]);

  const markRead = useCallback(async (id: number) => {
    await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: "PUT" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await fetch(`${API_BASE_URL}/notifications/mark-all-read/${userId}`, { method: "PUT" });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [userId]);

  const deleteNotification = useCallback(async (id: number) => {
    await fetch(`${API_BASE_URL}/notifications/${id}`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    await fetch(`${API_BASE_URL}/notifications/clear-all/${userId}`, { method: "DELETE" });
    setNotifications([]);
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refresh: fetchNotifications,
        markRead,
        markAllRead,
        deleteNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
