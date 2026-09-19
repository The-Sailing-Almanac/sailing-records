/**
 * ReadinessSurface — Sail Southern domain surface.
 * Answers one question: "Can we safely publish?"
 * Fetches GET /api/v1/system/readiness and renders ReadinessCards.
 * Classification: Sail Southern-specific (wraps STAX-shared ReadinessCard)
 */
"use client";
import React, { useState, useEffect } from "react";
import { SectionShell } from "../commander/SectionShell";
import { ReadinessCard, ReadinessStatus } from "../commander/ReadinessCard";
import { StatusCard } from "../commander/StatusCard";
import { Loader2, RefreshCw } from "lucide-react";

interface ReadinessIntegration {
  name: string;
  category: string;
  status: ReadinessStatus;
  configured: string[];
  missing: string[];
  remediation?: string;
  archive_mode?: string;
}

interface ReadinessData {
  publish_ready: boolean;
  summary: { ready: number; partial: number; blocked: number; total: number };
  last_run: { status: string | null; completed_at: string | null };
  integrations: ReadinessIntegration[];
}

function detailText(i: ReadinessIntegration): string {
  if (i.status === "ready") return i.configured.join(", ") || "All required credentials are set.";
  const parts: string[] = [];
  if (i.configured.length > 0) parts.push(`Configured: ${i.configured.join(", ")}`);
  if (i.missing.length > 0) parts.push(`Missing: ${i.missing.join(", ")}`);
  return parts.join(" · ") || "Not configured.";
}

const WHY: Record<string, string> = {
  "Publishing credentials": "Required to publish posts to Mastodon, Nostr, and Bluesky.",
  "Archive credentials": "Authenticated Wayback captures get higher rate limits and better reliability.",
  "Admin authentication": "Protects the command center from unauthorized access.",
  "Analytics — Measurement Protocol": "Server-side GA4 events for publish, archive, and engagement tracking. See ops/analytics-setup.md for setup steps.",
  "Analytics — Data API (dashboard)": "Powers the analytics dashboard. Requires a GA4 Property ID (numeric, prefixed with 'properties/'). See ops/analytics-setup.md.",
  "Scheduler": "BullMQ scheduler drives timed micro-edition publishing. Workers must also be running.",
  "Lightning / Value-for-Value": "Enables readers to support directly with Lightning payments.",
  "Production database migrations": "Ensures all schema features are active in the live database.",
  "Newsletter generation": "Required to compile and generate daily issues. Used by both compile-edition.ts (web) and generate-daily-newsletter.ts (email).",
  "Email delivery": "Required to broadcast the newsletter to subscribers via Resend. Web publish works without this — it only gates email.",
};

export function ReadinessSurface() {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin-proxy/v1/system/readiness");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to load readiness data:", err);
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <Loader2 className="animate-spin" style={{ width: "32px", height: "32px", color: "var(--primary)" }} />
    </div>
  );

  const publishReadyBadge = data?.publish_ready
    ? { label: "Ready to publish", color: "green" as const }
    : { label: "Not ready", color: "red" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Headline answer */}
      <SectionShell
        title="Can we safely publish?"
        icon="🚦"
        badge={publishReadyBadge}
        actions={
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw style={{ width: "13px", height: "13px" }} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      >
        {data && (
          <>
            {/* Summary row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
              <StatusCard label="Ready" value={data.summary.ready} valueColor="var(--success)" subtitle={`of ${data.summary.total} integrations`} />
              <StatusCard label="Partial" value={data.summary.partial} valueColor="var(--accent)" subtitle="configured but incomplete" />
              <StatusCard label="Configuration needed" value={data.summary.blocked} valueColor={data.summary.blocked > 0 ? "var(--error)" : "var(--success)"} subtitle="blocking items" />
              {data.last_run.completed_at && (
                <StatusCard label="Last publish" value={data.last_run.status === "success" ? "Published" : data.last_run.status === "failed" ? "Failed" : data.last_run.status || "—"} valueColor={data.last_run.status === "success" ? "var(--success)" : "var(--error)"} subtitle={new Date(data.last_run.completed_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })} />
              )}
            </div>

            {/* Integration cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.integrations.map((integration) => (
                <ReadinessCard
                  key={integration.name}
                  name={integration.name}
                  status={integration.status}
                  detail={detailText(integration)}
                  whyItMatters={WHY[integration.name] || ""}
                  remediation={integration.remediation}
                />
              ))}
            </div>
          </>
        )}
        {!data && (
          <div style={{ padding: "20px", color: "var(--text-muted)", textAlign: "center" }}>
            Could not load readiness data. Make sure the API is running.
          </div>
        )}
      </SectionShell>
    </div>
  );
}
