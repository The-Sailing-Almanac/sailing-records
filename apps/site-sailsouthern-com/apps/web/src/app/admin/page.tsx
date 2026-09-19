/**
 * Sail Southern Command Bridge
 * STAX Commander-aligned admin dashboard shell.
 *
 * This file is a routing shell only — all surface content lives in ./surfaces/.
 * Shared primitives live in ./commander/ (STAX-shared layer).
 * Domain surfaces in ./surfaces/ (Sail Southern layer).
 */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Users, FileText, Check, X, ShieldAlert,
  Loader2, RefreshCw, Layers, Radio, CheckCircle, Gift, Info
} from "lucide-react";
import Symbol from "../components/Symbol";

// STAX Commander surfaces
import { ReadinessSurface } from "./surfaces/ReadinessSurface";
import { SchedulerSurface } from "./surfaces/SchedulerSurface";
import { PublishingRunsSurface } from "./surfaces/PublishingRunsSurface";
import { SocialDeliverySurface } from "./surfaces/SocialDeliverySurface";
import { ArchiveBackfillSurface } from "./surfaces/ArchiveBackfillSurface";
import { AnalyticsSurface } from "./surfaces/AnalyticsSurface";
import { ProcessingLanesSurface } from "./surfaces/ProcessingLanesSurface";
import LaunchPunchList from "./commander/LaunchPunchList";

