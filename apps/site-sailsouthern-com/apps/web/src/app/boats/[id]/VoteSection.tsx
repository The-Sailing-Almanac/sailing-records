"use client";

import React, { useState } from "react";
import { ThumbsUp, Flag, Check, Loader2, AlertCircle, HelpCircle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SpecDetail {
  value: any;
  confidence: number;
  num_sources: number;
  num_thumbs_up: number;
  num_flags: number;
  debug_info: any;
}

interface VoteSectionProps {
  boatId: number;
  initialSpecs: Record<string, SpecDetail>;
}

// Map database fields to human-friendly names, formatting, and units
const FIELD_META: Record<string, { label: string; unit: string; format: (val: any) => string }> = {
  loa_m: {
    label: "Length Overall (LOA)",
    unit: " m",
    format: (val) => typeof val === "number" ? val.toFixed(2) : String(val),
  },
  beam_m: {
    label: "Beam",
    unit: " m",
    format: (val) => typeof val === "number" ? val.toFixed(2) : String(val),
  },
  draft_m: {
    label: "Draft",
    unit: " m",
    format: (val) => typeof val === "number" ? val.toFixed(2) : String(val),
  },
  displacement_kg: {
    label: "Displacement",
    unit: " kg",
    format: (val) => typeof val === "number" ? val.toLocaleString() : String(val),
  },
  sail_area_sqm: {
    label: "Sail Area",
    unit: " m²",
    format: (val) => typeof val === "number" ? val.toFixed(1) : String(val),
  },
  engine_type: {
    label: "Engine Type",
    unit: "",
    format: (val) => String(val),
  },
  keel_type: {
    label: "Keel Type",
    unit: "",
    format: (val) => String(val),
  },
};

export default function VoteSection({ boatId, initialSpecs }: VoteSectionProps) {
  const [specs, setSpecs] = useState<Record<string, SpecDetail>>(initialSpecs);
  
  // Track votes in this session: record field_name -> 'up' | 'flag'
  const [votedFields, setVotedFields] = useState<Record<string, "up" | "flag">>({});
  // Track loading state for each field being voted on
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  // Track errors per field
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Track comment input visibility and value for flagging
  const [activeFlagField, setActiveFlagField] = useState<string | null>(null);
  const [flagComment, setFlagComment] = useState("");

  const handleVote = async (fieldName: string, voteType: "up" | "flag", comment?: string) => {
    if (votedFields[fieldName] || loadingFields[fieldName]) return;

    setLoadingFields(prev => ({ ...prev, [fieldName]: true }));
    setErrors(prev => ({ ...prev, [fieldName]: "" }));

    try {
      const res = await fetch(`${API_BASE}/api/boats/${boatId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: fieldName,
          vote: voteType,
          comment: comment || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to submit vote");
      }

      // Success! Update local spec state and session voted state
      setSpecs(prev => {
        const updated = { ...prev[fieldName] };
        if (voteType === "up") {
          updated.num_thumbs_up += 1;
        } else {
          updated.num_flags += 1;
        }
        return { ...prev, [fieldName]: updated };
      });
      setVotedFields(prev => ({ ...prev, [fieldName]: voteType }));
      
      // Close comment input if it was open
      if (fieldName === activeFlagField) {
        setActiveFlagField(null);
        setFlagComment("");
      }
    } catch (err: any) {
      console.error("[Vote error]:", err);
      setErrors(prev => ({ ...prev, [fieldName]: err.message || "Failed to connect to API" }));
    } finally {
      setLoadingFields(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  // Helper to determine progress bar color based on confidence rating
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "var(--success)"; // Green
    if (confidence >= 0.5) return "var(--accent)";  // Orange/Gold
    return "var(--error)";                           // Red
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {Object.entries(FIELD_META).map(([fieldName, meta]) => {
        const spec = specs[fieldName];
        if (!spec || spec.value === null || spec.value === undefined) {
          return null; // Skip fields with no value
        }

        const isVoted = votedFields[fieldName];
        const isLoading = loadingFields[fieldName];
        const isFlagOpen = activeFlagField === fieldName;
        const confidencePercent = Math.round(spec.confidence * 100);

        return (
          <div
            key={fieldName}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              boxShadow: "var(--glass-shadow)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              transition: "var(--transition-normal)",
            }}
          >
            {/* Top row: Label, value, unit */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "4px",
                  }}
                >
                  {meta.label}
                </span>
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {meta.format(spec.value)}
                  <span style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-secondary)" }}>
                    {meta.unit}
                  </span>
                </span>
              </div>

              {/* Vote controls */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {/* Thumbs up */}
                <button
                  onClick={() => handleVote(fieldName, "up")}
                  disabled={!!isVoted || isLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: isVoted === "up" ? "var(--success)" : "var(--bg-primary)",
                    color: isVoted === "up" ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${isVoted === "up" ? "var(--success)" : "var(--border-color)"}`,
                    cursor: isVoted || isLoading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "var(--transition-fast)",
                  }}
                  title="Upvote specification accuracy"
                >
                  {isLoading && !isFlagOpen ? (
                    <Loader2 size={14} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                  ) : isVoted === "up" ? (
                    <Check size={14} />
                  ) : (
                    <ThumbsUp size={14} />
                  )}
                  <span>{spec.num_thumbs_up}</span>
                </button>

                {/* Flag */}
                <button
                  onClick={() => {
                    if (isVoted || isLoading) return;
                    if (isFlagOpen) {
                      setActiveFlagField(null);
                    } else {
                      setActiveFlagField(fieldName);
                    }
                  }}
                  disabled={!!isVoted || isLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: isVoted === "flag" ? "var(--error)" : "var(--bg-primary)",
                    color: isVoted === "flag" ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${isVoted === "flag" ? "var(--error)" : "var(--border-color)"}`,
                    cursor: isVoted || isLoading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "var(--transition-fast)",
                  }}
                  title="Flag this specification as incorrect"
                >
                  <Flag size={14} />
                  <span>{spec.num_flags}</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errors[fieldName] && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--error)", fontSize: "12px" }}>
                <AlertCircle size={14} />
                <span>{errors[fieldName]}</span>
              </div>
            )}

            {/* Flag Comment Input Form */}
            {isFlagOpen && (
              <div
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Reason for Flagging (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. LOA is 10.20m, not 10.50m. Found in builder catalog."
                  value={flagComment}
                  onChange={(e) => setFlagComment(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "13px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setActiveFlagField(null);
                      setFlagComment("");
                    }}
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "var(--radius-sm)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleVote(fieldName, "flag", flagComment)}
                    className="btn btn-primary"
                    style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "var(--radius-sm)" }}
                  >
                    Confirm Flag
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Row: Confidence meter and source details */}
            <div
              style={{
                borderTop: "1px solid var(--border-color)",
                paddingTop: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                fontSize: "13px",
              }}
            >
              {/* Confidence Rating */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 auto" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                  Confidence: <strong>{confidencePercent}%</strong>
                </span>
                <div
                  style={{
                    height: "6px",
                    width: "120px",
                    borderRadius: "100px",
                    background: "var(--border-color)",
                    overflow: "hidden",
                    display: "inline-block",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${confidencePercent}%`,
                      background: getConfidenceColor(spec.confidence),
                      borderRadius: "100px",
                      transition: "width 0.4s ease-out",
                    }}
                  />
                </div>
              </div>

              {/* Source count & audit */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)" }}>
                <span>
                  Validated by <strong>{spec.num_sources}</strong> {spec.num_sources === 1 ? "source" : "sources"}
                </span>

                {spec.debug_info?.yachtworld_consensus && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "var(--bg-primary)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--accent)",
                      border: "1px solid var(--border-color)",
                    }}
                    title="YachtWorld sources agree within 2% margin of error"
                  >
                    YW Consensus
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
