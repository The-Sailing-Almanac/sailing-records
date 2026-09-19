"use client";

import React, { useState, useEffect, useRef } from "react";
import { Copy, Check, Rss, Loader2, ArrowRight } from "lucide-react";
import Symbol from "../components/Symbol";

import { Entity, ArticleLink as Article } from "@almanac/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function FeedBuilderPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [previewArticles, setPreviewArticles] = useState<Article[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search for entities
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(`${API_BASE}/api/entities?q=${encodeURIComponent(searchTerm)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already selected entities
          const filtered = (data.data.entities || []).filter(
            (e: Entity) => !selectedEntities.some((sel) => sel.id === e.id)
          );
          setSearchResults(filtered);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Entity search failed:", err);
      } finally {
        setLoadingSearch(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedEntities]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectEntity = (entity: Entity) => {
    setSelectedEntities([...selectedEntities, entity]);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removeEntity = (entityId: number) => {
    setSelectedEntities(selectedEntities.filter((e) => e.id !== entityId));
  };

  // Generate Feed URL and fetch Preview Articles
  const generateFeed = async () => {
    if (selectedEntities.length === 0) return;

    const slugs = selectedEntities.map((e) => e.slug).join(",");
    const generatedUrl = `${API_BASE}/api/feeds/combined?entities=${slugs}`;
    setFeedUrl(generatedUrl);

    setLoadingPreview(true);
    try {
      // Fetch preview matching selected entities (use the combined feed but return JSON or detail search)
      const res = await fetch(`${API_BASE}/api/entities?limit=10`); // Fallback list
      // Wait, let's fetch articles matching the slugs from the API details if possible
      // Let's call /api/feeds/combined?entities=..., but wait: combined returns XML.
      // So we can query details for the first entity, or simulate. Let's do a simulation/fetch.
      const articlesList: Article[] = [];
      for (const ent of selectedEntities) {
        const detailRes = await fetch(`${API_BASE}/api/entities/${ent.slug}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          articlesList.push(...(detailData.data.articles || []));
        }
      }
      // Sort and dedup by published_at DESC, limit to 10
      const uniqueArticles = Array.from(new Map(articlesList.map(a => [a.id, a])).values())
        .sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime())
        .slice(0, 10);

      setPreviewArticles(uniqueArticles);
    } catch (err) {
      console.error("Preview load failed:", err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const copyToClipboard = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container" style={{ padding: "40px 0 80px 0" }}>
      <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "24px", marginBottom: "48px" }}>
        <h1 style={{ fontSize: "40px", fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "12px" }}>
          Custom RSS Feed Builder
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "600px" }}>
          Construct a personalized RSS feed by combining topics, boat classes, yacht clubs, or geographic hubs.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "40px" }} className="builder-grid">
        {/* Left Control Card */}
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "32px",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>Select Entities to Follow</h2>
          
          <div ref={dropdownRef} style={{ position: "relative", marginBottom: "24px" }}>
            <input
              type="text"
              placeholder="Search yacht clubs, classes, regattas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.trim() && setShowDropdown(true)}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "15px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            {loadingSearch && (
              <Loader2 className="animate-spin" style={{ position: "absolute", right: "12px", top: "12px", width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
            )}

            {showDropdown && searchResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  zIndex: 10,
                  maxHeight: "200px",
                  overflowY: "auto",
                  boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
                }}
              >
                {searchResults.map((ent) => (
                  <button
                    key={ent.id}
                    onClick={() => selectEntity(ent)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 16px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    className="dropdown-item"
                  >
                    <Symbol name={getSymbolNameForType(ent.entity_type || "")} size={16} />
                    <span>{ent.canonical_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
            {selectedEntities.map((ent) => (
              <div
                key={ent.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "100px",
                  background: "var(--primary-glow)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                <Symbol name={getSymbolNameForType(ent.entity_type || "")} size={12} color="var(--primary)" />
                <span>{ent.canonical_name}</span>
                <button
                  onClick={() => removeEntity(ent.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    cursor: "pointer",
                    marginLeft: "4px",
                    padding: 0,
                    fontWeight: "bold",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {selectedEntities.length === 0 && (
              <span style={{ fontSize: "14px", color: "var(--text-muted)", fontStyle: "italic" }}>
                No entities selected yet.
              </span>
            )}
          </div>

          <button
            onClick={generateFeed}
            disabled={selectedEntities.length === 0}
            className="btn btn-primary"
            style={{ width: "100%", display: "flex", justifyContent: "center", gap: "8px", padding: "14px 0" }}
          >
            <Rss style={{ width: "18px", height: "18px" }} />
            <span>Generate Feed URL</span>
          </button>
        </div>

        {/* Right Preview/URL Card */}
        {feedUrl && (
          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-lg)",
              padding: "32px",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>Your Combined Feed</h2>
            
            <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
              <input
                type="text"
                readOnly
                value={feedUrl}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: "14px",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-secondary)",
                  outline: "none",
                }}
              />
              <button
                onClick={copyToClipboard}
                className="btn btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "12px 16px" }}
              >
                {copied ? <Check style={{ width: "16px", height: "16px", color: "var(--success)" }} /> : <Copy style={{ width: "16px", height: "16px" }} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
              Feed Article Preview
            </h3>

            {loadingPreview ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
                <Loader2 className="animate-spin" style={{ width: "24px", height: "24px", animation: "spin 1s linear infinite" }} />
              </div>
            ) : previewArticles.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {previewArticles.map((art) => {
                  const url = art.redirect_hash
                    ? `${API_BASE}/sendit/${art.redirect_hash}?src=builder_preview`
                    : art.canonical_url;
                  return (
                    <div key={art.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)", textDecoration: "none" }} className="hover-link">
                        {art.title}
                      </a>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {art.publisher_name} • {new Date(art.published_at || "").toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                No recent articles match your selected entities.
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .dropdown-item:hover {
          background-color: var(--primary-glow) !important;
        }
        .hover-link:hover {
          color: var(--primary) !important;
        }
      `}</style>
    </div>
  );
}

// Map database type to symbol names available in getSymbol
function getSymbolNameForType(type: string): any {
  const entityMap: Record<string, string> = {
    boat_class:    "oneDesign",
    yacht_club:    "burgee",
    regatta:       "regattaTrophy",
    sailor:        "helm",
    body_of_water: "waveField",
    manufacturer:  "keelSection",
    region:        "mapPinWake",
    rating_system: "chartContour",
    sail_maker:    "sailPanel",
    sail_loft:     "sailPanel",
  };
  return entityMap[type] || "waveField";
}
