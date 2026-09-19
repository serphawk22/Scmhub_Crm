"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  actualTheme: "light" | "dark";
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  actualTheme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [actualTheme, setActualTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("crm-theme") as Theme | null;
    const initial = saved || "system";
    setThemeState(initial);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const applyTheme = (t: Theme) => {
      const resolvedTheme = t === "system" ? (mediaQuery.matches ? "dark" : "light") : t;
      setActualTheme(resolvedTheme);
      document.documentElement.setAttribute("data-theme", resolvedTheme);
      // Optional fallback class for Tailwind
      if (resolvedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme(initial);
    setMounted(true);

    const listener = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("crm-theme", t);
  };

  const toggleTheme = () => {
    const nextTheme = actualTheme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, toggleTheme, setTheme }}>
      {/* We render children even if not mounted because layout.tsx has suppressHydrationWarning */}
      <div style={{ visibility: mounted ? "visible" : "hidden", width: "100%", minHeight: "100vh" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
