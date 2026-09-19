/**
 * SchedulerSurface — Sail Southern domain surface.
 * Shows BullMQ scheduler state, all queue health cards, recent run history, and force-publish action.
 * Classification: Sail Southern-specific (wraps STAX-shared RunRow + ActionBar)
 */
"use client";
import React, { useState, useEffect } from "react";
import { SectionShell } from "../commander/SectionShell";
import { StatusCard } from "../commander/StatusCard";
import { RunRow } from "../commander/RunRow";
import { ActionBar } from "../commander/ActionBar";
import { Loader2, RefreshCw } from "lucide-react";

type QueueHealth = "healthy" | "degraded" | "stalled";

interface QueueMetrics {
  name: string;
  label: string;
  waiting: number;
  active: number;
  completed_recent: number;
  failed_recent: number;
  oldest_waiting_ms: number | null;
  health: QueueHealth;
}

interface SchedulerData {
  scheduler: {
    cron_pattern: string | null;
    timezone: string;
    next_run: string | null;
    crawl_expansion_enabled: boolean;
    repeatable_jobs?: Array<{ name: string; pattern: string; tz: string; next: string | null }>;
  };
  queues: QueueMetrics[];
  recent_runs: any[];
}

// Health badge styling
const HEALTH_STYLES: Record<QueueHealth, { label: string; bg: string; color: string }> = {
  healthy:  { label: "Healthy",  bg: "rgba(46,204,113,0.15)",  color: "var(--success)" },
  degraded: { label: "Degraded", bg: "rgba(231,76,60,0.15)",   color: "var(--error)"   },
  stalled:  { label: "Stalled",  bg: "rgba(241,196,15,0.15)",  color: "var(--accent)"  },
};

