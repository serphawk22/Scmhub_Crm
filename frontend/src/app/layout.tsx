"use client";

import { useEffect } from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { Chatbot } from "@/components/Chatbot";
import QuickAddFab from "@/components/QuickAddFab";
import OmniSearch from "@/components/OmniSearch";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { RoleProvider, useRole } from "@/context/RoleContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import I18nProvider from "@/i18n/I18nProvider";
import { Sidebar } from "@/components/Sidebar";
import { ClientSidebar } from "@/components/ClientSidebar";
import { SyncProvider } from "@/context/SyncContext";
import { GlobalLoader } from "@/components/GlobalLoader";
import { usePathname } from "next/navigation";
import { CallNotificationBar } from "@/components/CallNotificationBar";
import { DeveloperHeader } from "@/components/DeveloperHeader";
import SpaceAtmosphere from "@/components/SpaceAtmosphere";
import TelemetryTracker from "@/components/TelemetryTracker";
import { WHATSAPP_LINK } from "@/config";
import Script from "next/script";
import TopRightControls from "@/components/TopRightControls";
import GoogleProviderWrapper from "@/components/GoogleProviderWrapper";
import { GlobalLimitModal } from "@/components/GlobalLimitModal";
import { NotificationProvider } from "@/context/NotificationContext";

function AdminMainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const isClientDetail = pathname?.match(/^\/admin\/clients\/\d+$/);

  return (
    <main className={`relative z-10 min-h-screen transition-all duration-300 ${collapsed ? "ml-[72px]" : "ml-[280px]"}`}>
      <TopRightControls />
      <div className={isClientDetail ? "w-full h-full pr-20" : "pt-[76px] px-6 md:px-8 pb-6 md:pb-8 pr-20 md:pr-24 max-w-[1600px] mx-auto h-full"}>
        {children}
      </div>
    </main>
  );
}

function ClientLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="client-shell relative w-full min-h-screen bg-transparent text-white" style={{ color: "var(--text-primary)" }}>
      <ClientSidebar />
      <CallNotificationBar />
      <main className={`min-h-screen transition-all duration-300 pt-6 px-4 md:px-6 ${collapsed ? "ml-[72px]" : "ml-[220px]"}`}>
        {children}
      </main>
    </div>
  );
}

const inter = Inter({ subsets: ["latin"], preload: false });

function AppContent({ children }: { children: React.ReactNode }) {
  const { role, loading } = useRole();
  const pathname = usePathname();
  const isClient = role === "Client";
  const isDeveloper = role === "ProjectMember";
  const isAdminOrEmployee = role === "Admin" || role === "Employee" || role === "Intern" || role === "SalesManager" || role === "Demo";
  const showChatbot = !!role && role !== "Client"; // Show for ALL roles except unauthenticated Client

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.group("Global Error Captured");
      console.error("Message:", event.message);
      if (event.error?.stack) console.error("Stack:", event.error.stack);
      console.groupEnd();
    };
    window.addEventListener("error", handleError);

    // Global fetch interceptor for LIMIT_REACHED
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let response: Response;
      try {
        response = await originalFetch(...args);
      } catch (netErr) {
        console.warn('[API] Request failed (network):', netErr instanceof Error ? netErr.message : netErr);
        return new Response(
          JSON.stringify({ ok: false, message: 'Network error. Please try again.', status: 'network_error' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 403) {
        try {
          const cloned = response.clone();
          const data = await cloned.json();
          if (data?.detail?.error === "LIMIT_REACHED") {
            const event = new CustomEvent("limit-reached", { detail: data.detail });
            window.dispatchEvent(event);
          }
        } catch (e) {
          // ignore parsing errors
        }
      }
      return response;
    };

    return () => {
      window.removeEventListener("error", handleError);
      window.fetch = originalFetch;
    };
  }, []);

  if (loading) {
    return <GlobalLoader />;
  }

  if (pathname === "/login" || pathname === "/signup" || pathname === "/demo_showcase" || pathname === "/reset-password" || pathname?.startsWith("/demo_showcase")) {
    return <main className="h-screen w-full">{children}</main>;
  }

  // ── Client layout ──
  if (isClient) {
    return (
      <SidebarProvider>
        <ClientLayout>{children}</ClientLayout>
      </SidebarProvider>
    );
  }

  // ── Supplier layout ──
  if (role === "Supplier") {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-black">
        <nav className="bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">S</span>
            </div>
            <span className="font-bold text-slate-800 dark:text-white text-sm">Supplier Portal</span>
          </div>
          <a href="/login" onClick={() => { localStorage.removeItem("crm_user"); }}
            className="text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors">
            Sign Out
          </a>
        </nav>
        <main>{children}</main>
        <Chatbot />
      </div>
    );
  }

  // ── Admin / Employee / Intern layout ──
  if (isAdminOrEmployee) {
    return (
    <SyncProvider>
      <SidebarProvider>
        <div className="admin-shell min-h-screen" style={{ background: "var(--background)" }}>
          <Sidebar role={role} />
          <AdminMainContent>
            <CallNotificationBar />
            {children}
          </AdminMainContent>
          {showChatbot && <Chatbot />}
        </div>
      </SidebarProvider>
    </SyncProvider>
    );
  }

  // ── Developer layout ──
  if (isDeveloper) {
    return (
      <div className="developer-shell min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col">
        <DeveloperHeader />
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full h-full">
          {children}
        </main>
        {showChatbot && <Chatbot />}
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-secondary)" }}>
      <main className="p-6">{children}</main>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Suppress Google Translate native toolbar */}
        <style>{`
          .goog-te-banner-frame, .goog-te-balloon-frame { display: none !important; }
          .goog-te-gadget { display: none !important; }
          body { top: 0 !important; }
          .skiptranslate { display: none !important; }
          #google_translate_element { display: none !important; }
        `}</style>
        {/*
          SYNC SCRIPT — runs before GT loads.
          If user clicked EN, we mark the html element with 'notranslate'
          so Google Translate sees it and skips the page entirely.
          This is the ONLY reliable way to prevent GT re-applying Spanish.
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            if (sessionStorage.getItem('crm_gt_restore_en') === '1') {
              sessionStorage.removeItem('crm_gt_restore_en');
              document.documentElement.classList.add('notranslate');
              document.documentElement.setAttribute('translate', 'no');
            }
          })();
        `}} />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                  var refreshing = false;
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                  });
                });
              }
            `,
          }}
        />
        <GoogleProviderWrapper>
          <ThemeProvider>
            <I18nProvider>
              <LanguageProvider>
                <RoleProvider>
                  <NotificationProvider>
                    <TelemetryTracker />
                    <SpaceAtmosphere />
                    <AppContent>{children}</AppContent>
                    <OmniSearch />
                    <QuickAddFab />
                    <GlobalLimitModal />
                  </NotificationProvider>
                </RoleProvider>
              </LanguageProvider>
            </I18nProvider>
          </ThemeProvider>
        </GoogleProviderWrapper>

      </body>
    </html>
  );
}
