/**
 * ActionBar — STAX Commander shared primitive.
 * Primary action button with optional confirmation modal and inline result banner.
 * Classification: STAX-shared
 */
"use client";
import React, { useState } from "react";
import { Loader2 } from "lucide-react";

export interface ActionBarProps {
  label: string;
  icon?: string;
  variant?: "primary" | "secondary" | "danger";
  confirmRequired?: boolean;
  confirmMessage?: string;
  disabled?: boolean;
  disabledReason?: string;
  onAction: () => Promise<{ ok: boolean; message: string }>;
}

export function ActionBar({ label, icon, variant = "primary", confirmRequired, confirmMessage, disabled, disabledReason, onAction }: ActionBarProps) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const bgMap = { primary: "var(--primary)", secondary: "var(--bg-primary)", danger: "var(--error)" };
  const colorMap = { primary: "#fff", secondary: "var(--primary)", danger: "#fff" };

  const execute = async () => {
    setShowConfirm(false);
    setPending(true);
    setResult(null);
    try {
      const r = await onAction();
      setResult(r);
    } catch (err: any) {
      setResult({ ok: false, message: err.message || "Unexpected error" });
    } finally {
      setPending(false);
    }
  };

  const handleClick = () => {
    if (confirmRequired) {
      setShowConfirm(true);
    } else {
      execute();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={handleClick}
          disabled={disabled || pending}
          title={disabled && disabledReason ? disabledReason : undefined}
          style={{
            padding: "9px 18px",
            fontSize: "13px",
            fontWeight: 700,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            background: disabled || pending ? "var(--bg-secondary)" : bgMap[variant],
            color: disabled || pending ? "var(--text-muted)" : colorMap[variant],
            cursor: disabled || pending ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "var(--transition-fast)",
          }}
        >
          {pending ? (
            <><Loader2 style={{ width: "14px", height: "14px" }} className="animate-spin" /> Working…</>
          ) : (
            <>{icon && <span>{icon}</span>}{label}</>
          )}
        </button>

        {result && (
          <span style={{ fontSize: "13px", fontWeight: 600, color: result.ok ? "var(--success)" : "var(--error)" }}>
            {result.ok ? "✅" : "❌"} {result.message}
          </span>
        )}

        {disabled && disabledReason && !result && (
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>{disabledReason}</span>
        )}
      </div>

      {showConfirm && (
        <div style={{ padding: "14px 16px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{confirmMessage || `Are you sure you want to ${label.toLowerCase()}?`}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={execute} style={{ padding: "6px 16px", fontSize: "12px", fontWeight: 700, borderRadius: "var(--radius-sm)", border: "none", background: "var(--error)", color: "#fff", cursor: "pointer" }}>
              Confirm
            </button>
            <button onClick={() => setShowConfirm(false)} style={{ padding: "6px 16px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
