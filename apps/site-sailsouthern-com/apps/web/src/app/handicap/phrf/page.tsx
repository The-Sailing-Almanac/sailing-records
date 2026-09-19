"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Compass, ShieldCheck, Mail, HelpCircle, ChevronDown, ChevronUp, AlertCircle, Info, Check } from "lucide-react";
import Symbol from "../../components/Symbol";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Boat {
  id: number;
  builder_name: string;
  model_name: string;
  variant_name: string | null;
  year_start: number;
  year_end: number | null;
  hull_type: string | null;
  rig_type: string | null;
}

interface Region {
  slug: string;
  name: string;
  authority_url: string | null;
}

interface Comparison {
  region_slug: string;
  region_name: string;
  rating_base: number | null;
  rating_spin: number | null;
  rating_nonspin: number | null;
  allowance_base_seconds: number | null;
  allowance_spin_seconds: number | null;
  allowance_nonspin_seconds: number | null;
}

interface Delta {
  from_region: string;
  to_region: string;
  type: "base" | "spin" | "nonspin";
  rating_diff: number;
  time_delta_seconds: number;
}

interface ComparisonResponse {
  boat: Boat;
  distance_nm: number;
  comparisons: Comparison[];
  deltas: Delta[];
}

export default function PhrfExplorerPage() {
  // Step states
  const [boatSearchQuery, setBoatSearchQuery] = useState("");
  const [boatSuggestions, setBoatSuggestions] = useState<Boat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const [distanceNm, setDistanceNm] = useState<number>(5.0);
  const [elapsedTimeMinutes, setElapsedTimeMinutes] = useState<number>(60); // for corrected time chart

  // API response & loading states
  const [comparisonData, setComparisonData] = useState<ComparisonResponse | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState("");

  // Newsletter states
  const [email, setEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subscribeMessage, setSubscribeMessage] = useState("");

  // Content Accordions
  const [openAccordion, setOpenAccordion] = useState<"why" | "appeals" | null>(null);

  // Fetch regions on mount
  useEffect(() => {
    async function fetchRegions() {
      try {
        const res = await fetch(`${API_BASE}/api/handicap/phrf/regions`);
        if (res.ok) {
          const data = await res.json();
          setRegions(data.data.regions || []);
        }
      } catch (err) {
        console.error("Failed to load PHRF regions:", err);
      }
    }
    fetchRegions();
  }, []);

  // Search boats as user types
  useEffect(() => {
    if (boatSearchQuery.length < 2) {
      setBoatSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/boats?model=${encodeURIComponent(boatSearchQuery)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setBoatSuggestions(data.data.boats || []);
        }
      } catch (err) {
        console.error("Failed to search boats:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [boatSearchQuery]);

  const handleSelectBoat = (boat: Boat) => {
    setSelectedBoat(boat);
    setBoatSearchQuery(`${boat.builder_name} ${boat.model_name}`);
    setBoatSuggestions([]);
  };

  const handleToggleRegion = (slug: string) => {
    setSelectedRegions(prev => {
      if (prev.includes(slug)) {
        return prev.filter(s => s !== slug);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), slug]; // Limit to 3, slide out first selected
      }
      return [...prev, slug];
    });
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoat || selectedRegions.length === 0 || distanceNm <= 0) return;

    setIsLoadingCompare(true);
    setCompareError("");

    try {
      const res = await fetch(`${API_BASE}/api/handicap/phrf/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boat_id: selectedBoat.id,
          regions: selectedRegions,
          distance_nm: distanceNm,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to calculate PHRF comparison.");
      }

      setComparisonData(data.data);
    } catch (err: any) {
      console.error(err);
      setCompareError(err.message || "Connection to API failed.");
    } finally {
      setIsLoadingCompare(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubscribeStatus("loading");
    setSubscribeMessage("");

    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          frequency: ["handicap_hq"],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSubscribeStatus("success");
        setSubscribeMessage("Successfully subscribed to Handicap HQ. Stay tuned for rating adjustments!");
        setEmail("");
      } else {
        setSubscribeStatus("error");
        setSubscribeMessage(data.error || "Failed to subscribe.");
      }
    } catch (err) {
      console.error("Subscription failed:", err);
      setSubscribeStatus("error");
      setSubscribeMessage("Failed to connect to the server.");
    }
  };

  // Helper to format seconds to MM:SS or HH:MM:SS
  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);

    const pad = (num: number) => String(num).padStart(2, "0");

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
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
            <Symbol name="chartContour" size={14} color="var(--primary)" />
            <span style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}>Free Calculator Tool</span>
          </div>

          <h1 style={{ fontSize: "40px", fontFamily: "var(--font-heading)", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
            PHRF Regional Explorer
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "700px", margin: "8px 0 0 0", lineHeight: "1.6" }}>
            Compare sailboat ratings and time allowance offsets across regional PHRF fleets. Discover how local wind patterns and course models shift handicap metrics.
          </p>
        </div>

        {/* Two-Column Form and Results */}
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "40px", alignItems: "start" }} className="phrf-grid">
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
                Compare Ratings
              </h2>
            </div>

            <form onSubmit={handleCompare} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Step 1: Select Boat */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", position: "relative" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Step 1: Select Boat Model
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search model (e.g. Catalina 30)"
                    value={boatSearchQuery}
                    onChange={(e) => {
                      setBoatSearchQuery(e.target.value);
                      if (selectedBoat) {
                        setSelectedBoat(null);
                        setComparisonData(null);
                      }
                    }}
                    className="form-input"
                    style={{ paddingLeft: "36px", fontSize: "14px" }}
                  />
                  <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                </div>

                {/* Suggestions Dropdown */}
                {boatSuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      zIndex: 50,
                      maxHeight: "220px",
                      overflowY: "auto",
                      marginTop: "4px",
                    }}
                  >
                    {boatSuggestions.map((boat) => (
                      <button
                        key={boat.id}
                        type="button"
                        onClick={() => handleSelectBoat(boat)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 14px",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid var(--border-color)",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          transition: "var(--transition-fast)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <strong>{boat.builder_name}</strong> {boat.model_name} {boat.variant_name ? `(${boat.variant_name})` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: Choose Regions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Step 2: Regions (Select up to 3)
                </label>
                {regions.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    No regions loaded.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {regions.map((region) => {
                      const isChecked = selectedRegions.includes(region.slug);
                      return (
                        <button
                          key={region.slug}
                          type="button"
                          onClick={() => handleToggleRegion(region.slug)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: "var(--radius-sm)",
                            border: `1px solid ${isChecked ? "var(--primary)" : "var(--border-color)"}`,
                            background: isChecked ? "var(--primary-glow)" : "var(--bg-primary)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            fontSize: "13px",
                            textAlign: "left",
                            fontWeight: isChecked ? 600 : 500,
                            transition: "var(--transition-fast)",
                          }}
                        >
                          <span>{region.name}</span>
                          {isChecked && <Check size={14} style={{ color: "var(--primary)" }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Enter Distance */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Step 3: Course Distance
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={distanceNm}
                    onChange={(e) => {
                      setDistanceNm(parseFloat(e.target.value) || 0);
                      setComparisonData(null);
                    }}
                    className="form-input"
                    style={{ paddingRight: "48px", fontSize: "14px" }}
                  />
                  <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                    NM
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedBoat || selectedRegions.length === 0 || distanceNm <= 0 || isLoadingCompare}
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
                {isLoadingCompare ? (
                  <>
                    <Loader2 size={16} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <Compass size={16} />
                    <span>Compare Ratings</span>
                  </>
                )}
              </button>
            </form>

            {compareError && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--error)", fontSize: "13px" }}>
                <AlertCircle size={16} />
                <span>{compareError}</span>
              </div>
            )}
          </aside>

          {/* Results column */}
          <div>
            {!comparisonData ? (
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
                <Compass size={64} style={{ color: "var(--text-muted)", strokeWidth: 1.0 }} />
                <h3 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", color: "var(--text-primary)", margin: 0 }}>
                  Enter Handicap Parameters
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "440px", margin: 0, lineHeight: "1.6" }}>
                  Select a boat model, choose regional handicap fleets, and specify a race course distance to calculate base time allowances and pairwise offsets.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                {/* 1. Region vs Rating Table */}
                <section
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  <h2 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: "20px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldCheck size={22} style={{ color: "var(--success)" }} />
                    Ratings &amp; Allowances: {boatName(comparisonData.boat)}
                  </h2>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border-color)", color: "var(--text-secondary)", fontWeight: 600 }}>
                          <th style={{ padding: "12px 8px" }}>Region</th>
                          <th style={{ padding: "12px 8px", textAlign: "center" }}>Spinnaker Rating</th>
                          <th style={{ padding: "12px 8px", textAlign: "center" }}>Non-Spinnaker</th>
                          <th style={{ padding: "12px 8px", textAlign: "center" }}>Base</th>
                          <th style={{ padding: "12px 8px", textAlign: "right" }}>Spin Allowance ({distanceNm} NM)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.comparisons.map((c) => (
                          <tr key={c.region_slug} style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                            <td style={{ padding: "14px 8px", fontWeight: 600 }}>{c.region_name}</td>
                            <td style={{ padding: "14px 8px", textAlign: "center", fontFamily: "monospace", fontSize: "15px" }}>
                              {c.rating_spin !== null ? `${c.rating_spin} s/mi` : "N/A"}
                            </td>
                            <td style={{ padding: "14px 8px", textAlign: "center", fontFamily: "monospace", fontSize: "15px" }}>
                              {c.rating_nonspin !== null ? `${c.rating_nonspin} s/mi` : "N/A"}
                            </td>
                            <td style={{ padding: "14px 8px", textAlign: "center", fontFamily: "monospace", fontSize: "15px" }}>
                              {c.rating_base !== null ? `${c.rating_base} s/mi` : "N/A"}
                            </td>
                            <td style={{ padding: "14px 8px", textAlign: "right", fontWeight: 700 }}>
                              {c.allowance_spin_seconds !== null ? formatDuration(c.allowance_spin_seconds) : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 2. Visual Corrected Time Comparison */}
                <section
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  <h2 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                    Time Allowance Deltas (Offsets)
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
                    How many seconds faster/slower is this boat rated in different regions? Delta values calculate the total course offset in seconds.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {comparisonData.deltas.length === 0 ? (
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Need at least two regions to display differences.
                      </div>
                    ) : (
                      comparisonData.deltas.map((d, index) => {
                        const fromName = comparisonData.comparisons.find(c => c.region_slug === d.from_region)?.region_name || d.from_region;
                        const toName = comparisonData.comparisons.find(c => c.region_slug === d.to_region)?.region_name || d.to_region;
                        const configLabel = d.type === "spin" ? "Spinnaker" : d.type === "nonspin" ? "Non-Spinnaker" : "Base";
                        const isFaster = d.rating_diff < 0; // lower rating is faster boat (gets less time allowance)
                        
                        return (
                          <div
                            key={index}
                            style={{
                              background: "var(--bg-primary)",
                              border: "1px solid var(--border-color)",
                              borderRadius: "var(--radius-sm)",
                              padding: "16px",
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              alignItems: "center",
                              gap: "16px",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                                {configLabel} comparison
                              </div>
                              <span style={{ fontSize: "14px", fontWeight: 600 }}>
                                {fromName} vs {toName}
                              </span>
                              <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: "4px 0 0 0" }}>
                                Rating difference: <strong>{Math.abs(d.rating_diff)} s/mi</strong>.
                              </p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ display: "block", fontSize: "18px", fontWeight: 800, color: "var(--primary)", fontFamily: "var(--font-heading)" }}>
                                {isFaster ? "-" : "+"}{formatDuration(Math.abs(d.time_delta_seconds))}
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {isFaster ? "fewer allowance seconds" : "more allowance seconds"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Slider Control for Chart */}
                  <div style={{ marginTop: "32px", borderTop: "1px solid var(--border-color)", paddingTop: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase" }}>
                        Chart: Corrected Time for {elapsedTimeMinutes}m Elapsed
                      </label>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--primary)" }}>
                        {formatDuration(elapsedTimeMinutes * 60)} elapsed
                      </span>
                    </div>

                    <input
                      type="range"
                      min="15"
                      max="240"
                      value={elapsedTimeMinutes}
                      onChange={(e) => setElapsedTimeMinutes(parseInt(e.target.value, 10))}
                      style={{
                        width: "100%",
                        height: "6px",
                        borderRadius: "100px",
                        background: "var(--border-color)",
                        cursor: "pointer",
                        outline: "none",
                        accentColor: "var(--primary)",
                      }}
                    />

                    {/* Chart Container */}
                    <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      {comparisonData.comparisons.map((c) => {
                        const elapsedSecs = elapsedTimeMinutes * 60;
                        const rating = c.rating_spin || c.rating_base || 0;
                        
                        // Corrected time under Time-on-Distance:
                        // Corrected = Elapsed - (Rating * Distance)
                        const correctedSecs = elapsedSecs - rating * distanceNm;
                        
                        // Calculate percentage of elapsed time to render bar width
                        const percent = Math.max(10, Math.min(100, (correctedSecs / elapsedSecs) * 100));

                        return (
                          <div key={c.region_slug} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
                              <span style={{ color: "var(--text-primary)" }}>{c.region_name} (Spin)</span>
                              <span style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                Corrected: {formatDuration(correctedSecs)}
                              </span>
                            </div>
                            <div style={{ height: "16px", width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "100px", overflow: "hidden" }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${percent}%`,
                                  background: "linear-gradient(90deg, var(--primary) 0%, var(--primary-hover) 100%)",
                                  borderRadius: "100px",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* 3. Lead Gen Newsletter Box */}
                <section
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px",
                    boxShadow: "var(--glass-shadow)",
                    display: "grid",
                    gridTemplateColumns: "1fr 280px",
                    gap: "24px",
                    alignItems: "center",
                  }}
                  className="phrf-newsletter"
                >
                  <div>
                    <h3 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Mail style={{ color: "var(--primary)" }} size={20} />
                      Join Handicap HQ
                    </h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                      Get notified when local PHRF boards update sailboat ratings, appeals are filed, or certificate schemas change. No trackers, unsubscribe anytime.
                    </p>
                  </div>

                  <div>
                    {subscribeStatus === "success" ? (
                      <div style={{ color: "var(--success)", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                        <Check size={16} />
                        <span>Subscribed successfully!</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSubscribe} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input
                          type="email"
                          required
                          placeholder="your-email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={subscribeStatus === "loading"}
                          className="form-input"
                          style={{ padding: "8px 12px", fontSize: "13px" }}
                        />
                        <button
                          type="submit"
                          disabled={subscribeStatus === "loading" || !email}
                          className="btn btn-primary"
                          style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
                        >
                          {subscribeStatus === "loading" ? "Subscribing..." : "Subscribe to Updates"}
                        </button>
                      </form>
                    )}
                    {subscribeStatus === "error" && (
                      <div style={{ color: "var(--error)", fontSize: "12px", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertCircle size={12} />
                        <span>{subscribeMessage}</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {/* Section 11D-6: Content Hooks / Accordions */}
        <section style={{ marginTop: "64px", borderTop: "1px solid var(--border-color)", paddingTop: "48px" }}>
          <h2 style={{ fontSize: "26px", fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "24px", textAlign: "center" }}>
            Understanding PHRF Handicap Rules
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", maxWidth: "900px", margin: "0 auto" }}>
            {/* Accordion 1: Why ratings differ by region */}
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                padding: "24px",
                boxShadow: "var(--glass-shadow)",
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
              onClick={() => setOpenAccordion(openAccordion === "why" ? null : "why")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Info size={18} style={{ color: "var(--primary)" }} />
                  Why do ratings differ by region?
                </h3>
                {openAccordion === "why" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {openAccordion === "why" && (
                <div style={{ marginTop: "16px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                  <p style={{ marginBottom: "12px" }}>
                    PHRF handicaps are not absolute physical constants. They are designed to reflect the speed potential of a boat relative to others in a specific sailing environment.
                  </p>
                  <p style={{ marginBottom: "12px" }}>
                    Local fleet committees adjust handicaps based on:
                  </p>
                  <ul style={{ paddingLeft: "20px", marginBottom: "12px" }}>
                    <li><strong>Average Local Wind:</strong> Venues with light breeze (like Galveston Bay or Chesapeake Bay) penalize boats with low power-to-weight ratios less than windy regions (like San Francisco).</li>
                    <li><strong>Sea State &amp; Water Depth:</strong> Chop, tides, and shallow waters favor or hinder certain hull designs.</li>
                    <li><strong>Course Types:</strong> Fleets that race primarily windward/leeward courses rate boats differently than fleets with point-to-point distance races.</li>
                  </ul>
                  <a href="#subscribe" style={{ color: "var(--primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    Subscribe to learn more <Compass size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* Accordion 2: How to think about appeals */}
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                padding: "24px",
                boxShadow: "var(--glass-shadow)",
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
              onClick={() => setOpenAccordion(openAccordion === "appeals" ? null : "appeals")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <HelpCircle size={18} style={{ color: "var(--primary)" }} />
                  How do I appeal a rating?
                </h3>
                {openAccordion === "appeals" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {openAccordion === "appeals" && (
                <div style={{ marginTop: "16px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                  <p style={{ marginBottom: "12px" }}>
                    If you believe your boat is unfairly rated compared to similar models in your class or region, you can file an appeal with your local fleet board.
                  </p>
                  <p style={{ marginBottom: "12px" }}>
                    To make a successful rating appeal, you should gather:
                  </p>
                  <ul style={{ paddingLeft: "20px", marginBottom: "12px" }}>
                    <li><strong>Observed Performance:</strong> Documentation of multiple races showing corrected time results vs. competitors.</li>
                    <li><strong>Class Verification:</strong> Measurements proving your sails or rig conform to class rules (or listing modifications).</li>
                    <li><strong>Consensus Comp:</strong> Data showing how your model is rated in adjacent regional boards (which is what our PHRF Explorer is designed to show!).</li>
                  </ul>
                  <p style={{ margin: 0 }}>
                    Our upcoming **PHRF Appeal Builder** tool will automate generating these packages. Join the newsletter to get notified of its release!
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function boatName(boat: Boat) {
  return `${boat.builder_name} ${boat.model_name}${boat.variant_name ? ` (${boat.variant_name})` : ""}`;
}

interface LoaderProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function Loader2({ size = 20, className = "", style }: LoaderProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

