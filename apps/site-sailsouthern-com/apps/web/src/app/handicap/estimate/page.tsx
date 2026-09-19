"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Compass, ShieldCheck, Mail, HelpCircle, ChevronDown, ChevronUp, AlertCircle, Info, Check, Calculator, Download } from "lucide-react";
import Symbol from "../../components/Symbol";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Boat {
  id: number;
  builder_name: string;
  model_name: string;
  variant_name: string | null;
  loa_m: number | null;
  displacement_kg: number | null;
}

interface EstimateResult {
  boat: {
    builder_name: string;
    model_name: string;
  };
  phrf_rating: number;
  orc: {
    gphMin: number;
    gphMax: number;
    explanation: string;
  };
  irc: {
    tccMin: number;
    tccMax: number;
    explanation: string;
  };
  is_educational: boolean;
  disclaimer: string;
}

export default function CrossSystemEstimatorPage() {
  const [boatSearchQuery, setBoatSearchQuery] = useState("");
  const [boatSuggestions, setBoatSuggestions] = useState<Boat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null);

  // Manual dimensions override
  const [useManualSpecs, setUseManualSpecs] = useState(false);
  const [loaM, setLoaM] = useState("");
  const [displacementKg, setDisplacementKg] = useState("");
  const [sailAreaSqm, setSailAreaSqm] = useState("");

  const [phrfRating, setPhrfRating] = useState<number | "">("");

  // Result & loading states
  const [estimateData, setEstimateData] = useState<EstimateResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Report subscription state
  const [email, setEmail] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [reportMessage, setReportMessage] = useState("");

  // Search boats as user types
  useEffect(() => {
    if (useManualSpecs || boatSearchQuery.length < 2) {
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
  }, [boatSearchQuery, useManualSpecs]);

  const handleSelectBoat = (boat: Boat) => {
    setSelectedBoat(boat);
    setBoatSearchQuery(`${boat.builder_name} ${boat.model_name}`);
    setBoatSuggestions([]);
    setUseManualSpecs(false);
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phrfRating === "") return;

    setIsLoading(true);
    setError("");
    setEstimateData(null);

    try {
      // If using manual specs or no boat selected, we need to handle boat selection.
      // For MVP, if manual, we can create a temporary or dummy boat mapping or call the API.
      // The API requires a valid boat_id, so if manual, we'll map to a default fallback boat (e.g. ID 1)
      // or we can simulate the calculation locally if no boat ID is selected.
      let boatId = selectedBoat ? selectedBoat.id : 1;

      const bodyPayload = {
        boat_id: boatId,
        phrf_rating: Number(phrfRating),
      };

      const res = await fetch(`${API_BASE}/api/handicap/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to calculate estimate.");
      }

      // If manual override was checked, we adjust the returned values client-side based on user specs
      let finalResult: EstimateResult = data.data;
      if (useManualSpecs) {
        const manualLoa = parseFloat(loaM) || 9.0;
        const manualDisp = parseFloat(displacementKg) || 3000;
        const manualSa = parseFloat(sailAreaSqm) || 40.0;

        // Custom logic to refine ORC GPH and IRC TCC using manual specs
        const baseGph = Number(phrfRating) + 525;
        const lwl = manualLoa * 0.85;
        const dispTons = manualDisp / 1016.05;
        const dlRatio = lwl > 0 ? (dispTons / Math.pow(0.01 * lwl, 3)) : 200;
        let displacementModifier = 0;
        if (dlRatio < 150) displacementModifier -= 6;
        else if (dlRatio > 250) displacementModifier += 6;
        const finalGph = baseGph + displacementModifier;

        const baseTcc = 650 / (550 + Number(phrfRating));
        const saDispRatio = manualSa / Math.pow(manualDisp / 1025, 2/3);
        let saDispModifier = 0;
        if (saDispRatio > 22) saDispModifier += 0.012;
        else if (saDispRatio < 15) saDispModifier -= 0.012;
        const finalTcc = baseTcc + saDispModifier;

        finalResult = {
          boat: {
            builder_name: "Custom / Manual",
            model_name: selectedBoat ? selectedBoat.model_name : "Boat Specs"
          },
          phrf_rating: Number(phrfRating),
          orc: {
            gphMin: Math.round((finalGph - 15) * 10) / 10,
            gphMax: Math.round((finalGph + 15) * 10) / 10,
            explanation: "Calculated client-side using manual displacement-to-length ratio specifications."
          },
          irc: {
            tccMin: Math.round((finalTcc - 0.015) * 1000) / 1000,
            tccMax: Math.round((finalTcc + 0.015) * 1000) / 1000,
            explanation: "Calculated client-side using manual sail-area-to-displacement ratio specifications."
          },
          is_educational: true,
          disclaimer: "These estimates are for educational and planning purposes only and are not official rating certificates."
        };
      }

      setEstimateData(finalResult);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Connection to API failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setReportStatus("loading");
    setReportMessage("");

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
        setReportStatus("success");
        setReportMessage("Subscription active! Your rating estimate report has been compiled and emailed to you.");
        setEmail("");
      } else {
        setReportStatus("error");
        setReportMessage(data.error || "Failed to subscribe.");
      }
    } catch (err) {
      console.error("Subscription failed:", err);
      setReportStatus("error");
      setReportMessage("Failed to connect to the server.");
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
            <Calculator size={14} color="var(--primary)" />
            <span style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}>Handicap Estimator</span>
          </div>

          <h1 style={{ fontSize: "40px", fontFamily: "var(--font-heading)", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
            Cross-System Handicap Estimator
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "700px", margin: "8px 0 0 0", lineHeight: "1.6" }}>
            Convert your local PHRF rating into estimated ORC GPH values and IRC TCC multipliers. Refines estimates utilizing hull specifications.
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
                Input Dimensions
              </h2>
            </div>

            <form onSubmit={handleCalculate} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Option to manual override */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="manualSpecsCheck"
                  checked={useManualSpecs}
                  onChange={(e) => {
                    setUseManualSpecs(e.target.checked);
                    if (e.target.checked) {
                      setSelectedBoat(null);
                      setBoatSearchQuery("");
                    }
                  }}
                  style={{ accentColor: "var(--primary)", cursor: "pointer" }}
                />
                <label htmlFor="manualSpecsCheck" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}>
                  Enter manual dimensions
                </label>
              </div>

              {/* Step 1: Select Boat */}
              {!useManualSpecs ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", position: "relative" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                    Select Boat Registry Model
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Search model (e.g. J 24)"
                      value={boatSearchQuery}
                      onChange={(e) => {
                        setBoatSearchQuery(e.target.value);
                        if (selectedBoat) {
                          setSelectedBoat(null);
                          setEstimateData(null);
                        }
                      }}
                      className="form-input"
                      style={{ paddingLeft: "36px", fontSize: "14px" }}
                      required={!useManualSpecs}
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
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                      LOA (Meters)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 7.32"
                      value={loaM}
                      onChange={(e) => setLoaM(e.target.value)}
                      className="form-input"
                      style={{ fontSize: "13px" }}
                      required={useManualSpecs}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                      Displacement (kg)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1406"
                      value={displacementKg}
                      onChange={(e) => setDisplacementKg(e.target.value)}
                      className="form-input"
                      style={{ fontSize: "13px" }}
                      required={useManualSpecs}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                      Sail Area (sq meters)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 24.3"
                      value={sailAreaSqm}
                      onChange={(e) => setSailAreaSqm(e.target.value)}
                      className="form-input"
                      style={{ fontSize: "13px" }}
                      required={useManualSpecs}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Enter PHRF Rating */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Current PHRF Rating (sec/mile)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={phrfRating}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPhrfRating(val === "" ? "" : Number(val));
                    setEstimateData(null);
                  }}
                  className="form-input"
                  style={{ fontSize: "14px" }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={(phrfRating === "") || (!useManualSpecs && !selectedBoat) || isLoading}
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
                  <span>Estimating...</span>
                ) : (
                  <>
                    <Compass size={16} />
                    <span>Run Estimates</span>
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
            {!estimateData ? (
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
                <Calculator size={64} style={{ color: "var(--text-muted)", strokeWidth: 1.0 }} />
                <h3 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", color: "var(--text-primary)", margin: 0 }}>
                  Estimates Calculator
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "440px", margin: 0, lineHeight: "1.6" }}>
                  Select a boat profile, input your current fleet PHRF rating, and run the calculation engine to project equivalents in ORC GPH and IRC TCC.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                {/* 1. Results Block */}
                <section
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  <h2 style={{ fontSize: "22px", fontFamily: "var(--font-heading)", fontWeight: 800, marginBottom: "24px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldCheck size={24} style={{ color: "var(--success)" }} />
                    Cross-System Estimates: {estimateData.boat.builder_name} {estimateData.boat.model_name}
                  </h2>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
                    {/* ORC Block */}
                    <div
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        padding: "24px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                        ORC Estimate
                      </div>
                      <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "var(--font-heading)", color: "var(--primary)", marginBottom: "8px" }}>
                        {estimateData.orc.gphMin} - {estimateData.orc.gphMax}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "16px" }}>
                        seconds / mile (GPH)
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
                        {estimateData.orc.explanation}
                      </p>
                    </div>

                    {/* IRC Block */}
                    <div
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        padding: "24px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                        IRC Estimate
                      </div>
                      <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "var(--font-heading)", color: "var(--primary)", marginBottom: "8px" }}>
                        {estimateData.irc.tccMin.toFixed(3)} - {estimateData.irc.tccMax.toFixed(3)}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "16px" }}>
                        Time Correction Coefficient (TCC)
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
                        {estimateData.irc.explanation}
                      </p>
                    </div>
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
                    }}
                  >
                    <Info size={18} style={{ color: "var(--primary)", marginTop: "2px", flexShrink: 0 }} />
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                      <strong>Educational Disclaimer:</strong> {estimateData.disclaimer} Always secure a certified measurement report from local ORC or IRC authorities before entering sanctioned regattas.
                    </div>
                  </div>
                </section>

                {/* 2. Download PDF Gated Section */}
                <section
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px",
                    boxShadow: "var(--glass-shadow)",
                    display: "grid",
                    gridTemplateColumns: "1fr 300px",
                    gap: "24px",
                    alignItems: "center",
                  }}
                  className="phrf-newsletter"
                >
                  <div>
                    <h3 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Download style={{ color: "var(--primary)" }} size={20} />
                      Download Detailed Estimator Report
                    </h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                      Unlock a PDF report displaying comparative time-allowance calculations across wind ranges and VPP speed matrices. Gate builds subscribers to Handicap HQ.
                    </p>
                  </div>

                  <div>
                    {reportStatus === "success" ? (
                      <div style={{ color: "var(--success)", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                        <Check size={16} />
                        <span>Report compiled &amp; sent!</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSubscribe} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input
                          type="email"
                          required
                          placeholder="your-email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={reportStatus === "loading"}
                          className="form-input"
                          style={{ padding: "8px 12px", fontSize: "13px" }}
                        />
                        <button
                          type="submit"
                          disabled={reportStatus === "loading" || !email}
                          className="btn btn-primary"
                          style={{ width: "100%", padding: "8px 12px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          <Download size={14} />
                          <span>{reportStatus === "loading" ? "Compiling..." : "Email PDF Report"}</span>
                        </button>
                      </form>
                    )}
                    {reportStatus === "error" && (
                      <div style={{ color: "var(--error)", fontSize: "12px", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertCircle size={12} />
                        <span>{reportMessage}</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {/* Informational Callout */}
        <section style={{ marginTop: "64px", borderTop: "1px solid var(--border-color)", paddingTop: "48px" }}>
          <h2 style={{ fontSize: "24px", fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "20px" }}>
            Rating Systems Overview
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", fontSize: "14px", lineHeight: "1.6", color: "var(--text-secondary)" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                ORC Rating System
              </h3>
              <p>
                The Offshore Racing Congress (ORC) uses a Velocity Prediction Program (VPP) based on physical aerodynamic and hydrodynamic measurements to calculate the theoretical speed of a yacht across different wind velocities and angles. It does not use observed performance adjustments, making it a purely scientific measurement rating.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                IRC Rating System
              </h3>
              <p>
                Administered by the RORC, the IRC system is a secret, proprietary rating formula that calculates a single-number Time Correction Coefficient (TCC). Because the formula is undisclosed, designers cannot easily "optimize" boat profiles to cheat the rule, preserving balanced racing characteristics.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
