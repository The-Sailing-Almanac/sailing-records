/**
 * SocialDeliverySurface — Sail Southern domain surface.
 * Post archive with platform delivery badges, archive status, character counts, and retry.
 * Classification: Sail Southern-specific
 */
"use client";
import React, { useState, useEffect } from "react";
import { SectionShell } from "../commander/SectionShell";
import { ActionBar } from "../commander/ActionBar";
import { Loader2, RefreshCw } from "lucide-react";

const PLATFORM_LIMITS: Record<string, number> = {
  mastodon: 500,
  bluesky: 300,
  nostr: 800,
};

const PLATFORM_COLORS: Record<string, string> = {
  mastodon: "hsl(267, 60%, 55%)",
  bluesky: "hsl(205, 90%, 55%)",
  nostr: "hsl(38, 92%, 50%)",
};

function PlatformBadge({ platform, status, externalUrl }: { platform: string; status: string; externalUrl?: string }) {
  const color = PLATFORM_COLORS[platform] || "var(--text-secondary)";
  const isOk = status === "success";
  const label = isOk ? "Published" : status === "pending_retry" ? "Retry queued" : "Post did not publish";
  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "3px 10px",
    fontSize: "12px",
    fontWeight: 600,
    borderRadius: "100px",
    background: isOk ? `${color}22` : status === "pending_retry" ? "rgba(241,196,15,0.15)" : "rgba(231,76,60,0.15)",
    color: isOk ? color : status === "pending_retry" ? "var(--accent)" : "var(--error)",
    textDecoration: "none",
    cursor: isOk && externalUrl ? "pointer" : "default",
  };
  const content = (
    <>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "currentColor", display: "inline-block", flexShrink: 0 }} />
      <span style={{ textTransform: "capitalize" }}>{platform}</span>
      <span style={{ opacity: 0.7, fontWeight: 400 }}>— {label}</span>
    </>
  );
  return externalUrl && isOk ? (
    <a href={externalUrl} target="_blank" rel="noopener noreferrer" style={badgeStyle}>{content}</a>
  ) : (
    <span style={badgeStyle}>{content}</span>
  );
}

