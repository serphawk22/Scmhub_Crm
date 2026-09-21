"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { openDB } from "idb";
import { API_BASE_URL } from "../config";

interface SyncQueueItem {
  id?: number;
  url: string;
  method: string;
  headers: any;
  body: string;
  timestamp: number;
}

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  enqueueRequest: (url: string, method: string, headers: any, body: any) => Promise<void>;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const initDB = async () => {
    return openDB("crm-sync-queue", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("requests")) {
          db.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
        }
      },
    });
  };

  const updateCount = async () => {
    try {
      const db = await initDB();
      const count = await db.count("requests");
      setPendingCount(count);
    } catch (e) {}
  };

  const enqueueRequest = async (url: string, method: string, headers: any, body: any) => {
    const db = await initDB();
    await db.add("requests", {
      url,
      method,
      headers,
      body: JSON.stringify(body),
      timestamp: Date.now(),
    });
    await updateCount();
    alert("You are offline. Action saved and will sync automatically when online.");
  };

  const forceSync = async () => {
    if (!navigator.onLine) return;
    const db = await initDB();
    const allReqs = await db.getAll("requests");
    if (allReqs.length === 0) return;

    console.log(`Syncing ${allReqs.length} offline requests...`);
    for (const req of allReqs) {
      try {
        await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });
        await db.delete("requests", req.id);
      } catch (err) {
        console.error("Sync failed for request:", req, err);
      }
    }
    await updateCount();
    // Optional: reload page to show updated data
    window.location.reload();
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    updateCount();

    const handleOnline = () => {
      setIsOnline(true);
      forceSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, enqueueRequest, forceSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used within SyncProvider");
  return context;
}
