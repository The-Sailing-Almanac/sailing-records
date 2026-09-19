import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Calendar, Compass, Layers, ShieldCheck, AlertCircle } from "lucide-react";
import Symbol from "../../components/Symbol";
import VoteSection from "./VoteSection";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getBoatDetails(id: string) {
  try {
    const res = await fetch(`${API_BASE}/api/boats/${id}`, {
      cache: "no-store",
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }

    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error(`[Boat Details Page] Failed to fetch boat ID ${id}:`, err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const data = await getBoatDetails(id);
  if (!data || !data.boat) {
    return {
      title: "Boat Not Found | Sail Southern",
    };
  }

  const { builder_name, model_name, variant_name } = data.boat;
  const name = `${builder_name} ${model_name}${variant_name ? ` (${variant_name})` : ""}`;
  return {
    title: `${name} Specifications | Sail Southern`,
    description: `Consensus-verified rig dimensions, hull design, displacement, and engine details for the ${name}.`,
  };
}

export default async function BoatDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getBoatDetails(id);

  if (!data || !data.boat) {
    notFound();
  }

  const { boat, specs, sources } = data;
  const boatName = `${boat.builder_name} ${boat.model_name}${boat.variant_name ? ` (${boat.variant_name})` : ""}`;

  return (
    <div style={{ paddingBottom: "100px", paddingTop: "40px" }}>
      <div className="container">
        {/* Back Link */}
        <Link
          href="/boats"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            color: "var(--text-secondary)",
            marginBottom: "32px",
            fontWeight: 500,
            textDecoration: "none",
            transition: "var(--transition-fast)",
          }}
          className="nav-link"
        >
          <ArrowLeft size={16} />
          Back to Boats Index
        </Link>

        {/* Hero Section / Title Card */}
        <section
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "40px",
            boxShadow: "var(--glass-shadow)",
            marginBottom: "40px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              opacity: 0.05,
              color: "var(--primary)",
              pointerEvents: "none",
            }}
          >
            <Symbol name="superyachtProfile" size={160} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  background: "var(--primary-glow)",
                  padding: "4px 10px",
                  borderRadius: "100px",
                  border: "1px solid var(--border-color)",
                }}
              >
                {boat.builder_name}
              </span>
            </div>

            <h1
              style={{
                fontSize: "44px",
                fontFamily: "var(--font-heading)",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {boatName}
            </h1>

            {/* Quick stats strip */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "24px",
                marginTop: "16px",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "20px",
                fontSize: "15px",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Calendar size={18} style={{ color: "var(--primary)" }} />
                <span>
                  Production: <strong>{boat.year_start}</strong>
                  {boat.year_end ? ` – ${boat.year_end}` : " (Active)"}
                </span>
              </div>

              {boat.hull_type && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Layers size={18} style={{ color: "var(--primary)" }} />
                  <span>
                    Hull Design: <strong>{boat.hull_type}</strong>
                  </span>
                </div>
              )}

              {boat.rig_type && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Compass size={18} style={{ color: "var(--primary)" }} />
                  <span>
                    Rig configuration: <strong>{boat.rig_type}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Main Grid Content */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: "40px",
            alignItems: "start",
          }}
          className="boat-details-grid"
        >
          {/* Main Specifications Form Column */}
          <div>
            <h2
              style={{
                fontSize: "24px",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ShieldCheck size={24} style={{ color: "var(--success)" }} />
              Consensus Specifications
            </h2>

            {Object.keys(specs).length === 0 ? (
              <div
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "32px",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                No spec fields have reached consensus for this boat model yet.
              </div>
            ) : (
              <VoteSection boatId={boat.id} initialSpecs={specs} />
            )}
          </div>

          {/* Right Sidebar: Ingestion Sources and corrections */}
          <aside style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* Sources list */}
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                padding: "24px",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-primary)",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                Data Provenance
              </h3>

              <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.5", marginBottom: "20px" }}>
                This profile consolidates raw measurements from these verified resources:
              </p>

              {sources.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  No source links available.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {sources.map((source: any, index: number) => {
                    const isSailboatData = source.source_type === "sailboatdata";
                    const sourceLabel = isSailboatData ? "SailboatData.com" : "YachtWorld Listing";
                    
                    return (
                      <div
                        key={index}
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          padding: "12px",
                        }}
                      >
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                          {source.source_type}
                        </div>
                        {source.source_url ? (
                          <a
                            href={source.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "13px",
                              color: "var(--primary)",
                              fontWeight: 600,
                              wordBreak: "break-all",
                            }}
                          >
                            <span>{sourceLabel}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                            {sourceLabel} (cached spec sheet)
                          </span>
                        )}
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                          Last Crawled: {new Date(source.last_seen_at).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit correction callout */}
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                padding: "24px",
                boxShadow: "var(--glass-shadow)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent)" }}>
                <AlertCircle size={20} />
                <h4 style={{ fontSize: "15px", fontFamily: "var(--font-heading)", fontWeight: 700, margin: 0 }}>
                  Spot a correction?
                </h4>
              </div>

              <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                If you have access to verified class rules, measurements, or brochures that differ from our values, please submit a correction report.
              </p>

              <Link
                href={`/submit?type=correction&boat_id=${boat.id}`}
                className="btn btn-secondary"
                style={{
                  fontSize: "13px",
                  padding: "10px 16px",
                  textAlign: "center",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                Submit Specification Correction
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
