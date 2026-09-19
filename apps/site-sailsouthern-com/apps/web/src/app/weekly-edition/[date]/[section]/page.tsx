import React from "react";
import Link from "next/link";
import { ChevronLeft, Calendar, ExternalLink } from "lucide-react";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

async function getWeeklyArchiveSection(date: string, section: string) {
  try {
    const res = await fetch(`${API_BASE}/api/editions/${date}/${section}?type=weekly`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error(`[Weekly Archive Section] Failed to fetch date ${date} section ${section}:`, err);
    return null;
  }
}

export default async function WeeklyArchiveSectionPage({
  params,
}: {
  params: Promise<{ date: string; section: string }>;
}) {
  const { date, section } = await params;
  const data = await getWeeklyArchiveSection(date, section);

  if (!data || !data.articles || data.articles.length === 0) {
    return (
      <div className="container" style={{ padding: "80px 0", textAlign: "center" }}>
        <h2 style={{ fontSize: "28px", marginBottom: "16px" }}>Section Archive Not Found</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>
          We couldn't find any articles for section "{section}" on weekly edition {date}.
        </p>
        <Link href={`/weekly-edition/${date}`} className="btn btn-primary">
          Return to Weekly Edition
        </Link>
      </div>
    );
  }

  const { articles } = data;
  const sectionName = articles[0]?.section_display_name || section;

  return (
    <div className="container" style={{ padding: "40px 0 80px 0" }}>
      <div style={{ marginBottom: "32px", display: "flex", gap: "16px" }}>
        <Link
          href={`/weekly-edition/${date}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--primary)",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          <ChevronLeft style={{ width: "16px", height: "16px" }} />
          <span>Back to Weekly Edition</span>
        </Link>
      </div>

      <main>
        <div
          style={{
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "20px",
            marginBottom: "40px",
          }}
        >
          <div style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
            Weekly Section Spotlight
          </div>
          <h1
            style={{
              fontSize: "36px",
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: "8px",
            }}
          >
            {sectionName}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "var(--text-muted)" }}>
            <Calendar style={{ width: "14px", height: "14px" }} />
            <span>Weekly Edition Date: {new Date(date).toLocaleDateString()}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px" }}>
          {articles.map((item: any) => {
            const senditUrl = item.redirect_hash
              ? `${API_BASE}/sendit/${item.redirect_hash}?src=web_weekly_section`
              : item.canonical_url;
            return (
              <article
                key={item.id}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-lg)",
                  padding: "32px",
                  boxShadow: "var(--glass-shadow)",
                  display: "grid",
                  gridTemplateColumns: item.og_image_url ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr",
                  gap: "32px",
                  alignItems: "center",
                }}
              >
                {item.og_image_url && (
                  <div style={{ position: "relative", width: "100%", height: "200px", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img
                      src={item.og_image_url}
                      alt={item.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px", fontFamily: "var(--font-sans)" }}>
                    <a
                      href={senditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--text-primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}
                      className="hover-link"
                    >
                      <span>{item.title}</span>
                      <ExternalLink style={{ width: "16px", height: "16px", color: "var(--text-muted)", flexShrink: 0 }} />
                    </a>
                  </h3>
                  {item.content_snippet && (
                    <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginBottom: "20px" }}>
                      {item.content_snippet.slice(0, 240)}...
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                    {item.publisher_name && <span>{item.publisher_name}</span>}
                    {item.published_at && (
                      <>
                        <span>•</span>
                        <span>{new Date(item.published_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <style>{`
        .hover-link:hover {
          color: var(--primary) !important;
        }
      `}</style>
    </div>
  );
}
