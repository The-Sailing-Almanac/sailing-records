"use client";

import React, { useEffect, useState } from "react";
import useSWR from "swr";
import { marked } from "marked";
import { Waves, Calendar, RefreshCw } from "lucide-react";
import Symbol from "./Symbol";

interface EditionViewProps {
  initialEdition: any;
  initialMarkdown: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch current edition");
  return res.json();
};

export default function EditionView({ initialEdition, initialMarkdown }: EditionViewProps) {
  // Use SWR for client-side polling every 5 minutes (300,000 ms)
  const { data, error, mutate, isValidating } = useSWR(
    `${API_BASE}/api/editions/current`,
    fetcher,
    {
      fallbackData: { success: true, edition: initialEdition, markdown: initialMarkdown },
      refreshInterval: 300000, // 5 minutes
      revalidateOnFocus: true,
    }
  );

  const edition = data?.edition;
  const markdown = data?.markdown || "";
  const [htmlContent, setHtmlContent] = useState("");

  useEffect(() => {
    if (markdown) {
      // Parse markdown to HTML synchronously
      const html = marked.parse(markdown);
      setHtmlContent(html as string);
    }
  }, [markdown]);

  if (!edition) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0", color: "var(--text-secondary)" }}>
        <Waves style={{ width: "48px", height: "48px", strokeWidth: 1, marginBottom: "16px", color: "var(--primary)" }} className="animate-pulse" />
        <p>Searching for today's dispatches. Stand by...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      {/* Edition Banner Header */}
      <div
        style={{
          borderBottom: "2px double var(--border-color)",
          paddingBottom: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", color: "var(--primary)", fontSize: "14px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
          <Waves style={{ width: "16px", height: "16px" }} />
          <span>{edition.edition_type === "weekly" ? "Weekly Edition" : "Daily Gazette"}</span>
        </div>
        <h1
          style={{
            fontSize: "48px",
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            lineHeight: 1.1,
            color: "var(--text-primary)",
            marginBottom: "12px",
          }}
        >
          {edition.edition_label || "The Morning Deck"}
        </h1>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", fontSize: "14px", color: "var(--text-muted)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
          <span>•</span>
          <button
            onClick={() => mutate()}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "13px",
              padding: 0,
            }}
          >
            <RefreshCw style={{ width: "12px", height: "12px" }} className={isValidating ? "animate-spin" : ""} />
            <span>{isValidating ? "Syncing..." : "Sync Deck"}</span>
          </button>
        </div>
      </div>

      {/* Compiled Edition Content */}
      <article
        className="edition-article"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={{
          fontSize: "17px",
          lineHeight: "1.7",
          color: "var(--text-primary)",
        }}
      />

      <style jsx global>{`
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
