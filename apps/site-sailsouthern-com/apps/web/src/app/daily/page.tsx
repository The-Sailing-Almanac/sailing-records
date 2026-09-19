import React from "react";
import Link from "next/link";
import { Calendar, Mail, Rss, ArrowRight } from "lucide-react";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

interface NewsletterItem {
  id: number;
  title: string;
  status: string;
  created_at: string;
}

async function getNewsletterArchive(): Promise<NewsletterItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/newsletters/archive`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data.newsletters || [];
  } catch (err) {
    console.error("[Newsletter Archive] Failed to fetch archive:", err);
    return [];
  }
}

export default async function DailyArchiveIndexPage() {
  const newsletters = await getNewsletterArchive();

  return (
    <div className="container" style={{ padding: "60px 0 100px 0" }}>
      {/* Header section with gradients & premium feel */}
      <div
        style={{
          background: "radial-gradient(ellipse at top left, var(--primary-glow) 0%, transparent 60%)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          padding: "48px",
          marginBottom: "48px",
          boxShadow: "var(--glass-shadow)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px",
        }}
      >
        <div style={{ maxWidth: "600px" }}>
          <div
            style={{
              color: "var(--primary)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            Sailing Almanac
          </div>
          <h1
            style={{
              fontSize: "44px",
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: "16px",
              lineHeight: 1.1,
            }}
          >
            The Daily Gazette Archive
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "16px", lineHeight: "1.6" }}>
            Explore retroactive and today's news compilations generated for our daily subscribers. We track and summarize regatta results, class updates, and coastal dispatches.
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "16px", padding: "8px 12px", background: "var(--primary-glow)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
            <Calendar style={{ width: "16px", height: "16px", color: "var(--primary)", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              <strong>Historical Reconstruction:</strong> Archive editions pre-dating June 2026 are retroactively reconstructed to preserve a complete historical record of southern sailing.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px" }}>
          <a
            href={`${API_BASE}/api/v1/newsletters/feed.rss`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <Rss style={{ width: "16px", height: "16px" }} />
            <span>RSS Feed</span>
          </a>
          <a
            href="/#subscribe"
            className="btn btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <Mail style={{ width: "16px", height: "16px" }} />
            <span>Subscribe</span>
          </a>
        </div>
      </div>

      {/* Archive List */}
      <h2
        style={{
          fontSize: "24px",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: "24px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "12px",
        }}
      >
        Published Editions ({newsletters.length})
      </h2>

      {newsletters.length === 0 ? (
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px dashed var(--border-color)",
            borderRadius: "var(--radius-md)",
            padding: "60px",
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          <Calendar style={{ width: "48px", height: "48px", margin: "0 auto 16px auto", color: "var(--text-muted)" }} />
          <h3>No Gazette Editions Found</h3>
          <p style={{ marginTop: "8px" }}>Editions will appear here as soon as they are compiled.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
          {newsletters.map((nl) => {
            const dateStr = new Date(nl.created_at).toISOString().split("T")[0];
            const isHistorical = new Date(nl.created_at) < new Date("2026-06-01");
            return (
              <Link
                key={nl.id}
                href={`/daily/${dateStr}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "24px 32px",
                  textDecoration: "none",
                  transition: "all 0.2s ease-in-out",
                  boxShadow: "var(--glass-shadow)",
                }}
                className="archive-card"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                  <div
                    style={{
                      background: "var(--primary-glow)",
                      color: "var(--primary)",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 12px",
                      fontSize: "13px",
                      fontWeight: 700,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: "80px",
                    }}
                  >
                    <span>{new Date(nl.created_at).toLocaleDateString("en-US", { month: "short" })}</span>
                    <span style={{ fontSize: "20px", fontWeight: 800 }}>
                      {new Date(nl.created_at).toLocaleDateString("en-US", { day: "numeric" })}
                    </span>
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h3
                        style={{
                          fontSize: "20px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          marginBottom: "6px",
                        }}
                        className="card-title"
                      >
                        {nl.title}
                      </h3>
                      {isHistorical && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "10px",
                            background: "var(--primary-glow)",
                            color: "var(--primary)",
                            border: "1px solid var(--primary)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: "6px",
                          }}
                        >
                          Reconstructed
                        </span>
                      )}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                      Published: {new Date(nl.created_at).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    color: "var(--primary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                  className="read-link"
                >
                  <span>Read Gazette</span>
                  <ArrowRight style={{ width: "16px", height: "16px" }} className="arrow" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .archive-card:hover {
          transform: translateY(-2px);
          border-color: var(--primary) !important;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }
        .archive-card:hover .card-title {
          color: var(--primary) !important;
        }
        .archive-card:hover .read-link .arrow {
          transform: translateX(4px);
        }
        .read-link .arrow {
          transition: transform 0.2s ease;
        }
      `}</style>
    </div>
  );
}
