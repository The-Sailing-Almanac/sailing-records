import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, Heart } from "lucide-react";
import Symbol from "../components/Symbol";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

async function getPublicSupporters() {
  try {
    const res = await fetch(`${API_BASE}/api/supporters/public`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data.supporters || [];
  } catch (err) {
    console.error("[Supporters Index] Failed to fetch public supporters:", err);
    return [];
  }
}

export const metadata = {
  title: "Almanac Supporters & Patrons | Sail Southern",
  description: "The archive of our founding members, patrons, and weekly supporters who make the Sailing Almanac project possible.",
};

const TIER_DESCRIPTIONS: Record<string, string> = {
  "founding_member": "Founding Members — Permanent archival patrons credited for establishing the digital deck.",
  "patron": "Patrons — Leading sponsors supporting open-access sailing records and priority content.",
  "lead_patron": "Lead Patrons — Executive stewards with direct operational sponsorship of our publications.",
  "supporter": "Supporters — Active monthly/annual readers backing weekly dispatches.",
  "weekly_pwyw": "Weekly Contributors — Pay-what-you-feel direct contribution community.",
};

export default async function SupportersPage() {
  const supporters = await getPublicSupporters();

  // Group supporters by tier_name (excluding free tier)
  const grouped: Record<string, any[]> = {};
  for (const s of supporters) {
    const key = s.tier_name || "supporter";
    if (key.toLowerCase() === "free reader" || key.toLowerCase() === "free") continue;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(s);
  }

  return (
    <div className="container" style={{ padding: "60px 0 100px 0", maxWidth: "800px" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ display: "inline-flex", padding: "8px", borderRadius: "50%", background: "var(--primary-glow)", color: "var(--primary)", marginBottom: "16px" }}>
          <Heart style={{ width: "36px", height: "36px" }} />
        </div>
        <h1 style={{ fontSize: "40px", fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "12px" }}>
          Almanac Supporters
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto" }}>
          The Sailing Almanac project is built to preserve permanent, machine-readable sailing history. We are funded entirely by our readers and sponsors.
        </p>
      </div>

      {/* Grouped Tiers Display */}
      <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
        {Object.entries(TIER_DESCRIPTIONS).map(([tierKey, desc]) => {
          // Find matches in grouped
          // Map tierKey to database tier name strings
          const matchKey = getDisplayNameForTierKey(tierKey);
          const list = grouped[matchKey] || [];

          if (list.length === 0 && (tierKey === "lead_patron" || tierKey === "patron")) {
            // Keep empty list display for premium tiers to highlight the serious patronage tier structure
          } else if (list.length === 0) {
            return null;
          }

          return (
            <section
              key={tierKey}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-lg)",
                padding: "32px",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase" }}>
                  {matchKey}
                </h2>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>{desc}</p>
              </div>

              {list.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                  {list.map((supporter, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <ShieldCheck style={{ width: "16px", height: "16px", color: "var(--primary)", flexShrink: 0 }} />
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600 }}>{supporter.display_name || "Anonymous Supporter"}</span>
                        {supporter.social_handle && (
                          <a
                            href={getSocialUrl(supporter.social_handle, supporter.social_platform)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "block", fontSize: "11px", color: "var(--primary)", textDecoration: "none" }}
                          >
                            @{supporter.social_handle}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "14px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "16px" }}>
                  Sponsorship tier available.
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Call to action section */}
      <section
        style={{
          marginTop: "48px",
          background: "linear-gradient(135deg, var(--primary-glow) 0%, transparent 100%)",
          border: "1px solid var(--primary)",
          borderRadius: "var(--radius-lg)",
          padding: "40px",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "12px", fontFamily: "var(--font-heading)" }}>
          Support Sailing History
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px", maxWidth: "600px", margin: "0 auto 24px auto", lineHeight: "1.6" }}>
          Help us fund daily crawler tasks, Gemini entity extraction models, and expand database capacity.
        </p>
        <Link href="/support" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <span>Become a Supporter</span>
          <ArrowRight style={{ width: "16px", height: "16px" }} />
        </Link>
      </section>
    </div>
  );
}

function getDisplayNameForTierKey(key: string): string {
  const map: Record<string, string> = {
    free: "Free Reader",
    supporter: "Supporter",
    founding_member: "Founding Member",
    patron: "Patron",
    lead_patron: "Lead Patron",
    weekly_pwyw: "Weekly Edition",
  };
  return map[key] || key;
}

function getSocialUrl(handle: string, platform?: string): string {
  const clean = handle.replace(/^@/, "");
  if (platform?.toLowerCase() === "twitter" || platform?.toLowerCase() === "x") {
    return `https://x.com/${clean}`;
  }
  if (platform?.toLowerCase() === "github") {
    return `https://github.com/${clean}`;
  }
  return `#`;
}
