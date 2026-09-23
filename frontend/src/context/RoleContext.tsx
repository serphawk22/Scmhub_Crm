"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { API_BASE_URL } from '@/config';

export type Role = 'SuperAdmin' | 'Admin' | 'Employee' | 'Client' | 'Intern' | 'SalesManager' | 'Supplier' | 'Demo' | 'ProjectMember';

interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  client_id?: number;
}

interface RoleContextType {
  role: Role;
  email: string;
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null;

  const savedUser = localStorage.getItem('crm_user');
  if (!savedUser) return null;

  try {
    const parsedUser = JSON.parse(savedUser);
    if (parsedUser?.id && parsedUser?.email && parsedUser?.role) {
      return parsedUser;
    }
  } catch {
    // Clear malformed client state below.
  }

  localStorage.removeItem('crm_user');
  return null;
}

if (typeof window !== 'undefined' && !(window as any)._fetchPatched) {
  (window as any)._fetchPatched = true;
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    let [resource, config] = args;
    const saved = localStorage.getItem('crm_user');
    
    // Only inject tenant_id for internal API calls, not external ones like docs.google.com
    const isInternalApi = typeof resource === 'string' && (resource.startsWith(API_BASE_URL) || resource.startsWith('/'));

    if (saved && isInternalApi) {
      try {
        const parsed = JSON.parse(saved);
        config = config || {};
        if (parsed.id) {
          config.headers = {
            ...config.headers,
            'X-User-ID': String(parsed.id)
          };
        }
        // Skip sending tenant ID if the user is a SuperAdmin, giving them global access
        if (parsed.tenant_id && parsed.role !== 'SuperAdmin') {
          config.headers = {
            ...config.headers,
            'X-Tenant-ID': String(parsed.tenant_id)
          };
        }
      } catch (e) {}
    }
    if (!navigator.onLine && config && config.method && config.method !== 'GET') {
      try {
        const { openDB } = await import('idb');
        const db = await openDB("crm-sync-queue", 1);
        await db.add("requests", {
          url: resource,
          method: config.method,
          headers: config.headers,
          body: config.body,
          timestamp: Date.now(),
        });
        return new Response(JSON.stringify({ id: -1, status: "offline", message: "Saved offline" }), { status: 200, statusText: "OK" });
      } catch(err) {}
    }
    // Universal "confirm before email" gate: block any outbound request that
    // sends a mail until the user confirms it in the popup.
    if (isInternalApi && typeof resource === 'string') {
      try {
        const { emailTriggerInfo, requestEmailConfirmation } = await import('@/lib/emailConfirm');
        const info = emailTriggerInfo(resource, config);
        if (info) {
          const ok = await requestEmailConfirmation(info);
          if (!ok) {
            return new Response(
              JSON.stringify({ ok: false, cancelled: true, email_sent: false, message: "Email send cancelled by user." }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (e) {}
    }
    let response: Response;
    try {
      response = await originalFetch(resource, config);
    } catch (netErr) {
      console.warn(`[API] Request failed (network): ${typeof resource === 'string' ? resource : '(non-string URL)'}`, netErr instanceof Error ? netErr.message : netErr);
      return new Response(
        JSON.stringify({ ok: false, message: 'Network error. Please try again.', status: 'network_error' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // If we get a 401 from an internal API (other than the login endpoint itself)
    if (response.status === 401 && isInternalApi && typeof resource === 'string' && !resource.endsWith('/login')) {
      console.warn(`[API] Unauthorized request: ${resource}`);
    }
    
    return response;
  };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedUser = readStoredUser();
    if (storedUser) {
      setUser(storedUser);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated && pathname !== '/login' && pathname !== '/signup' && pathname !== '/' && !pathname?.startsWith('/demo_showcase') && pathname !== '/reset-password') {
        router.replace('/login');
      } else if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
        if (user?.role === 'Supplier') {
          router.replace('/supplier');
        } else if (user?.role === 'SalesManager') {
          router.replace('/clients');
        } else {
          router.replace('/');
        }
      }
    }
  }, [isAuthenticated, pathname, loading, router]);

  const login = async (email: string, pass: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('crm_user', JSON.stringify(data.user));
        return { success: true };
      }
      if (res.status === 503 && (data.status === 'network_error' || data.ok === false)) {
        return { success: false, message: `Unable to connect to the CRM API at ${API_BASE_URL}. Please check that the backend is reachable and try again.` };
      }
      return { success: false, message: data.detail || 'Invalid credentials. Please try again.' };
    } catch (err) {
      console.error('Login request failed', err);
      return {
        success: false,
        message: `Unable to connect to the CRM API at ${API_BASE_URL}. Please verify that the backend is running and reachable.`,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('crm_user');
    window.location.replace('/login');
  };

  return (
    <RoleContext.Provider value={{ 
      role: user?.role || 'Client' as Role, 
      email: user?.email || '', 
      isAuthenticated, 
      user, 
      login, 
      logout,
      loading
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