// Tab definitions
type TabId = "overview" | "readiness" | "scheduler" | "publishing" | "delivery" | "archive" | "analytics" | "content" | "submissions" | "supporters" | "lanes";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "overview",    label: "Overview",         icon: "📡" },
  { id: "readiness",   label: "Readiness",         icon: "🚦" },
  { id: "lanes",       label: "Processing lanes",  icon: "⚙️" },
  { id: "scheduler",   label: "Scheduler",         icon: "⏰" },
  { id: "publishing",  label: "Publishing runs",   icon: "📋" },
  { id: "delivery",    label: "Social posts",      icon: "📣" },
  { id: "archive",     label: "Archive",           icon: "🏛️" },
  { id: "analytics",   label: "Analytics",         icon: "📊" },
  { id: "content",     label: "Content",           icon: "📰" },
  { id: "submissions", label: "Submissions",       icon: "📥" },
  { id: "supporters",  label: "Supporters",        icon: "⚡" },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("readiness");

  // Local data for non-surface tabs (overview, content, submissions, supporters)
  const [stats, setStats] = useState<any>(null);
  const [heartbeat, setHeartbeat] = useState<any>(null);
  const [edition, setEdition] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [supporters, setSupporters] = useState<any[]>([]);

  // Loading & action states for non-surface tabs
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverviewData = useCallback(async () => {
    try {
      const [statsRes, hbRes] = await Promise.all([
        fetch("/api/admin-proxy/admin/stats"),
        fetch("/api/admin-proxy/admin/heartbeat")
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (hbRes.ok) setHeartbeat(await hbRes.json());
    } catch (err) {
      console.error("Failed to load overview data:", err);
    }
  }, []);

  const fetchContentData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin-proxy/editions/current");
      if (res.ok) {
        const data = await res.json();
        if (data.edition) {
          const slotsRes = await fetch(`/api/admin-proxy/editions/${data.edition.edition_date}/front-page`);
          if (slotsRes.ok) {
            const slotsData = await slotsRes.json();
            setEdition({ edition: data.edition, slots: slotsData.articles || [] });
          }
        }
      }
    } catch (err) {
      console.error("Failed to load content data:", err);
    }
  }, []);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin-proxy/submissions");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
    }
  }, []);

  const fetchSupporters = useCallback(async () => {
    try {
      const res = await fetch("/api/admin-proxy/supporters");
      if (res.ok) {
        const data = await res.json();
        setSupporters(data.supporters || []);
      }
    } catch (err) {
      console.error("Failed to load supporters:", err);
    }
  }, []);

  const loadData = useCallback(async (tabName: TabId) => {
    setLoading(true);
    if (tabName === "overview") await fetchOverviewData();
    else if (tabName === "content") await fetchContentData();
    else if (tabName === "submissions") await fetchSubmissions();
    else if (tabName === "supporters") await fetchSupporters();
    // Surface tabs manage their own loading
    setLoading(false);
  }, [fetchOverviewData, fetchContentData, fetchSubmissions, fetchSupporters]);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(activeTab);
    setRefreshing(false);
  };

  const handleReviewSubmission = async (id: number, status: "approved" | "rejected") => {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin-proxy/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewer_notes: `Reviewed via Command Bridge` }),
      });
      if (res.ok) await fetchSubmissions();
    } catch (err) {
      console.error("Review action failed:", err);
    } finally {
      setActioningId(null);
    }
  };

  const handleToggleGift = async (id: number, currentGiftStatus: boolean) => {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin-proxy/supporters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ physical_gift_sent: !currentGiftStatus }),
      });
      if (res.ok) await fetchSupporters();
    } catch (err) {
      console.error("Gift toggle failed:", err);
    } finally {
      setActioningId(null);
    }
  };

  // Surface tabs self-manage loading — only show central spinner for local-data tabs
  const surfaceTabs: TabId[] = ["readiness", "scheduler", "publishing", "delivery", "archive", "analytics", "lanes"];
  const showCentralLoader = loading && !surfaceTabs.includes(activeTab);

  return (
    <div className="container" style={{ padding: "40px 0 80px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "24px", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "36px", fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--text-primary)" }}>
            Command Bridge
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            Sail Southern editorial control · STAX Commander module
          </p>
        </div>
        {!surfaceTabs.includes(activeTab) && (
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px" }}
          >
            <RefreshCw style={{ width: "16px", height: "16px" }} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Launch Punch List */}
      <LaunchPunchList />

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "32px", overflowX: "auto", paddingBottom: "8px", flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-color)",
              background: activeTab === tab.id ? "var(--primary-glow)" : "var(--bg-secondary)",
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-fade-in">

        {/* ─── STAX Commander surfaces — self-loading ─── */}
        {activeTab === "readiness"  && <ReadinessSurface />}
        {activeTab === "scheduler"  && <SchedulerSurface />}
        {activeTab === "publishing" && <PublishingRunsSurface />}
        {activeTab === "delivery"   && <SocialDeliverySurface />}
        {activeTab === "archive"    && <ArchiveBackfillSurface />}
        {activeTab === "analytics"  && <AnalyticsSurface />}
        {activeTab === "lanes"      && <ProcessingLanesSurface />}

        {/* ─── Local-data tabs with central loader ─── */}
        {showCentralLoader && (
          <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}>
            <Loader2 className="animate-spin" style={{ width: "40px", height: "40px", color: "var(--primary)", animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {!showCentralLoader && (
          <>
            {/* OVERVIEW */}
            {activeTab === "overview" && heartbeat && (
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px" }}>
                  <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "24px", boxShadow: "var(--glass-shadow)" }}>
                    <Radio style={{ color: "var(--primary)", width: "24px", height: "24px", marginBottom: "12px" }} />
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Active Crawl Feeds</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>{heartbeat.metrics.active_feeds}</div>
                  </div>
                  <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "24px", boxShadow: "var(--glass-shadow)" }}>
                    <FileText style={{ color: "var(--primary)", width: "24px", height: "24px", marginBottom: "12px" }} />
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Articles</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>{heartbeat.metrics.article_links_total.toLocaleString()}</div>
                  </div>
                  <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "24px", boxShadow: "var(--glass-shadow)" }}>
                    <ShieldAlert style={{ color: "var(--accent)", width: "24px", height: "24px", marginBottom: "12px" }} />
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Suppressed</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>{heartbeat.metrics.suppressed_articles}</div>
                  </div>
                  <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "24px", boxShadow: "var(--glass-shadow)" }}>
                    <Layers style={{ color: "var(--primary)", width: "24px", height: "24px", marginBottom: "12px" }} />
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Search Index Size</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>{heartbeat.metrics.meilisearch_index_size.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", padding: "32px", boxShadow: "var(--glass-shadow)" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Gemini Archival Enrichment Progress</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                    <span>Remaining Rows: {heartbeat.metrics.gemini_backfill_remaining_rows.toLocaleString()}</span>
                    <span>Projected Completion: {heartbeat.metrics.projected_backfill_completion_days} days</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "var(--bg-primary)", borderRadius: "100px", overflow: "hidden", marginBottom: "16px" }}>
                    <div style={{ width: `${Math.max(10, Math.min(100, 100 - (heartbeat.metrics.gemini_backfill_remaining_rows / heartbeat.metrics.article_links_total) * 100))}%`, height: "100%", background: "var(--primary)" }} />
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    Crawler operates at a daily cap of 5,000 flash-lite calls. Backfill pipeline runs automatically at 07:00 UTC.
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT */}
            {activeTab === "content" && (
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", padding: "32px", boxShadow: "var(--glass-shadow)" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>Today's Front Page Assignments</h2>
                {edition && edition.slots.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {edition.slots.map((slot: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", background: "var(--bg-primary)" }}>
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)", display: "block" }}>
                            {slot.section_display_name || slot.section} (Slot {slot.slot_position})
                          </span>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "15px", marginTop: "4px", display: "block" }}>{slot.title}</span>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                            {slot.publisher_name} · {slot.injection_type}
                          </span>
                        </div>
                        <button disabled className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>Bump</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No front-page assignments compiled for today yet.</div>
                )}
              </div>
            )}

            {/* SUBMISSIONS */}
            {activeTab === "submissions" && (
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", padding: "32px", boxShadow: "var(--glass-shadow)" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>
                  User Submissions ({submissions.filter((s) => s.status === "pending").length} pending)
                </h2>
                {submissions.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {submissions.map((sub) => (
                      <div key={sub.id} style={{ padding: "24px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", background: "var(--bg-primary)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                          <div>
                            <span style={{ padding: "4px 8px", fontSize: "11px", fontWeight: 700, borderRadius: "100px", background: "var(--primary-glow)", color: "var(--primary)", textTransform: "uppercase" }}>
                              {sub.submission_type}
                            </span>
                            <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                              {new Date(sub.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            {sub.status === "pending" ? (
                              <>
                                <button onClick={() => handleReviewSubmission(sub.id, "approved")} disabled={actioningId === sub.id} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", fontSize: "12px", background: "var(--success)", border: "none" }}>
                                  <Check style={{ width: "12px", height: "12px" }} /> Approve
                                </button>
                                <button onClick={() => handleReviewSubmission(sub.id, "rejected")} disabled={actioningId === sub.id} className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", fontSize: "12px", color: "var(--error)" }}>
                                  <X style={{ width: "12px", height: "12px" }} /> Reject
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize: "13px", fontWeight: 700, color: sub.status === "approved" ? "var(--success)" : "var(--error)", textTransform: "uppercase" }}>{sub.status}</span>
                            )}
                          </div>
                        </div>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>{sub.entity_name_or_url}</h3>
                        {sub.description && <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>{sub.description}</p>}
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Contact: {sub.contact_email || "Anonymous"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No user submissions logged.</div>
                )}
              </div>
            )}

            {/* SUPPORTERS */}
            {activeTab === "supporters" && (
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", padding: "32px", boxShadow: "var(--glass-shadow)" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>
                  Patron &amp; Supporter Directory ({supporters.length})
                </h2>
                {supporters.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                          <th style={{ padding: "12px 8px" }}>Email</th>
                          <th style={{ padding: "12px 8px" }}>Display Name</th>
                          <th style={{ padding: "12px 8px" }}>Tier</th>
                          <th style={{ padding: "12px 8px" }}>Physical Gift</th>
                          <th style={{ padding: "12px 8px" }}>Active</th>
                          <th style={{ padding: "12px 8px" }}>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supporters.map((s) => (
                          <tr key={s.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <td style={{ padding: "12px 8px", color: "var(--text-primary)" }}>{s.email}</td>
                            <td style={{ padding: "12px 8px", fontWeight: 600 }}>{s.display_name || "Anonymous"}</td>
                            <td style={{ padding: "12px 8px" }}>
                              <span style={{ padding: "2px 8px", fontSize: "11px", fontWeight: 700, borderRadius: "100px", background: "var(--primary-glow)", color: "var(--primary)" }}>
                                {s.tier_name || "Supporter"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 8px" }}>
                              <button
                                onClick={() => handleToggleGift(s.id, s.physical_gift_sent)}
                                disabled={actioningId === s.id}
                                style={{ border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: s.physical_gift_sent ? "var(--success)" : "var(--text-muted)" }}
                              >
                                <Gift style={{ width: "14px", height: "14px" }} />
                                {s.physical_gift_sent ? "Sent" : "Not sent"}
                              </button>
                            </td>
                            <td style={{ padding: "12px 8px" }}>
                              <CheckCircle style={{ width: "16px", height: "16px", color: s.is_active ? "var(--success)" : "var(--text-muted)" }} />
                            </td>
                            <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px" }}>
                              {new Date(s.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No supporters recorded yet.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
