"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, ExternalLink } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  canonical_url: string;
  redirect_hash: string | null;
  publisher_name: string | null;
  published_at: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.data.results || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search the sailing news knowledgebase..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
          style={{
            width: "100%",
            padding: "14px 16px 14px 48px",
            fontSize: "16px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-primary)",
            outline: "none",
            boxShadow: "var(--glass-shadow)",
            transition: "all 0.2s ease",
          }}
          className="search-input"
        />
        <div style={{ position: "absolute", left: "16px", display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
          {loading ? (
            <Loader2 className="animate-spin" style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite" }} />
          ) : (
            <Search style={{ width: "20px", height: "20px" }} />
          )}
        </div>
      </div>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "var(--glass-bg)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            zIndex: 10,
            maxHeight: "400px",
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {results.length > 0 ? (
            results.map((r) => {
              const url = r.redirect_hash
                ? `${API_BASE}/sendit/${r.redirect_hash}?src=search`
                : r.canonical_url;
              return (
                <a
                  key={r.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "12px 16px",
                    textDecoration: "none",
                    color: "var(--text-primary)",
                    borderBottom: "1px solid var(--border-color)",
                    transition: "background 0.15s ease",
                  }}
                  className="search-result-item"
                  onClick={() => setShowDropdown(false)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 500, fontSize: "14px", lineHeight: "1.4" }}>{r.title}</span>
                    <ExternalLink style={{ width: "14px", height: "14px", color: "var(--text-muted)", flexShrink: 0, marginTop: "3px" }} />
                  </div>
                  <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    {r.publisher_name && <span>{r.publisher_name}</span>}
                    {r.published_at && (
                      <>
                        <span>•</span>
                        <span>{new Date(r.published_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </a>
              );
            })
          ) : (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              No matches found
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .search-input:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px var(--primary-glow) !important;
        }
        .search-result-item:hover {
          background: var(--primary-glow) !important;
        }
        .search-result-item:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}
