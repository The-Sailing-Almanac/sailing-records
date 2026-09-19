/**
 * ProcessingLanesSurface — Sail Southern domain surface.
 * Dashboard controls for ingestion lanes, queues, and spend caps.
 */
"use client";
import React, { useState, useEffect } from "react";
import { SectionShell } from "../commander/SectionShell";
import { StatusCard } from "../commander/StatusCard";
import { Loader2, RefreshCw, Save, ShieldAlert, Cpu, Activity, History, Zap } from "lucide-react";

interface StatsData {
  processed_today: number;
  backlog: number;
  failed: number;
  lanes: {
    historical_total: number;
    current_total: number;
    historical_processed: number;
    current_processed: number;
    historical_spend_proxy_usd: number;
    current_spend_proxy_usd: number;
  };
  total_usage_spend_usd: number;
}

interface ControlsData {
  max_items_per_run: number;
  daily_cap: number;
  pause_historical: boolean;
  low_spend_mode: boolean;
}

export function ProcessingLanesSurface() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [controls, setControls] = useState<ControlsData>({
    max_items_per_run: 2000,
    daily_cap: 10000,
    pause_historical: false,
    low_spend_mode: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = async () => {
    try {
      const [statsRes, controlsRes] = await Promise.all([
        fetch("/api/admin-proxy/v1/admin/processing/stats"),
        fetch("/api/admin-proxy/v1/admin/processing/controls"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (controlsRes.ok) {
        const ctrl = await controlsRes.json();
        setControls({
          max_items_per_run: ctrl.max_items_per_run ?? 2000,
          daily_cap: ctrl.daily_cap ?? 10000,
          pause_historical: !!ctrl.pause_historical,
          low_spend_mode: !!ctrl.low_spend_mode,
        });
      }
    } catch (err) {
      console.error("Failed to load processing lanes data:", err);
    }
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSaveControls = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/admin-proxy/v1/admin/processing/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(controls),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await loadData();
      }
    } catch (err) {
      console.error("Failed to save controls:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
        <Loader2 className="animate-spin" style={{ width: "32px", height: "32px", color: "var(--primary)" }} />
      </div>
    );
  }

  const backlogBadge = stats && stats.backlog > 1000
    ? { label: "High Backlog", color: "red" as const }
    : { label: "Queue Healthy", color: "green" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Metrics Row */}
      <SectionShell
        title="Processing Lane Telemetry"
        icon="⚙️"
        badge={backlogBadge}
        actions={
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw style={{ width: "13px", height: "13px" }} className={refreshing ? "animate-spin" : ""} />
            Refresh Stats
          </button>
        }
      >
        {stats && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Status Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <StatusCard label="Processed Today" value={stats.processed_today} valueColor="var(--primary)" subtitle="Gemini enrichment calls" />
              <StatusCard label="Unscored Backlog" value={stats.backlog} valueColor={stats.backlog > 1000 ? "var(--error)" : "var(--success)"} subtitle="Articles awaiting relevance check" />
              <StatusCard label="Suppressed/Filtered" value={stats.failed} valueColor="var(--text-muted)" subtitle="Items marked as suppressed" />
              <StatusCard label="Est. Lifetime Spend" value={`$${stats.total_usage_spend_usd.toFixed(2)}`} valueColor="var(--success)" subtitle="Reported Gemini usage costs" />
            </div>

            {/* Ingestion Lanes Comparison */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginTop: "12px" }}>
              
              {/* Historical Lane */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <History style={{ color: "var(--text-muted)", width: "20px", height: "20px" }} />
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Historical Lane</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Total Imported:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{stats.lanes.historical_total.toLocaleString()} articles</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Enriched/Scored:</span>
                    <strong style={{ color: "var(--text-secondary)" }}>{stats.lanes.historical_processed.toLocaleString()} ({((stats.lanes.historical_processed / (stats.lanes.historical_total || 1)) * 100).toFixed(1)}%)</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: "8px", marginTop: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Est. Cost Contribution:</span>
                    <span style={{ color: "var(--success)", fontWeight: 600 }}>${stats.lanes.historical_spend_proxy_usd.toFixed(2)} USD</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 0 0", fontStyle: "italic" }}>
                    Lane tracks historical web link captures imported from Evernote archives & bulk Inoreader runs.
                  </p>
                </div>
              </div>

              {/* Current Lane */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <Activity style={{ color: "var(--primary)", width: "20px", height: "20px" }} />
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Current/Live Lane</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Total Feeds intake:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{stats.lanes.current_total.toLocaleString()} articles</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Enriched/Scored:</span>
                    <strong style={{ color: "var(--text-secondary)" }}>{stats.lanes.current_processed.toLocaleString()} ({((stats.lanes.current_processed / (stats.lanes.current_total || 1)) * 100).toFixed(1)}%)</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: "8px", marginTop: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Est. Cost Contribution:</span>
                    <span style={{ color: "var(--success)", fontWeight: 600 }}>${stats.lanes.current_spend_proxy_usd.toFixed(2)} USD</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 0 0", fontStyle: "italic" }}>
                    Lane tracks active incoming feeds (RSS, Podcasts) pulled automatically by the poller daemon.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}
      </SectionShell>

      {/* Control Panel Section */}
      <SectionShell title="Cost Control & Throttling Panel" icon="🛡️">
        <form onSubmit={handleSaveControls} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
            
            {/* Max Items per Run */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label htmlFor="max_items_per_run" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)" }}>
                Max items processed per sweep
              </label>
              <input
                id="max_items_per_run"
                type="number"
                value={controls.max_items_per_run}
                onChange={(e) => setControls({ ...controls, max_items_per_run: parseInt(e.target.value, 10) || 0 })}
                style={{ padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "14px" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Maximum number of unscored articles processed by a single cron run.
              </span>
            </div>

            {/* Daily Cap */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label htmlFor="daily_cap" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)" }}>
                Daily Gemini Call Cap
              </label>
              <input
                id="daily_cap"
                type="number"
                value={controls.daily_cap}
                onChange={(e) => setControls({ ...controls, daily_cap: parseInt(e.target.value, 10) || 0 })}
                style={{ padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "14px" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Hard limit for API requests allowed per day across all backend enrichments.
              </span>
            </div>

          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "20px", borderRadius: "var(--radius-md)" }}>
            
            {/* Pause Historical */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={controls.pause_historical}
                onChange={(e) => setControls({ ...controls, pause_historical: e.target.checked })}
                style={{ marginTop: "3px", width: "16px", height: "16px" }}
              />
              <div>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <History style={{ width: "16px", height: "16px", color: "var(--text-muted)" }} />
                  Pause Historical Enrichment Lane
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                  Disable Gemini relevance evaluation for historical imports. Active RSS feeds will continue to enrich normally.
                </span>
              </div>
            </label>

            {/* Low Spend Mode */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", marginTop: "8px" }}>
              <input
                type="checkbox"
                checked={controls.low_spend_mode}
                onChange={(e) => setControls({ ...controls, low_spend_mode: e.target.checked })}
                style={{ marginTop: "3px", width: "16px", height: "16px" }}
              />
              <div>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Zap style={{ width: "16px", height: "16px", color: "var(--accent)" }} />
                  Low-Spend Mode (Throttled Model)
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                  Force Gemini Relevance worker to employ the cheaper <code>gemini-2.5-flash-lite</code> model and throttle batch sweeps to a maximum of 200 items.
                </span>
              </div>
            </label>

          </div>

          {/* Form Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: "var(--primary)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "14px",
                padding: "10px 20px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 className="animate-spin" style={{ width: "16px", height: "16px" }} /> : <Save style={{ width: "16px", height: "16px" }} />}
              Save Configuration
            </button>

            {saveSuccess && (
              <span style={{ color: "var(--success)", fontSize: "13px", fontWeight: 600 }}>
                ✓ Configuration saved successfully!
              </span>
            )}
          </div>

        </form>
      </SectionShell>

    </div>
  );
}
