"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, AlertTriangle, Play, HelpCircle } from "lucide-react";

type TaskStatus = "todo" | "doing" | "blocked" | "done";

interface PunchItem {
  id: string;
  text: string;
  status: TaskStatus;
  urgent: boolean;
}

const INITIAL_ITEMS: PunchItem[] = [
  { id: "1", text: "Start PostgreSQL locally", status: "todo", urgent: true },
  { id: "2", text: "Start Redis locally", status: "todo", urgent: true },
  { id: "3", text: "Apply migrations 030 and 031", status: "todo", urgent: true },
  { id: "4", text: "Run smoke test sequence", status: "todo", urgent: false },
  { id: "5", text: "Verify /daily/latest route", status: "todo", urgent: false },
  { id: "6", text: "Confirm Resend email delivery", status: "todo", urgent: false },
  { id: "7", text: "Add GA4 credentials to .env", status: "todo", urgent: false },
  { id: "8", text: "Complete Alby Lightning hookup", status: "todo", urgent: false },
  { id: "9", text: "Activate first social credential", status: "todo", urgent: false },
  { id: "10", text: "Review public homepage after first live issue", status: "todo", urgent: false },
  { id: "11", text: "Verify Wayback archive capture", status: "todo", urgent: false },
  { id: "12", text: "Triage reader-facing issues post-launch", status: "todo", urgent: false }
];

export default function LaunchPunchList() {
  const [items, setItems] = useState<PunchItem[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("ss_launch_punchlist");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        setItems(INITIAL_ITEMS);
      }
    } else {
      setItems(INITIAL_ITEMS);
    }
  }, []);

  // Save to localStorage on change
  const saveItems = (updated: PunchItem[]) => {
    setItems(updated);
    localStorage.setItem("ss_launch_punchlist", JSON.stringify(updated));
  };

  const handleStatusChange = (id: string, nextStatus: TaskStatus) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, status: nextStatus } : item
    );
    saveItems(updated);
  };

  const doneCount = items.filter(i => i.status === "done").length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (items.length === 0) return null;

  return (
    <div 
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        marginBottom: "32px",
        boxShadow: "var(--glass-shadow)",
        transition: "all 0.2s ease"
      }}
    >
      {/* Header & Progress */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isCollapsed ? "0" : "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>🚀</span>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              Launch Control Punch List
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Track critical deployment, verification, and follow-up activities
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)" }}>{progressPercent}% Complete</span>
            <div style={{ width: "100px", height: "6px", background: "var(--bg-primary)", borderRadius: "100px", overflow: "hidden" }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--primary)", transition: "width 0.3s ease" }} />
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>({doneCount}/{totalCount})</span>
          </div>

          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              color: "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            {isCollapsed ? "Expand List" : "Collapse"}
          </button>
        </div>
      </div>

      {/* Task List */}
      {!isCollapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "360px", overflowY: "auto", paddingRight: "4px" }}>
          {items.map((item) => (
            <div 
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-primary)",
                border: item.urgent && item.status !== "done" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--border-color)",
                transition: "all 0.2s"
              }}
            >
              {/* Left text */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {item.status === "done" ? (
                  <CheckCircle2 style={{ width: "18px", height: "18px", color: "var(--success)" }} />
                ) : item.status === "doing" ? (
                  <Play style={{ width: "18px", height: "18px", color: "var(--primary)", fill: "currentColor" }} />
                ) : item.status === "blocked" ? (
                  <AlertTriangle style={{ width: "18px", height: "18px", color: "var(--error)" }} />
                ) : (
                  <Circle style={{ width: "18px", height: "18px", color: "var(--text-muted)" }} />
                )}

                <span 
                  style={{
                    fontSize: "13.5px",
                    fontWeight: item.urgent && item.status !== "done" ? 600 : 500,
                    color: item.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
                    textDecoration: item.status === "done" ? "line-through" : "none"
                  }}
                >
                  {item.text}
                </span>

                {item.urgent && item.status !== "done" && (
                  <span 
                    style={{
                      fontSize: "9px",
                      fontWeight: 800,
                      background: "rgba(239, 68, 68, 0.1)",
                      color: "rgb(239, 68, 68)",
                      padding: "2px 6px",
                      borderRadius: "100px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}
                  >
                    Urgent
                  </span>
                )}
              </div>

              {/* Status selectors */}
              <div style={{ display: "flex", gap: "4px" }}>
                {(["todo", "doing", "blocked", "done"] as TaskStatus[]).map((st) => {
                  const isActive = item.status === st;
                  const bg = isActive
                    ? st === "done" ? "var(--success)"
                      : st === "blocked" ? "var(--error)"
                      : st === "doing" ? "var(--primary)"
                      : "var(--border-color)"
                    : "transparent";
                  const color = isActive ? "#fff" : "var(--text-muted)";

                  return (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(item.id, st)}
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        border: "1px solid var(--border-color)",
                        borderRadius: "4px",
                        background: bg,
                        color: color,
                        cursor: "pointer",
                        transition: "all 0.1s"
                      }}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
