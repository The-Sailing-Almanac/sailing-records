/**
 * StatusCard — STAX Commander shared primitive.
 * Generic stat card for numeric or textual status values.
 * Classification: STAX-shared
 */
import React from "react";

export interface StatusCardProps {
  label: string;
  value: React.ReactNode;
  badge?: { label: string; color: "green" | "yellow" | "red" | "blue" | "gray" };
  subtitle?: string;
  valueColor?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}

export function StatusCard({ label, value, badge, subtitle, valueColor, action }: StatusCardProps) {
  const badgeColors = {
    green:  { bg: "rgba(46,204,113,0.15)", color: "var(--success)" },
    yellow: { bg: "rgba(241,196,15,0.15)", color: "var(--accent)" },
    red:    { bg: "rgba(231,76,60,0.15)",  color: "var(--error)" },
    blue:   { bg: "rgba(52,152,219,0.15)", color: "var(--primary)" },
    gray:   { bg: "rgba(127,140,141,0.15)", color: "var(--text-muted)" },
  };

  const bc = badge ? badgeColors[badge.color] : null;

  return (
    <div style={{
      padding: "16px",
      background: "var(--bg-secondary)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border-color)",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    }}>
      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "28px", lineHeight: 1.1, color: valueColor || "var(--text-primary)" }}>
          {value}
        </strong>
        {badge && bc && (
          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "100px", background: bc.bg, color: bc.color, textTransform: "uppercase" }}>
            {badge.label}
          </span>
        )}
      </div>
      {subtitle && (
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{subtitle}</span>
      )}
      {action && (
        <button
          onClick={action.onClick}
          disabled={action.disabled}
          style={{ marginTop: "8px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--primary)", cursor: action.disabled ? "not-allowed" : "pointer", opacity: action.disabled ? 0.5 : 1 }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
