/**
 * SectionShell — STAX Commander shared primitive.
 * Titled card wrapper used by all dashboard surfaces.
 * Classification: STAX-shared
 */
import React from "react";

export interface SectionShellProps {
  title: string;
  icon?: string;
  badge?: { label: string; color: "green" | "yellow" | "red" | "blue" | "gray" };
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function SectionShell({ title, icon, badge, actions, children, style }: SectionShellProps) {
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
      background: "var(--bg-primary)",
      border: "1px solid var(--border-color)",
      borderRadius: "var(--radius-md)",
      padding: "24px",
      boxShadow: "var(--glass-shadow)",
      ...style,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
          {icon && <span>{icon}</span>}
          {title}
          {badge && bc && (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: bc.bg, color: bc.color, textTransform: "uppercase" }}>
              {badge.label}
            </span>
          )}
        </h3>
        {actions && <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}
