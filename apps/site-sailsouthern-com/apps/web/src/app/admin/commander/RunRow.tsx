/**
 * RunRow — STAX Commander shared primitive.
 * Expandable publishing run row with outcome badge, platform summary, and retry action.
 * Classification: STAX-shared
 */
"use client";
import React, { useState } from "react";
import { ActionBar } from "./ActionBar";

export interface RunRowProps {
  run: {
    id: number;
    job_name: string;
    run_status: string;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    trigger_source?: string;
    summary_counts?: Record<string, number>;
    error_message?: string;
    platforms_attempted?: string[];
    platforms_succeeded?: string[];
  };
  onRetry?: (runId: number) => Promise<{ ok: boolean; message: string }>;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  success: { bg: "rgba(46,204,113,0.15)",  color: "var(--success)", label: "Published" },
  running: { bg: "rgba(52,152,219,0.15)",  color: "var(--primary)", label: "Publishing…" },
  failed:  { bg: "rgba(231,76,60,0.15)",   color: "var(--error)",   label: "Failed to publish" },
  pending: { bg: "rgba(241,196,15,0.15)",  color: "var(--accent)",  label: "Queued" },
};

function jobNameLabel(raw: string) {
  if (raw === "micro_edition_publish" || raw === "micro-edition-publish") return "Micro-edition";
  if (raw === "daily_newsletter") return "Daily newsletter";
  return raw.replace(/_/g, " ");
}

const TRIGGER_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  scheduler: { label: "Scheduled", bg: "rgba(120,130,150,0.15)", color: "var(--text-muted)" },
  manual:    { label: "Manual",    bg: "rgba(241,196,15,0.15)",  color: "var(--accent)"    },
  api:       { label: "API",       bg: "rgba(231,76,60,0.15)",   color: "var(--error)"     },
};

function TriggerBadge({ source }: { source?: string }) {
  const key = source && TRIGGER_STYLES[source] ? source : "scheduler";
  const { label, bg, color } = TRIGGER_STYLES[key];
  return (
    <span style={{ padding: "2px 8px", fontSize: "11px", fontWeight: 700, borderRadius: "100px", background: bg, color, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

export function RunRow({ run, onRetry }: RunRowProps) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[run.run_status] || { bg: "var(--bg-secondary)", color: "var(--text-muted)", label: run.run_status };

  const duration = run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : null;
  const started = new Date(run.started_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

  return (
    <div style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 4px", cursor: "pointer", flexWrap: "wrap" }}
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Status badge */}
        <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, background: style.bg, color: style.color, textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {style.label}
        </span>
        {/* Job name */}
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", minWidth: "120px" }}>
          {jobNameLabel(run.job_name)}
        </span>
        {/* Trigger badge */}
        <TriggerBadge source={run.trigger_source} />
        {/* Time */}
        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "auto" }}>{started}</span>
        {/* Duration */}
        {duration && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{duration}</span>}
        {/* Expand indicator */}
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ padding: "12px 16px 16px 16px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", margin: "0 4px 12px 4px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Platform summary */}
          {(run.platforms_attempted || run.summary_counts) && (
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Platforms</span>
              {run.platforms_attempted && run.platforms_attempted.length > 0 ? (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {run.platforms_attempted.map((p) => {
                    const ok = run.platforms_succeeded?.includes(p);
                    return (
                      <span key={p} style={{ padding: "2px 8px", fontSize: "12px", fontWeight: 600, borderRadius: "100px", background: ok ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)", color: ok ? "var(--success)" : "var(--error)", textTransform: "capitalize" }}>
                        {ok ? "✓" : "✗"} {p}
                      </span>
                    );
                  })}
                </div>
              ) : run.summary_counts ? (
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{JSON.stringify(run.summary_counts)}</span>
              ) : null}
            </div>
          )}

          {/* Error */}
          {run.error_message && (
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--error)", display: "block", marginBottom: "4px" }}>Post did not publish — reason</span>
              <code style={{ fontSize: "12px", color: "var(--error)", background: "rgba(231,76,60,0.08)", padding: "6px 10px", borderRadius: "var(--radius-sm)", display: "block", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {run.error_message}
              </code>
            </div>
          )}

          {/* Retry */}
          {run.run_status === "failed" && onRetry && (
            <ActionBar
              label="Retry this run"
              icon="↩"
              variant="secondary"
              confirmRequired
              confirmMessage="This will create a new publishing run immediately. Continue?"
              onAction={() => onRetry(run.id)}
            />
          )}
        </div>
      )}
    </div>
  );
}