function formatAge(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function QueueCard({ q }: { q: QueueMetrics }) {
  const h = HEALTH_STYLES[q.health];
  return (
    <div style={{ padding: "16px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{q.label}</span>
        <span style={{ padding: "2px 8px", fontSize: "11px", fontWeight: 700, borderRadius: "100px", background: h.bg, color: h.color }}>{h.label}</span>
      </div>
      {/* Queue name */}
      <code style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-primary)", padding: "2px 6px", borderRadius: "4px", display: "inline-block", width: "fit-content" }}>{q.name}</code>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Waiting</div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: q.waiting > 0 ? "var(--accent)" : "var(--text-primary)" }}>{q.waiting}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Active</div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: q.active > 0 ? "var(--primary)" : "var(--text-primary)" }}>{q.active}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Failed</div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: q.failed_recent > 0 ? "var(--error)" : "var(--text-primary)" }}>{q.failed_recent}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Oldest waiting</div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: q.health === "stalled" ? "var(--accent)" : "var(--text-secondary)", marginTop: "4px" }}>{formatAge(q.oldest_waiting_ms)}</div>
        </div>
      </div>
      {/* Stalled warning */}
      {q.health !== "healthy" && (
        <div style={{ padding: "8px 10px", background: q.health === "stalled" ? "rgba(241,196,15,0.08)" : "rgba(231,76,60,0.06)", borderRadius: "var(--radius-sm)", border: `1px solid ${q.health === "stalled" ? "rgba(241,196,15,0.2)" : "rgba(231,76,60,0.15)"}` }}>
          <span style={{ fontSize: "12px", color: q.health === "stalled" ? "var(--accent)" : "var(--error)" }}>
            {q.health === "stalled"
              ? `⚠️ Oldest job has been waiting ${formatAge(q.oldest_waiting_ms)} — check that the worker is running.`
              : `❌ ${q.failed_recent} recent failure${q.failed_recent === 1 ? "" : "s"} — check worker logs for errors.`}
          </span>
        </div>
      )}
    </div>
  );
}

export function SchedulerSurface() {
  const [data, setData] = useState<SchedulerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin-proxy/v1/system/scheduler");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Scheduler load error:", err);
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleForcePublish = async () => {
    const res = await fetch("/api/admin-proxy/v1/social/publish-now", { method: "POST", headers: { "Content-Type": "application/json" } });
    const d = await res.json();
    if (res.ok) {
      await load();
      return { ok: true, message: d.message || "Publishing run queued." };
    }
    return { ok: false, message: d.error?.message || "Failed to queue publishing run." };
  };

  const handleRetryRun = async (runId: number) => {
    const res = await fetch(`/api/admin-proxy/v1/social/runs/${runId}/retry`, { method: "POST" });
    const d = await res.json();
    if (res.ok) {
      await load();
      return { ok: true, message: d.message || `Retry queued as run #${d.new_run_id}.` };
    }
    return { ok: false, message: d.error?.message || "Retry failed." };
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <Loader2 className="animate-spin" style={{ width: "32px", height: "32px", color: "var(--primary)" }} />
    </div>
  );

  const s = data?.scheduler;
  const schedulerReady = !!(s?.cron_pattern);
  const nextRun = s?.next_run
    ? new Date(s.next_run).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Not scheduled";

  const unhealthyQueues = data?.queues?.filter((q) => q.health !== "healthy") ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Scheduler state */}
      <SectionShell
        title="Scheduler"
        icon="⏰"
        badge={schedulerReady ? { label: "Active", color: "green" } : { label: "Not configured", color: "yellow" }}
        actions={
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw style={{ width: "13px", height: "13px" }} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          {/* Multi-window schedule grid if configured */}
          {s?.repeatable_jobs && s.repeatable_jobs.length > 1 ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px" }}>
                Publish windows · {s.timezone}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
                {s.repeatable_jobs.map((job) => (
                  <div key={job.name} style={{ padding: "10px 14px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", background: "var(--bg-primary)", fontSize: "12px" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px", fontFamily: "monospace" }}>{job.pattern} ({job.tz})</div>
                    <div style={{ color: "var(--text-muted)" }}>
                      {job.next ? `Next: ${new Date(job.next).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}` : "Not scheduled"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <StatusCard
              label="Next scheduled run"
              value={nextRun}
              subtitle={s?.cron_pattern ? `${s.cron_pattern} · ${s.timezone}` : s?.repeatable_jobs?.[0] ? `${s.repeatable_jobs[0].pattern} · ${s.repeatable_jobs[0].tz}` : "Set PUBLISH_CRON_PATTERN to activate"}
              valueColor={schedulerReady ? "var(--text-primary)" : "var(--accent)"}
            />
          )}
          <StatusCard
            label="Auto-scan"
            value={s?.crawl_expansion_enabled ? "Enabled" : "Paused"}
            valueColor={s?.crawl_expansion_enabled ? "var(--success)" : "var(--accent)"}
            subtitle={s?.crawl_expansion_enabled ? "Scanning for uncaptured posts every 5 min" : "Set CRAWL_EXPANSION_ENABLED=true to resume"}
          />
          {unhealthyQueues.length > 0 && (
            <StatusCard
              label="Queues needing attention"
              value={`${unhealthyQueues.length} queue${unhealthyQueues.length === 1 ? "" : "s"}`}
              valueColor="var(--error)"
              subtitle={unhealthyQueues.map((q) => q.label).join(", ")}
            />
          )}
        </div>

        {!schedulerReady && (
          <div style={{ padding: "12px 14px", background: "rgba(241,196,15,0.08)", border: "1px solid rgba(241,196,15,0.25)", borderRadius: "var(--radius-sm)", marginBottom: "16px" }}>
            <span style={{ fontSize: "13px", color: "var(--accent)" }}>
              ⚠️ Scheduler not configured. Set <code>PUBLISH_CRON_PATTERN</code> and <code>PUBLISH_TIMEZONE</code> in .env, then restart the federation worker.
            </span>
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "10px" }}>Manual control</span>
          <ActionBar
            label="Publish now"
            icon="▶"
            variant="primary"
            confirmRequired
            confirmMessage="This will immediately queue a micro-edition publishing run. The worker must be running to execute it. Continue?"
            onAction={handleForcePublish}
          />
        </div>
      </SectionShell>

      {/* Queue health grid */}
      {data?.queues && data.queues.length > 0 && (
        <SectionShell
          title="Queue health"
          icon="📡"
          badge={
            unhealthyQueues.length === 0
              ? { label: "All healthy", color: "green" }
              : { label: `${unhealthyQueues.length} issue${unhealthyQueues.length === 1 ? "" : "s"}`, color: "red" }
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {data.queues.map((q) => (
              <QueueCard key={q.name} q={q} />
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "12px", marginBottom: 0 }}>
            Health rules: <strong>Stalled</strong> = oldest waiting job &gt; 1 hour. <strong>Degraded</strong> = &gt;10 recent failures. Counts show current queue state, not a time-windowed view.
          </p>
        </SectionShell>
      )}

      {/* Recent runs */}
      <SectionShell title="Recent publishing runs" icon="📋">
        {data?.recent_runs && data.recent_runs.length > 0 ? (
          <div>
            {data.recent_runs.map((run) => (
              <RunRow key={run.id} run={run} onRetry={handleRetryRun} />
            ))}
          </div>
        ) : (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
            <p style={{ fontSize: "15px", marginBottom: "8px" }}>No publishing runs recorded yet.</p>
            <p style={{ fontSize: "13px" }}>Runs will appear here once the scheduler triggers its first publish or you use "Publish now" above.</p>
          </div>
        )}
      </SectionShell>
    </div>
  );
}
