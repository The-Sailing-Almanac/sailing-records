"use client";

import { useEffect, useState, useCallback } from "react";

interface TickerArticle {
  id: string;
  title: string;
  canonical_url: string;
  publisher_name: string | null;
  published_at: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const REFRESH_INTERVAL_MS = 60_000;

export default function LiveTicker() {
  const [articles, setArticles] = useState<TickerArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [viewMode, setViewMode] = useState<"standard" | "brutalist">("standard");

  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ticker`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setArticles(data.data.articles || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTicker();
    const interval = setInterval(fetchTicker, REFRESH_INTERVAL_MS);

    // Sync layout changes
    const syncLayout = () => {
      const currentView = document.body.getAttribute("data-view") as "standard" | "brutalist" || "standard";
      setViewMode(currentView);
    };
    syncLayout();

    window.addEventListener("view-mode-change", syncLayout);
    return () => {
      clearInterval(interval);
      window.removeEventListener("view-mode-change", syncLayout);
    };
  }, [fetchTicker]);

  if (loading) {
    return (
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
        Loading latest dispatches…
      </div>
    );
  }

  if (error || articles.length === 0) {
    return (
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
        {error ? "⚡ Live ticker temporarily offline" : "No live dispatches yet — check back soon."}
      </div>
    );
  }

  if (viewMode === "brutalist") {
    return (
      <div style={{
        borderBottom: "2px solid #333333",
        background: "#000000",
        padding: "20px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", fontSize: "12px", fontWeight: "bold", color: "#ff0055" }}>
          <span style={{ width: "8px", height: "8px", background: "#ff0055", display: "inline-block" }} />
          ROLLING SAILING ALMANAC FEED [BRUTALIST REPORT MODE]
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {articles.map((a) => (
            <div 
              key={a.id} 
              style={{ 
                fontSize: "12px", 
                borderBottom: "1px dashed #222222", 
                paddingBottom: "6px",
                display: "flex",
                gap: "10px"
              }}
            >
              <span style={{ color: "#888888", flexShrink: 0, width: "100px" }}>
                [{a.published_at ? new Date(a.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "LIVE"}]
              </span>
              <span style={{ color: "#ff0055", flexShrink: 0, fontWeight: "bold" }}>
                {a.publisher_name ? `[${a.publisher_name.toUpperCase().slice(0, 15)}]` : "[ALMANAC]"}
              </span>
              <a 
                href={a.canonical_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ color: "#ffffff", textDecoration: "underline" }}
              >
                {a.title}
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderTop: "1px solid var(--border-color)",
      borderBottom: "1px solid var(--border-color)",
      background: "var(--bg-secondary)",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* "LIVE" badge */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        background: "var(--primary)",
        color: "#fff",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        zIndex: 2,
        gap: "6px",
      }}>
        <span style={{ width: "6px", height: "6px", background: "#fff", borderRadius: "50%", display: "inline-block", animation: "pulse 1.5s infinite" }} />
        LIVE
      </div>

      {/* Scrolling ticker */}
      <div style={{ paddingLeft: "72px", overflow: "hidden" }}>
        <div style={{
          display: "flex",
          gap: "48px",
          padding: "10px 0",
          animation: "ticker-scroll 60s linear infinite",
          width: "max-content",
          whiteSpace: "nowrap",
         }}>
          {/* Double the items so the loop is seamless */}
          {[...articles, ...articles].map((a, i) => (
            <a
              key={`${a.id}-${i}`}
              href={a.canonical_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              {a.publisher_name && (
                <span style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {a.publisher_name}
                </span>
              )}
              <span style={{ color: "var(--border-color)" }}>›</span>
              <span>{a.title}</span>
            </a>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