function CaptureBadge({ capture }: { capture: any }) {
  const isOk = capture.status === "completed";
  return (
    <a
      href={capture.archive_url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      style={{ padding: "3px 10px", fontSize: "11px", fontWeight: 700, borderRadius: "100px", background: isOk ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)", color: isOk ? "var(--success)" : "var(--error)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
    >
      🏛️ {isOk ? "Archived" : "Archive failed"}
      {capture.auth_mode && <span style={{ opacity: 0.6, fontWeight: 400 }}>· {capture.auth_mode === "authenticated" ? "auth" : "anon"}</span>}
    </a>
  );
}

interface SocialPost {
  id: number;
  content_text: string;
  title?: string;
  created_at: string;
  linked_entity_type?: string;
  linked_entity_id?: number;
  deliveries?: Array<{ id: number; platform: string; status: string; external_url?: string; external_id?: string; error_message?: string; latest_metrics?: any }>;
  captures?: Array<{ id: number; archive_url?: string; status: string; auth_mode?: string }>;
}

export function SocialDeliverySurface() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRaw, setExpandedRaw] = useState<Set<number>>(new Set());

  const load = async () => {
    try {
      const res = await fetch("/api/admin-proxy/v1/social/posts");
      if (res.ok) {
        const d = await res.json();
        setPosts(d.posts || []);
      }
    } catch (err) {
      console.error("Social delivery load error:", err);
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRetryDelivery = (deliveryId: number) => async () => {
    const res = await fetch(`/api/admin-proxy/v1/social/deliveries/${deliveryId}/retry`, { method: "POST" });
    const d = await res.json();
    await load();
    return res.ok ? { ok: true, message: d.message || "Retry queued." } : { ok: false, message: d.error?.message || "Retry failed." };
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <Loader2 className="animate-spin" style={{ width: "32px", height: "32px", color: "var(--primary)" }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionShell
        title={`Social posts (${posts.length})`}
        icon="📣"
        actions={
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw style={{ width: "13px", height: "13px" }} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      >
        {posts.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {posts.map((post) => {
              const charCount = post.content_text?.length || 0;
              const isRawOpen = expandedRaw.has(post.id);
              const failedDeliveries = post.deliveries?.filter((d) => d.status === "failed") || [];

              return (
                <div key={post.id} style={{ padding: "20px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", background: "var(--bg-secondary)" }}>
                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {new Date(post.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      {post.linked_entity_type && (
                        <span style={{ padding: "2px 8px", fontSize: "11px", fontWeight: 700, borderRadius: "100px", background: "var(--primary-glow)", color: "var(--primary)", textTransform: "uppercase" }}>
                          {post.linked_entity_type}
                        </span>
                      )}
                      <span style={{ padding: "2px 6px", fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-primary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                        {charCount} chars
                      </span>
                    </div>
                    {/* Archive status */}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {post.captures && post.captures.length > 0
                        ? post.captures.map((cap) => <CaptureBadge key={cap.id} capture={cap} />)
                        : <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px", background: "rgba(241,196,15,0.15)", color: "var(--accent)" }}>🏛️ Awaiting archive</span>
                      }
                    </div>
                  </div>

                  {/* Title */}
                  {post.title && (
                    <h4 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>{post.title}</h4>
                  )}

                  {/* Content preview */}
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "pre-wrap", background: "var(--bg-primary)", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", marginBottom: "12px" }}>
                    {post.content_text}
                  </p>

                  {/* Platform deliveries */}
                  <div style={{ marginBottom: failedDeliveries.length > 0 ? "12px" : "0" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Platform delivery</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {post.deliveries && post.deliveries.length > 0
                        ? post.deliveries.map((del) => (
                          <div key={del.id}>
                            <PlatformBadge platform={del.platform} status={del.status} externalUrl={del.external_url} />
                            {del.latest_metrics && (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "4px" }}>
                                (❤️ {del.latest_metrics.likes_count} 🔁 {del.latest_metrics.shares_count} 💬 {del.latest_metrics.replies_count})
                              </span>
                            )}
                          </div>
                        ))
                        : <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No deliveries recorded.</span>
                      }
                    </div>
                  </div>

                  {/* Failed delivery retries */}
                  {failedDeliveries.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                      {failedDeliveries.map((del) => (
                        <div key={del.id} style={{ marginBottom: "8px" }}>
                          {del.error_message && (
                            <div style={{ marginBottom: "6px", padding: "8px 10px", background: "rgba(231,76,60,0.06)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(231,76,60,0.15)" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--error)", display: "block", marginBottom: "2px" }}>
                                {del.platform} — post did not publish
                              </span>
                              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{del.error_message}</span>
                            </div>
                          )}
                          <ActionBar
                            label={`Retry ${del.platform} delivery`}
                            icon="↩"
                            variant="secondary"
                            onAction={handleRetryDelivery(del.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dev disclosure */}
                  <div style={{ marginTop: "10px" }}>
                    <button
                      onClick={() => setExpandedRaw((prev) => {
                        const next = new Set(prev);
                        next.has(post.id) ? next.delete(post.id) : next.add(post.id);
                        return next;
                      })}
                      style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0" }}
                    >
                      {isRawOpen ? "▲ Hide" : "▼ Show"} raw payload
                    </button>
                    {isRawOpen && (
                      <pre style={{ marginTop: "8px", fontSize: "11px", background: "var(--bg-primary)", padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", overflow: "auto", maxHeight: "200px" }}>
                        {JSON.stringify({ id: post.id, deliveries: post.deliveries, captures: post.captures }, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <p style={{ fontSize: "15px", marginBottom: "8px" }}>No published posts yet.</p>
            <p style={{ fontSize: "13px" }}>Posts will appear here once publishing credentials are configured and the first micro-edition is published.</p>
          </div>
        )}
      </SectionShell>
    </div>
  );
}
