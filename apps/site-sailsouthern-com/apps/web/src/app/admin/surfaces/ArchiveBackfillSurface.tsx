/**
 * ArchiveBackfillSurface — Sail Southern domain surface.
 * Wayback SPN archival control: mode badge, backlog, retry failed, trigger batch.
 * Classification: Sail Southern-specific
 */
"use client";
import React, { useState, useEffect } from "react";
import { SectionShell } from "../commander/SectionShell";
import { StatusCard } from "../commander/StatusCard";
import { ActionBar } from "../commander/ActionBar";
import { Loader2, RefreshCw } from "lucide-react";

interface BackfillData {
  backlog: {
    pending_capture_count: number;
    wayback_auth_mode: "authenticated" | "anonymous";
    crawl_expansion_enabled: boolean;
  };
  capture_health: {
    completed: number;
    failed: number;
    success_rate_pct: number;
    authenticated_captures: number;
    anonymous_captures: number;
  };
}

export function ArchiveBackfillSurface() {
  const [data, setData] = useState<BackfillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin-proxy/v1/social/backfill");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Archive backfill load error:", err);
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRunBackfill = async () => {
    const res = await fetch("/api/admin-proxy/v1/social/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch_size: 25 }) });
    const d = await res.json();
    await load();
    return res.ok ? { ok: true, message: d.message || `Enqueued ${d.enqueued} capture job(s).` } : { ok: false, message: d.error?.message || "Backfill failed." };
  };

  const handleRetryFailed = async () => {
    const res = await fetch("/api/admin-proxy/v1/social/captures/retry-failed", { method: "POST" });
    const d = await res.json();
    await load();
    return res.ok ? { ok: true, message: d.message || `Retried ${d.enqueued} capture(s).` } : { ok: false, message: d.error?.message || "Retry failed." };
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <Loader2 className="animate-spin" style={{ width: "32px", height: "32px", color: "var(--primary)" }} />
    </div>
  );

  const archiveMode = data?.backlog.wayback_auth_mode || "anonymous";
  const modeBadge = archiveMode === "authenticated"
    ? { label: "Authenticated archive", color: "green" as const }
    : { label: "Unauthenticated archive", color: "yellow" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionShell
        title="Wayback Machine archival"
        icon="🏛️"
        badge={modeBadge}
        actions={
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw style={{ width: "13px", height: "13px" }} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      >
        {data ? (
          <>
            {/* Mode notice */}
            {archiveMode === "anonymous" && (
              <div style={{ padding: "12px 14px", background: "rgba(241,196,15,0.08)", border: "1px solid rgba(241,196,15,0.25)", borderRadius: "var(--radius-sm)", marginBottom: "16px" }}>
                <span style={{ fontSize: "13px", color: "var(--accent)" }}>
                  ⚠️ Running in unauthenticated mode — lower rate limits apply. Add <code>WAYBACK_ACCESS_KEY</code> and <code>WAYBACK_SECRET_KEY</code> from <a href="https://archive.org/account/s3.php" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>archive.org/account/s3.php</a> to enable authenticated captures.
                </span>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "20px" }}>
              <StatusCard
                label="Awaiting archive"
                value={data.backlog.pending_capture_count}
                valueColor={data.backlog.pending_capture_count > 0 ? "var(--accent)" : "var(--success)"}
                subtitle={data.backlog.pending_capture_count === 0 ? "All posts are archived" : "Posts published but not yet archived"}
              />
              <StatusCard label="Archived successfully" value={data.capture_health.completed} valueColor="var(--success)" />
              <StatusCard
                label="Capture success rate"
                value={`${data.capture_health.success_rate_pct}%`}
                valueColor={data.capture_health.success_rate_pct >= 90 ? "var(--success)" : "var(--accent)"}
              />
              <StatusCard
                label="Authenticated captures"
                value={data.capture_health.authenticated_captures}
                valueColor="var(--primary)"
                subtitle={`${data.capture_health.anonymous_captures} unauthenticated`}
              />
              {data.capture_health.failed > 0 && (
                <StatusCard label="Failed captures" value={data.capture_health.failed} valueColor="var(--error)" subtitle="Use 'Retry failed' below" />
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Archive actions</span>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <ActionBar
                  label="Run archive batch"
                  icon="▶"
                  variant="primary"
                  disabled={data.backlog.pending_capture_count === 0}
                  disabledReason="No posts awaiting archive."
                  onAction={handleRunBackfill}
                />
                {data.capture_health.failed > 0 && (
                  <ActionBar
                    label={`Retry ${data.capture_health.failed} failed capture${data.capture_health.failed === 1 ? "" : "s"}`}
                    icon="↩"
                    variant="secondary"
                    confirmRequired
                    confirmMessage={`This will re-queue ${data.capture_health.failed} failed Wayback capture(s). Continue?`}
                    onAction={handleRetryFailed}
                  />
                )}
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                Auto-scan: <strong>{data.backlog.crawl_expansion_enabled ? "Enabled — scanning every 5 minutes" : "Paused — set CRAWL_EXPANSION_ENABLED=true to resume"}</strong>
              </p>
            </div>
          </>
        ) : (
          <div style={{ padding: "20px", color: "var(--text-muted)", textAlign: "center" }}>
            Could not load archive data. Make sure the API is running.
          </div>
        )}
      </SectionShell>
    </div>
  );
}
