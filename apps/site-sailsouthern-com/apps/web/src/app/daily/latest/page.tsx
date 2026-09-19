/**
 * /daily/latest — redirect to the most recent published edition.
 *
 * Lookup order:
 * 1. newsletter_editions (structured editorial path) → /daily/[edition_date]
 * 2. newsletters table (email path fallback) → /daily/[date from created_at]
 * 3. Neither exists → graceful "no edition yet" page
 *
 * This is the "current issue" semantic that was previously missing.
 */
import { redirect } from "next/navigation";
import React from "react";
import { Calendar } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

async function resolveLatestEditionDate(): Promise<string | null> {
  // 1. Try newsletter_editions (structured editorial path)
  try {
    const res = await fetch(`${API_BASE}/api/v1/editions/current`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.edition?.edition_date) {
        const dateStr = new Date(data.data.edition.edition_date)
          .toISOString()
          .split("T")[0];
        return dateStr;
      }
    }
  } catch {
    // fall through to next lookup
  }

  // 2. Fall back to newsletters table (email path)
  try {
    const res = await fetch(`${API_BASE}/api/v1/newsletters/latest`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.newsletter?.created_at) {
        const dateStr = new Date(data.data.newsletter.created_at)
          .toISOString()
          .split("T")[0];
        return dateStr;
      }
    }
  } catch {
    // fall through to empty state
  }

  return null;
}

export const metadata = {
  title: "Latest Edition | Sailing Almanac",
  description: "Read the most recent daily edition of the Sailing Almanac.",
  robots: { index: false }, // avoid indexing redirect page
};

export default async function DailyLatestPage() {
  const date = await resolveLatestEditionDate();

  if (date) {
    redirect(`/daily/${date}`);
  }

  // No edition published yet — graceful empty state
  return (
    <div
      className="container"
      style={{
        padding: "80px 0 100px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px dashed var(--border-color)",
          borderRadius: "var(--radius-lg)",
          padding: "64px 48px",
          maxWidth: "600px",
          width: "100%",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <Calendar
          style={{
            width: "52px",
            height: "52px",
            margin: "0 auto 20px auto",
            color: "var(--primary)",
            opacity: 0.6,
          }}
        />
        <h1
          style={{
            fontSize: "32px",
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: "12px",
          }}
        >
          No Edition Published Yet
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "16px",
            lineHeight: "1.6",
            marginBottom: "32px",
          }}
        >
          The first daily edition hasn&apos;t been compiled yet. Once a daily
          issue is generated, it will appear here automatically.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/daily" className="btn btn-secondary"
            style={{ padding: "10px 20px", borderRadius: "var(--radius-md)", fontSize: "14px", fontWeight: 600 }}>
            Browse Archive
          </Link>
          <Link href="/" className="btn btn-primary"
            style={{ padding: "10px 20px", borderRadius: "var(--radius-md)", fontSize: "14px", fontWeight: 600 }}>
            Return to Deck
          </Link>
        </div>

        {/* Operator context — visible when DB is empty */}
        <div
          style={{
            marginTop: "40px",
            padding: "16px 20px",
            background: "rgba(var(--primary-rgb, 10, 110, 138), 0.07)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            fontSize: "13px",
            color: "var(--text-muted)",
            textAlign: "left",
          }}
        >
          <strong style={{ color: "var(--text-secondary)" }}>Operator note:</strong> Run{" "}
          <code
            style={{
              background: "var(--bg-primary)",
              padding: "1px 6px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          >
            npx tsx scripts/compile-edition.ts
          </code>{" "}
          to compile the first daily issue, then visit this page again. Use{" "}
          <code
            style={{
              background: "var(--bg-primary)",
              padding: "1px 6px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          >
            --dry-run
          </code>{" "}
          first to preview without writing.
        </div>
      </div>
    </div>
  );
}
