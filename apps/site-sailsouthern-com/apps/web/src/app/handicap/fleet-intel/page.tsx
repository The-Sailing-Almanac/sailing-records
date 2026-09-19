"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Compass, ShieldCheck, Mail, HelpCircle, ChevronDown, ChevronUp, AlertCircle, Info, Check, Table, BarChart2, Sparkles, Wind } from "lucide-react";
import Symbol from "../../components/Symbol";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface FleetBoat {
  external_id: string;
  builder_name: string;
  model_name: string;
  gph: number;
  loa_m: number;
  displacement_kg: number;
  upwind_sa_m2: number;
  sa_disp_ratio: number;
  dl_ratio: number;
  favored_wind: "light" | "medium" | "heavy";
  heuristic_text: string;
}

interface FleetIntelResult {
  wind_band: "light" | "medium" | "heavy";
  boats: FleetBoat[];
  disclaimer: string;
}

export default function FleetIntelPage() {
  const [boatListRaw, setBoatListRaw] = useState(
    "USA-J24-001\nUSA-CAT30-002\nUSA-J70-003"
  );
  const [windBand, setWindBand] = useState<"light" | "medium" | "heavy">("medium");

  // Loading & Results
  const [intelData, setIntelData] = useState<FleetIntelResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boatListRaw.trim()) return;

    setIsLoading(true);
    setError("");
    setIntelData(null);

    const identifiers = boatListRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`${API_BASE}/api/handicap/fleet-intel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boat_identifiers: identifiers,
          wind_band: windBand,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze fleet.");
      }

      setIntelData(data.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Connection to API failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: "100px", paddingTop: "40px" }}>
      <div className="container">
        {/* Title Block */}
        <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "24px", marginBottom: "40px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 14px",
              borderRadius: "100px",
              background: "var(--primary-glow)",
              border: "1px solid var(--border-color)",
              color: "var(--primary)",
              fontSize: "12px",
              fontWeight: 700,
              gap: "6px",
              alignSelf: "flex-start",
              marginBottom: "16px",
            }}
          >
            <Sparkles size={14} color="var(--primary)" />
            <span style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}>Tactical MVP</span>
          </div>

          <h1 style={{ fontSize: "40px", fontFamily: "var(--font-heading)", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
            Fleet Intel &amp; Tactician Advisor
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "700px", margin: "8px 0 0 0", lineHeight: "1.6" }}>
            Analyze fleet entries to determine performance ratios and forecast who holds rating advantages in specific wind bands.
          </p>
        </div>

        {/* Two-Column Form and Results */}
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "40px", alignItems: "start" }} className="phrf-grid">
          {/* Sidebar Configurator */}
          <aside
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "24px",
              boxShadow: "var(--glass-shadow)",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h2 style={{ fontSize: "16px", fontFamily: "var(--font-heading)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                Fleet Input
              </h2>
            </div>

            <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Step 1: Input list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Paste Boat IDs or Registry Names (one per line)
                </label>
                <textarea
                  value={boatListRaw}
                  onChange={(e) => setBoatListRaw(e.target.value)}
                  className="form-input"
                  style={{
                    minHeight: "120px",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    padding: "12px",
                  }}
                  required
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Use certificates loaded during ingest (e.g. <code>USA-J24-001</code>) or registry names (e.g. <code>Catalina 30</code>).
                </span>
              </div>

              {/* Step 2: Select wind band */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Forecast Wind Band
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {(["light", "medium", "heavy"] as const).map((band) => (
                    <button
                      key={band}
                      type="button"
                      onClick={() => setWindBand(band)}
                      style={{
                        padding: "8px 0",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${windBand === band ? "var(--primary)" : "var(--border-color)"}`,
                        background: windBand === band ? "var(--primary-glow)" : "var(--bg-primary)",
                        color: "var(--text-primary)",
                        fontSize: "12px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        cursor: "pointer",
                        transition: "var(--transition-fast)",
                      }}
                    >
                      {band}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!boatListRaw.trim() || isLoading}
                className="btn btn-primary"
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 0",
                  marginTop: "8px",
                }}
              >
                {isLoading ? (
                  <span>Analyzing...</span>
                ) : (
                  <>
                    <Wind size={16} />
                    <span>Analyze Fleet Intel</span>
                  </>
                )}
              </button>
            </form>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--error)", fontSize: "13px" }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </aside>

          {/* Results column */}
          <div>
            {!intelData ? (
              <div
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-lg)",
                  padding: "64px 32px",
                  textAlign: "center",
                  boxShadow: "var(--glass-shadow)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  height: "100%",
                }}
              >
                <BarChart2 size={64} style={{ color: "var(--text-muted)", strokeWidth: 1.0 }} />
                <h3 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", color: "var(--text-primary)", margin: 0 }}>
                  Fleet Analysis Report
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "440px", margin: 0, lineHeight: "1.6" }}>
                  Paste your fleet's identifiers or yacht models and pick a wind band. The advisor will cross-reference displacement/length (D/L) and sail-area/displacement (SA/D) metrics to pinpoint competitive advantages.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                {/* 1. Analyzed Fleet Table */}
                <section
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  <h2 style={{ fontSize: "22px", fontFamily: "var(--font-heading)", fontWeight: 800, marginBottom: "20px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Table size={24} style={{ color: "var(--primary)" }} />
                    Fleet Handicap Comparison: {windBand.toUpperCase()} Wind
                  </h2>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border-color)", color: "var(--text-secondary)", fontWeight: 600 }}>
                          <th style={{ padding: "12px 8px" }}>Boat Model</th>
                          <th style={{ padding: "12px 8px", textAlign: "center" }}>GPH (sec/mi)</th>
                          <th style={{ padding: "12px 8px", textAlign: "center" }}>SA/D Ratio</th>
                          <th style={{ padding: "12px 8px", textAlign: "center" }}>D/L Ratio</th>
                          <th style={{ padding: "12px 8px", textAlign: "right" }}>Wind Advantage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intelData.boats.map((b) => (
                          <tr key={b.external_id} style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                            <td style={{ padding: "14px 8px", fontWeight: 600 }}>
                              {b.builder_name} {b.model_name}
                            </td>
                            <td style={{ padding: "14px 8px", textAlign: "center", fontFamily: "monospace" }}>
                              {b.gph}
                            </td>
                            <td style={{ padding: "14px 8px", textAlign: "center", fontFamily: "monospace" }}>
                              {b.sa_disp_ratio}
                            </td>
                            <td style={{ padding: "14px 8px", textAlign: "center", fontFamily: "monospace" }}>
                              {b.dl_ratio}
                            </td>
                            <td style={{ padding: "14px 8px", textAlign: "right" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  background: b.favored_wind === windBand ? "var(--primary-glow)" : "var(--bg-primary)",
                                  border: `1px solid ${b.favored_wind === windBand ? "var(--primary)" : "var(--border-color)"}`,
                                  color: b.favored_wind === windBand ? "var(--primary)" : "var(--text-secondary)",
                                }}
                              >
                                {b.favored_wind === "light" ? "Light Air" : b.favored_wind === "heavy" ? "Heavy Air" : "All-Rounder"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Heuristics Details */}
                <section
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  <h2 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: "20px", color: "var(--text-primary)" }}>
                    Tactical Strategic Assessments
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {intelData.boats.map((b) => (
                      <div
                        key={b.external_id}
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          padding: "16px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px" }}>
                            {b.builder_name} {b.model_name}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            Cert ID: {b.external_id}
                          </span>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
                          {b.heuristic_text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Warning / Educational Disclaimer */}
                  <div
                    style={{
                      background: "var(--primary-glow)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      padding: "16px",
                      display: "flex",
                      gap: "12px",
                      alignItems: "start",
                      marginTop: "24px",
                    }}
                  >
                    <Info size={18} style={{ color: "var(--primary)", marginTop: "2px", flexShrink: 0 }} />
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                      <strong>Methodology Note:</strong> {intelData.disclaimer} Performance predictions are computed utilizing standard hydro-mechanical heuristics and certificate measurements.
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
