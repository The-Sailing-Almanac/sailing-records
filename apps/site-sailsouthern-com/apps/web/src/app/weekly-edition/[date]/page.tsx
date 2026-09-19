import React from "react";
import { marked } from "marked";
import Link from "next/link";
import { ChevronLeft, Calendar } from "lucide-react";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

async function getWeeklyEdition(date: string) {
  try {
    const res = await fetch(`${API_BASE}/api/editions/${date}?type=weekly`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error(`[Weekly Edition] Failed to fetch date ${date}:`, err);
    return null;
  }
}

export default async function WeeklyEditionPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const data = await getWeeklyEdition(date);

  if (!data || !data.edition) {
    return (
      <div className="container" style={{ padding: "80px 0", textAlign: "center" }}>
        <h2 style={{ fontSize: "28px", marginBottom: "16px" }}>Weekly Edition Not Found</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>
          We couldn't find a weekly edition for {date}.
        </p>
        <Link href="/" className="btn btn-primary">
          Return to Deck
        </Link>
      </div>
    );
  }

  const { edition, markdown } = data;
  const htmlContent = await marked.parse(markdown || "");

  return (
    <div className="container" style={{ padding: "40px 0 80px 0" }}>
      <div style={{ marginBottom: "32px" }}>
        <Link
          href="/"
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
          <span>Back to Live Deck</span>
        </Link>
      </div>

      <main
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-lg)",
          padding: "48px",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <div
          style={{
            borderBottom: "2px double var(--border-color)",
            paddingBottom: "24px",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          <div style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
            Weekly Editorial Summary
          </div>
          <h1
            style={{
              fontSize: "40px",
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: "12px",
            }}
          >
            {edition.edition_label || "The Weekly Digest"}
          </h1>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", fontSize: "14px", color: "var(--text-muted)" }}>
            <Calendar style={{ width: "14px", height: "14px" }} />
            <time>
              {new Date(edition.edition_date).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </div>

        <article
          className="edition-article"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          style={{
            fontSize: "17px",
            lineHeight: "1.7",
            color: "var(--text-primary)",
          }}
        />
      </main>

      <style>{`
        .edition-article h2 {
          font-family: var(--font-heading);
          font-size: 28px;
          font-weight: 700;
          color: var(--primary);
          margin-top: 48px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .edition-article h2:first-of-type {
          margin-top: 0;
        }
        .edition-article h3 {
          font-family: var(--font-sans);
          font-size: 20px;
          font-weight: 600;
          margin-top: 32px;
          margin-bottom: 12px;
          color: var(--text-primary);
        }
        .edition-article h3 a {
          color: var(--text-primary);
          text-decoration: none;
          background-image: linear-gradient(120deg, var(--primary-glow) 0%, var(--primary-glow) 100%);
          background-repeat: no-repeat;
          background-size: 100% 0.2em;
          background-position: 0 92%;
          transition: background-size 0.2s ease;
        }
        .edition-article h3 a:hover {
          background-size: 100% 100%;
          color: var(--primary);
        }
        .edition-article p {
          margin-bottom: 20px;
          color: var(--text-secondary);
        }
        .edition-article img {
          max-width: 100%;
          height: auto;
          border-radius: var(--radius-md);
          margin: 16px 0 24px 0;
          box-shadow: var(--glass-shadow);
          border: 1px solid var(--border-color);
        }
        .edition-article em {
          font-size: 13px;
          color: var(--text-muted);
          display: block;
          margin-top: -8px;
          margin-bottom: 24px;
        }
        .edition-article hr {
          border: 0;
          height: 1px;
          background: var(--border-color);
          margin: 40px 0;
        }
        .edition-article a[href*="/sections/"], .edition-article a[href*="/topics/"] {
          display: inline-flex;
          align-items: center;
          font-weight: 600;
          font-size: 14px;
          color: var(--primary) !important;
          text-decoration: none;
          margin-top: 8px;
          transition: transform 0.2s ease;
        }
        .edition-article a[href*="/sections/"]:hover, .edition-article a[href*="/topics/"]:hover {
          transform: translateX(4px);
        }
      `}</style>
    </div>
  );
}
