"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Terminal, LayoutGrid } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewMode, setViewMode] = useState<"standard" | "brutalist">("standard");

  useEffect(() => {
    // Sync theme on load
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme === "dark" || (!savedTheme && prefersDark) ? "dark" : "light";
    
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark-theme");
    } else {
      document.documentElement.classList.remove("dark-theme");
    }

    // Sync view mode on load
    const savedView = localStorage.getItem("viewMode") as "standard" | "brutalist" | null;
    if (savedView) {
      setViewMode(savedView);
      document.body.setAttribute("data-view", savedView);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark-theme");
    } else {
      document.documentElement.classList.remove("dark-theme");
    }
  };

  const toggleViewMode = () => {
    const nextView = viewMode === "standard" ? "brutalist" : "standard";
    setViewMode(nextView);
    localStorage.setItem("viewMode", nextView);
    document.body.setAttribute("data-view", nextView);
    // Dispatch custom event to let other components know the layout shifted
    window.dispatchEvent(new Event("view-mode-change"));
  };

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
      {/* View Mode Toggle (Standard vs Brutalist) */}
      <button
        onClick={toggleViewMode}
        title={viewMode === "standard" ? "Switch to Brutalist Mode" : "Switch to Standard Mode"}
        style={{
          background: "transparent",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-sm)",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--text-primary)",
          transition: "var(--transition-fast)"
        }}
      >
        {viewMode === "standard" ? <Terminal size={18} /> : <LayoutGrid size={18} />}
      </button>

      {/* Theme Toggle (Light vs Dark) */}
      <button
        onClick={toggleTheme}
        title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        style={{
          background: "transparent",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-sm)",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--text-primary)",
          transition: "var(--transition-fast)"
        }}
      >
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </div>
  );
}
