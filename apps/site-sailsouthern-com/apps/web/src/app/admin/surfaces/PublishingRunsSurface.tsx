/**
 * PublishingRunsSurface — Sail Southern domain surface.
 * Run history with expandable detail, platform outcomes, and retry.
 * Classification: Sail Southern-specific (wraps STAX-shared RunRow)
 */
"use client";
import React, { useState, useEffect } from "react";
import { SectionShell } from "../commander/SectionShell";
import { StatusCard } from "../commander/StatusCard";
import { RunRow } from "../commander/RunRow";
import { Loader2, RefreshCw } from "lucide-react";

interface ScheduleData {
  schedule?: { next_run: string; cron_pattern: string; timezone: string } | null;
  runs?: any[];
}

export function PublishingRunsSurface() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin-proxy/v1/social/runs");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Publishing runs load error:", err);
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRetryRun = async (runId: number) => {
    const res = await fetch(`/api/admin-proxy/v1/social/runs/${runId}/retry`, { method: "POST" });
    const d = await res.json();
    await load();
    return res.ok ? { ok: true, message: d.message || `Retry queued as run #${d.new_run_id}.` } : { ok: false, message: d.error?.message || "Retry failed." };
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <Loader2 className="animate-spin" style={{ width: "32px", height: "32px", color: "var(--primary)" }} />
    </div>
  );

  const schedule = data?.schedule;
  const runs = data?.runs || [];
  const lastSuccessful = runs.find((r) => r.run_status === "success");
  const lastFailed = runs.find((r) => r.run_status === "failed");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Schedule overview */}
      {schedule && (
        <SectionShell
          title="Publishing schedule"
          icon="📅"
          actions={
            <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <RefreshCw style={{ width: "13px", height: "13px" }} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <StatusCard
              label="Next run"
              value={new Date(schedule.next_run).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
              subtitle={`${schedule.cron_pattern} · ${schedule.timezone}`}
            />
            {lastSuccessful && (
              <StatusCard
                label="Last successful publish"
                value={new Date(lastSuccessful.started_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                valueColor="var(--success)"
              />
            )}
            {lastFailed && (
              <StatusCard
                label="Last failure"
                value={new Date(lastFailed.started_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                valueColor="var(--error)"
                subtitle="Expand the run below to retry"
              />
            )}
          </div>
        </SectionShell>
      )}

      {/* Run history */}
      <SectionShell
        title="Publishing runs"
        icon="📋"
        badge={runs.length > 0 ? { label: `${runs.length} run${runs.length === 1 ? "" : "s"}`, color: "gray" } : undefined}
        actions={!schedule && (
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw style={{ width: "13px", height: "13px" }} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        )}
      >
        {runs.length > 0 ? (
          <div>
            {runs.map((run) => (
              <RunRow key={run.id} run={run} onRetry={handleRetryRun} />
            ))}
          </div>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <p style={{ fontSize: "15px", marginBottom: "8px" }}>No publishing runs yet.</p>
            <p style={{ fontSize: "13px" }}>
              Publishing runs will appear here once the scheduler fires or you trigger a manual publish from the Scheduler surface.
            </p>
          </div>
        )}
      </SectionShell>
    </div>
  );
}
