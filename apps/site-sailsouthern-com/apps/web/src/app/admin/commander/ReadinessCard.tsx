/**
 * ReadinessCard — STAX Commander shared primitive.
 * Shows integration readiness with traffic-light badge and remediation copy.
 * Classification: STAX-shared
 */
import React from "react";

export type ReadinessStatus = "ready" | "partial" | "blocked";

export interface ReadinessCardProps {
  name: string;
  status: ReadinessStatus;
  detail: string;           // What is configured / what is missing
  whyItMatters: string;     // One-line operator context
  remediation?: string;     // Exact next action when not ready
}

const STATUS_CONFIG: Record<ReadinessStatus, { icon: string; label: string; bg: string; color: string; borderColor: string }> = {
  ready:   { icon: "✅", label: "Ready",               bg: "rgba(46,204,113,0.06)",  color: "var(--success)", borderColor: "rgba(46,204,113,0.25)" },
  partial: { icon: "⚠️", label: "Partially configured", bg: "rgba(241,196,15,0.06)",  color: "var(--accent)",  borderColor: "rgba(241,196,15,0.25)" },
  blocked: { icon: "🔴", label: "Configuration needed",  bg: "rgba(231,76,60,0.06)",   color: "var(--error)",   borderColor: "rgba(231,76,60,0.25)" },
};

export function ReadinessCard({ name, status, detail, whyItMatters, remediation }: ReadinessCardProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div style={{
      padding: "16px 20px",
      borderRadius: "var(--radius-sm)",
      background: cfg.bg,
      border: `1px solid ${cfg.borderColor}`,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{name}</span>
        <span style={{ fontSize: "11px", fontWeight: 700, color: cfg.color, whiteSpace: "nowrap" }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{detail}</span>
      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>{whyItMatters}</span>
      {status !== "ready" && remediation && (
        <div style={{ marginTop: "4px", padding: "8px 10px", background: "var(--bg-primary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Next step: </span>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{remediation}</span>
        </div>
      )}
    </div>
  );
}
