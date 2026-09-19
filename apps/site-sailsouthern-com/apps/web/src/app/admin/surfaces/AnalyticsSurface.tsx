/**
 * AnalyticsSurface — Sail Southern domain surface.
 * Shows GA4 server-side event readiness, last reconciliation, email statistics,
 * traffic referrals, and top clicked article metrics.
 * Classification: Sail Southern-specific
 */
"use client";
import React, { useState, useEffect } from "react";
import { SectionShell } from "../commander/SectionShell";
import { StatusCard } from "../commander/StatusCard";
import { ReadinessCard } from "../commander/ReadinessCard";
import { Loader2, RefreshCw, Mail, Link as LinkIcon, Compass, Users } from "lucide-react";

interface ReconciliationData {
  reconciliation?: {
    last_reconciliation_at?: string;
    mismatches?: Array<{ post_id: number; platform: string; db_metrics: any; ga4_metrics: any }>;
    summary?: { posts_checked: number; mismatches_found: number };
  };
  analytics?: any;
}

export function AnalyticsSurface() {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Check env-level readiness from readiness endpoint
  const [ga4Ready, setGa4Ready] = useState<boolean | null>(null);
  const [ga4Missing, setGa4Missing] = useState<string[]>([]);

  const load = async () => {
    try {
      const [reconcRes, readinessRes, reportRes] = await Promise.all([
        fetch("/api/admin-proxy/v1/social/reconciliation"),
        fetch("/api/admin-proxy/v1/system/readiness"),
        fetch("/api/admin-proxy/v1/admin/analytics/report"),
      ]);
      if (reconcRes.ok) setData(await reconcRes.json());
      if (readinessRes.ok) {
        const rd = await readinessRes.json();
        const analyticsIntegration = rd.integrations?.find((i: any) => i.name === "Analytics — server-side events");
        if (analyticsIntegration) {
          setGa4Ready(analyticsIntegration.status === "ready");
          setGa4Missing(analyticsIntegration.missing || []);
        }
      }
      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData);
      }
    } catch (err) {
      console.error("Analytics load error:", err);
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <Loader2 className="animate-spin" style={{ width: "32px", height: "32px", color: "var(--primary)" }} />
    </div>
  );

  const recon = data?.reconciliation;
  const mismatches = recon?.mismatches?.length || 0;
  const lastRecon = recon?.last_reconciliation_at
    ? new Date(recon.last_reconciliation_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : "Never";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Overview Stats */}
      {report && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <StatusCard 
            label="Total Active Subscribers" 
            value={report.subscribers?.total ?? 0} 
            subtitle="Audited unique subscribers list"
          />
          <StatusCard 
            label="Email Subscriptions" 
            value={report.email_subscriptions?.total ?? 0} 
            subtitle="Confirmed opt-in daily/weekly subscribers"
          />
          <StatusCard 
            label="Top Referral Source" 
            value={report.referrals?.[0]?.medium ?? "direct/web"} 
            subtitle={`${report.referrals?.[0]?.count ?? 0} clicks logged`}
          />
        </div>
      )}

      {/* GA4 readiness */}
      <SectionShell
        title="Analytics readiness"
        icon="📊"
        badge={ga4Ready === true ? { label: "Events enabled", color: "green" } : ga4Ready === false ? { label: "Configuration needed", color: "red" } : undefined}
        actions={
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw style={{ width: "13px", height: "13px" }} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      >
        <ReadinessCard
          name="Server-side GA4 events (Measurement Protocol)"
          status={ga4Ready === true ? "ready" : ga4Ready === false ? "blocked" : "partial"}
          detail={ga4Ready ? "GA4_MEASUREMENT_ID and GA4_API_SECRET are configured." : `Missing: ${ga4Missing.join(", ") || "credentials not checked"}`}
          whyItMatters="Server-side events track publish, archive, and engagement actions without client-side JavaScript. Required for accurate attribution."
          remediation="Add GA4_MEASUREMENT_ID and GA4_API_SECRET from your GA4 property settings → Admin → Data Streams → Measurement Protocol API secrets."
        />
      </SectionShell>

      {/* Resend Email Campaign Performance */}
      <SectionShell title="Resend Email Performance" icon="✉️">
        {report?.resend_email_stats && report.resend_email_stats.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                  <th style={{ padding: "10px" }}>Issue Date</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Sent</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Delivered</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Opens</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Clicks</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Bounces</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Open Rate</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Click-to-Open (CTOR)</th>
                </tr>
              </thead>
              <tbody>
                {report.resend_email_stats.map((row: any, i: number) => {
                  const openRate = row.delivered > 0 ? ((row.opened / row.delivered) * 100).toFixed(1) + "%" : "0%";
                  const ctor = row.opened > 0 ? ((row.clicked / row.opened) * 100).toFixed(1) + "%" : "0%";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "10px", fontWeight: 500 }}>{row.issue_date}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>{row.sent}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>{row.delivered}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>{row.opened}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>{row.clicked}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: row.bounced > 0 ? "var(--accent)" : "inherit" }}>{row.bounced}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 600, color: "var(--success)" }}>{openRate}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 600, color: "var(--primary)" }}>{ctor}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
            No Resend campaign analytics recorded yet. Sent issues will automatically populate here.
          </div>
        )}
      </SectionShell>

      {/* Domain Demographics & UTM Referrals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        <SectionShell title="Top Referral Channels" icon="🧭">
          {report?.referrals && report.referrals.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>Campaign Medium</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Clicks logged</th>
                  </tr>
                </thead>
                <tbody>
                  {report.referrals.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "10px", fontWeight: 500, textTransform: "capitalize" }}>{row.medium}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No clicks recorded.</div>
          )}
        </SectionShell>

        <SectionShell title="Top Email Domains" icon="👥">
          {report?.email_subscriptions?.domains && report.email_subscriptions.domains.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>Email Domain</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Signups</th>
                  </tr>
                </thead>
                <tbody>
                  {report.email_subscriptions.domains.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "10px", fontWeight: 500 }}>{row.domain}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No subscribers domains data.</div>
          )}
        </SectionShell>
      </div>

      {/* Top Clicked Articles surface */}
      <SectionShell title="Top Performing Articles" icon="📰">
        {report?.top_clicked_articles && report.top_clicked_articles.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                  <th style={{ padding: "10px" }}>Article Title</th>
                  <th style={{ padding: "10px" }}>Link</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Total Clicks</th>
                </tr>
              </thead>
              <tbody>
                {report.top_clicked_articles.map((row: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "10px", fontWeight: 500, maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</td>
                    <td style={{ padding: "10px" }}>
                      <a href={row.canonical_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--primary)", textDecoration: "none" }}>
                        <LinkIcon style={{ width: "12px", height: "12px" }} />
                        Visit source
                      </a>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontWeight: 600, color: "var(--success)" }}>{row.click_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No article click telemetry recorded yet.</div>
        )}
      </SectionShell>

      {/* Support Ladder & Conversion Attribution */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        <SectionShell title="Sponsorship conversions" icon="⚡">
          {report?.support_conversions && report.support_conversions.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>Support Tier</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Conversions</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.support_conversions.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "10px", fontWeight: 500 }}>{row.tier_name}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>{row.count}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "var(--success)", fontWeight: 600 }}>${row.total_amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No support conversions logged yet.</div>
          )}
        </SectionShell>

        <SectionShell title="A/B Copy Experiment Results" icon="🧬">
          {report?.experiment_variants && report.experiment_variants.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>Variant</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Conversions</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.experiment_variants.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "10px", fontWeight: 500 }}>
                        {row.variant === "B" ? "Variant B (Mission Copy)" : "Variant A (Standard Copy)"}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>{row.count}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "var(--success)", fontWeight: 600 }}>${row.total_amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.custom_support_stats && report.custom_support_stats.count > 0 && (
                <div style={{ marginTop: "16px", padding: "12px", background: "var(--bg-primary)", borderRadius: "var(--radius-sm)", fontSize: "12px" }}>
                  <strong>Custom support stats:</strong> {report.custom_support_stats.count} inputs with an average level of <strong>${report.custom_support_stats.average_amount.toFixed(2)}</strong>.
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No experiment data logged.</div>
          )}
        </SectionShell>
      </div>

      {/* Social reconciliation sync */}
      <SectionShell
        title="Social engagement reconciliation"
        icon="🔄"
        badge={mismatches > 0 ? { label: `${mismatches} mismatch${mismatches === 1 ? "" : "es"}`, color: "yellow" } : recon ? { label: "In sync", color: "green" } : undefined}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <StatusCard label="Last sync" value={lastRecon} subtitle="Compares DB metrics vs GA4" />
          <StatusCard label="Posts checked" value={recon?.summary?.posts_checked ?? "—"} />
          <StatusCard
            label="Analytics mismatches"
            value={mismatches}
            valueColor={mismatches > 0 ? "var(--accent)" : "var(--success)"}
            subtitle={mismatches > 0 ? "DB and GA4 engagement counts differ" : "All counts match"}
          />
        </div>

        {recon?.mismatches && recon.mismatches.length > 0 && (
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>Mismatches</span>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "8px" }}>Post</th>
                    <th style={{ padding: "8px" }}>Platform</th>
                    <th style={{ padding: "8px" }}>DB value</th>
                    <th style={{ padding: "8px" }}>GA4 value</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.mismatches.map((m, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "8px" }}>#{m.post_id}</td>
                      <td style={{ padding: "8px", textTransform: "capitalize" }}>{m.platform}</td>
                      <td style={{ padding: "8px" }}>{JSON.stringify(m.db_metrics)}</td>
                      <td style={{ padding: "8px" }}>{JSON.stringify(m.ga4_metrics)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionShell>
    </div>
  );
}
