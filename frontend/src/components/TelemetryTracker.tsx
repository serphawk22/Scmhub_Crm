"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { API_BASE_URL } from "@/config";

export default function TelemetryTracker() {
  const pathname = usePathname();
  const startTimeRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string>(pathname);

  useEffect(() => {
    if (!pathname) return;
    
    // If the path changed, log the previous path and reset the timer
    if (pathname !== lastPathRef.current) {
      logVisit(lastPathRef.current, startTimeRef.current);
      lastPathRef.current = pathname;
      startTimeRef.current = Date.now();
    }
  }, [pathname]);

  // Log on unmount (when closing tab or full reload)
  useEffect(() => {
    // This runs only once on mount, and cleans up on unmount
    const handleBeforeUnload = () => {
      logVisit(lastPathRef.current, startTimeRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      logVisit(lastPathRef.current, startTimeRef.current);
    };
  }, []);

  const logVisit = (path: string, startTime: number) => {
    const token = localStorage.getItem("token");
    if (!token) return; // Only track authenticated users
    
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    if (timeSpent < 1) return; // Ignore very fast bounces

    const payload = JSON.stringify({
      page_path: path || "/",
      time_spent_seconds: timeSpent
    });

    const headers: any = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };

    // Grab tenant_id if stored in localStorage to ensure header is present
    const tenantId = localStorage.getItem("tenant_id");
    if (tenantId) {
        headers["X-Tenant-ID"] = tenantId;
    }

    try {
      fetch(`${API_BASE_URL}/telemetry/page-visit`, {
        method: "POST",
        headers,
        body: payload,
        keepalive: true
      });
    } catch (e) {
      // Ignore errors silently for telemetry
    }
  };

  return null;
}
