"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, CheckCircle2, AlertCircle, Loader2, Compass, Anchor, BookOpen, Share2 } from "lucide-react";
import Link from "next/link";

interface BoatResult {
  id: number;
  builder_name: string;
  model_name: string;
}

export default function SubmitPage() {
  const [submissionType, setSubmissionType] = useState<"photo" | "story" | "rig_correction" | "owner_group">("photo");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [rightsGrant, setRightsGrant] = useState("");
  const [agreeChecked, setAgreeChecked] = useState(false);

  // Boat Lookup State
  const [boatSearch, setBoatSearch] = useState("");
  const [selectedBoat, setSelectedBoat] = useState<BoatResult | null>(null);
  const [boatResults, setBoatResults] = useState<BoatResult[]>([]);
  const [isSearchingBoats, setIsSearchingBoats] = useState(false);
  const [showBoatDropdown, setShowBoatDropdown] = useState(false);

  // Dynamic Content Payload States
  // Photo type
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  // Story type
  const [storyTitle, setStoryTitle] = useState("");
  const [storyBody, setStoryBody] = useState("");
  // Rig Correction type
  const [rigField, setRigField] = useState("loa_m");
  const [rigOldValue, setRigOldValue] = useState("");
  const [rigNewValue, setRigNewValue] = useState("");
  const [rigExplanation, setRigExplanation] = useState("");
  // Owner Group type
  const [groupName, setGroupName] = useState("");
  const [groupUrl, setGroupUrl] = useState("");
  const [groupPlatform, setGroupPlatform] = useState("facebook");

  // Form Submission Status
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState("");
  const [submissionId, setSubmissionId] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle outside click for boat autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBoatDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Boat autocomplete lookup
  useEffect(() => {
    if (boatSearch.length < 2 || selectedBoat) {
      setBoatResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchingBoats(true);
      try {
        const response = await fetch(`/api/boats?model=${encodeURIComponent(boatSearch)}&limit=8`);
        if (response.ok) {
          const data = await response.json();
          // Adjust based on typical API envelope. If data.data exists, use it.
          const list = data.data || data.boats || [];
          setBoatResults(list);
          setShowBoatDropdown(true);
        }
      } catch (err) {
        console.error("Boat search error:", err);
      } finally {
        setIsSearchingBoats(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [boatSearch, selectedBoat]);

  const handleSelectBoat = (boat: BoatResult) => {
    setSelectedBoat(boat);
    setBoatSearch(`${boat.builder_name} ${boat.model_name}`);
    setShowBoatDropdown(false);
  };

  const handleClearBoat = () => {
    setSelectedBoat(null);
    setBoatSearch("");
    setBoatResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeChecked || !rightsGrant) {
      setStatus("error");
      setMessage("You must accept the licensing agreement terms to submit.");
      return;
    }

    setStatus("loading");

    // Construct content payload based on type
    let content_payload: Record<string, any> = {};
    if (submissionType === "photo") {
      content_payload = { photo_url: photoUrl, caption: photoCaption };
    } else if (submissionType === "story") {
      content_payload = { title: storyTitle, body: storyBody };
    } else if (submissionType === "rig_correction") {
      content_payload = {
        field: rigField,
        old_value: rigOldValue,
        new_value: rigNewValue,
        explanation: rigExplanation
      };
    } else if (submissionType === "owner_group") {
      content_payload = {
        group_name: groupName,
        group_url: groupUrl,
        platform: groupPlatform
      };
    }

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_type: submissionType,
          boat_id: selectedBoat ? selectedBoat.id : null,
          submitter_email: submitterEmail,
          content_payload,
          rights_grant: rightsGrant,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setSubmissionId(data.id);
        setMessage("Thank you! Your submission has been received and will be reviewed by the editorial team.");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to log your submission.");
      }
    } catch (err) {
      console.error("Submission failed:", err);
      setStatus("error");
      setMessage("Failed to connect to the server. Please verify your connection.");
    }
  };

  return (
    <div className="container" style={{ padding: "60px 0 100px 0", maxWidth: "720px" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          gap: "8px", 
          background: "var(--primary-glow)", 
          padding: "6px 14px", 
          borderRadius: "50px",
          color: "var(--primary)",
          fontSize: "13px",
          fontWeight: 600,
          marginBottom: "16px"
        }}>
          <Compass style={{ width: "14px", height: "14px" }} />
          <span>Curated Ingestion Deck</span>
        </div>
        <h1 style={{ fontSize: "38px", fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "12px", letterSpacing: "-0.03em" }}>
          Submit Dispatch or Spec
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "540px", margin: "0 auto" }}>
          Share your logs, photos, rig corrections, or community links. Contributions honor copyright policies and are eligible for Value-for-Value rewards.
        </p>
      </div>

      <div
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid var(--glass-border)",
          borderRadius: "var(--radius-lg)",
          padding: "44px",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "hsla(142, 70%, 45%, 0.1)",
              borderRadius: "50%",
              width: "72px",
              height: "72px",
              marginBottom: "20px"
            }}>
              <CheckCircle2 style={{ color: "var(--success)", width: "40px", height: "40px" }} />
            </div>
            <h2 style={{ fontSize: "26px", marginBottom: "14px", fontFamily: "var(--font-heading)", fontWeight: 800 }}>Dispatch Ingested</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px", marginBottom: "8px", lineHeight: "1.5" }}>{message}</p>
            <div style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              padding: "10px 16px",
              borderRadius: "var(--radius-sm)",
              display: "inline-block",
              fontSize: "13px",
              fontFamily: "monospace",
              color: "var(--text-muted)",
              marginBottom: "36px"
            }}>
              ID: {submissionId}
            </div>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button
                onClick={() => {
                  setSubmitterEmail("");
                  handleClearBoat();
                  setPhotoUrl("");
                  setPhotoCaption("");
                  setStoryTitle("");
                  setStoryBody("");
                  setGroupName("");
                  setGroupUrl("");
                  setAgreeChecked(false);
                  setStatus("idle");
                }}
                className="btn btn-primary"
                style={{ cursor: "pointer" }}
              >
                Log New Dispatch
              </button>
              <Link href="/" className="btn btn-secondary">
                Return to Deck
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              
              {/* Type Selection */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "10px", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Submission Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                  {[
                    { id: "photo", label: "Photo", icon: Anchor },
                    { id: "story", label: "Story", icon: BookOpen },
                    { id: "rig_correction", label: "Rig Correction", icon: Compass },
                    { id: "owner_group", label: "Owner Group", icon: Share2 }
                  ].map((t) => {
                    const Icon = t.icon;
                    const isActive = submissionType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSubmissionType(t.id as any)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "10px",
                          padding: "16px 12px",
                          background: isActive ? "var(--primary-glow)" : "var(--bg-primary)",
                          border: isActive ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                          borderRadius: "var(--radius-md)",
                          color: isActive ? "var(--primary)" : "var(--text-secondary)",
                          cursor: "pointer",
                          transition: "var(--transition-fast)",
                          fontWeight: isActive ? 600 : 500,
                          fontSize: "14px"
                        }}
                      >
                        <Icon style={{ width: "20px", height: "20px" }} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Boat Auto-complete registry */}
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--text-primary)" }}>
                  Associated Boat Registry (Optional)
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Search by class / model name (e.g. Catalina 30)..."
                    value={boatSearch}
                    onChange={(e) => {
                      setBoatSearch(e.target.value);
                      if (selectedBoat) handleClearBoat();
                    }}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      fontSize: "15px",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      outline: "none",
                      transition: "var(--transition-fast)",
                    }}
                  />
                  {selectedBoat && (
                    <button
                      type="button"
                      onClick={handleClearBoat}
                      className="btn btn-secondary"
                      style={{ padding: "0 16px", fontSize: "13px" }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {isSearchingBoats && (
                  <div style={{ position: "absolute", right: "12px", top: "38px" }}>
                    <Loader2 className="animate-spin" style={{ width: "16px", height: "16px", color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
                  </div>
                )}

                {showBoatDropdown && boatResults.length > 0 && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    marginTop: "4px",
                    zIndex: 10,
                    boxShadow: "var(--glass-shadow)",
                    maxHeight: "220px",
                    overflowY: "auto"
                  }}>
                    {boatResults.map((boat) => (
                      <div
                        key={boat.id}
                        onClick={() => handleSelectBoat(boat)}
                        style={{
                          padding: "10px 16px",
                          cursor: "pointer",
                          borderBottom: "1px solid var(--border-color)",
                          transition: "var(--transition-fast)"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{boat.model_name}</span>
                        <span style={{ marginLeft: "8px", fontSize: "13px", color: "var(--text-muted)" }}>by {boat.builder_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic inputs per type */}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "24px" }}>
                
                {/* 1. Photo Type Fields */}
                {submissionType === "photo" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                        Photo URL
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://example.com/boat-image.jpg"
                        value={photoUrl}
                        onChange={(e) => setPhotoUrl(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                        Caption / Description
                      </label>
                      <textarea
                        required
                        placeholder="Provide details about when/where this photo was taken, sails raised, boat names..."
                        value={photoCaption}
                        onChange={(e) => setPhotoCaption(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontFamily: "inherit",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 2. Story Type Fields */}
                {submissionType === "story" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                        Dispatch Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Galveston Bay Regatta Light Air Sweep"
                        value={storyTitle}
                        onChange={(e) => setStoryTitle(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                        Dispatch Story Content
                      </label>
                      <textarea
                        required
                        placeholder="Write your story or cruise report here (Markdown supported)..."
                        value={storyBody}
                        onChange={(e) => setStoryBody(e.target.value)}
                        rows={6}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontFamily: "inherit",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 3. Rig Correction Type Fields */}
                {submissionType === "rig_correction" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                          Spec Parameter
                        </label>
                        <select
                          value={rigField}
                          onChange={(e) => setRigField(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-primary)",
                            outline: "none"
                          }}
                        >
                          <option value="loa_m">Length Overall (LOA) (m)</option>
                          <option value="lwl_m">Waterline Length (LWL) (m)</option>
                          <option value="beam_m">Beam (m)</option>
                          <option value="draft_m">Draft (m)</option>
                          <option value="displacement_kg">Displacement (kg)</option>
                          <option value="sail_area_m2">Sail Area (sq m)</option>
                          <option value="i_m">Rig I-Dim (m)</option>
                          <option value="j_m">Rig J-Dim (m)</option>
                          <option value="p_m">Rig P-Dim (m)</option>
                          <option value="e_m">Rig E-Dim (m)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                          Current Value
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 9.15"
                          value={rigOldValue}
                          onChange={(e) => setRigOldValue(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-primary)",
                            outline: "none"
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                          Proposed Correct Value
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 9.27"
                          value={rigNewValue}
                          onChange={(e) => setRigNewValue(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-primary)",
                            outline: "none"
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                        Source / Explanation
                      </label>
                      <textarea
                        required
                        placeholder="Provide manufacturer links, manuals, certificates, or evidence justifying this correction..."
                        value={rigExplanation}
                        onChange={(e) => setRigExplanation(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontFamily: "inherit",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 4. Owner Group Type Fields */}
                {submissionType === "owner_group" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                          Group / Fleet Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Catalina 30 Gulf Coast Fleet"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-primary)",
                            outline: "none"
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                          Group Platform
                        </label>
                        <select
                          value={groupPlatform}
                          onChange={(e) => setGroupPlatform(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-primary)",
                            outline: "none"
                          }}
                        >
                          <option value="facebook">Facebook Group / Page</option>
                          <option value="discord">Discord Community</option>
                          <option value="website">Standalone Website</option>
                          <option value="forum">Forum / Mailing List</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                        Community URL
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://facebook.com/groups/catalina30gulf"
                        value={groupUrl}
                        onChange={(e) => setGroupUrl(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Submitter Info */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "24px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--text-primary)" }}>
                    Submitter Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      outline: "none"
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                     Used only for follow-up communications about your submission.
                  </span>
                </div>

                {/* Rights Grant License selection */}
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--text-primary)" }}>
                    Licensing & Rights Grant
                  </label>
                  <select
                    required
                    value={rightsGrant}
                    onChange={(e) => setRightsGrant(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      outline: "none"
                    }}
                  >
                    <option value="">-- Select licensing terms --</option>
                    <option value="cc_by_sa">Creative Commons BY-SA (ShareAlike)</option>
                    <option value="public_domain">CC0 Public Domain Dedication</option>
                    <option value="fair_use_non_commercial">Non-Commercial Fair Use Grant</option>
                    <option value="exclusive_permission">Exclusive Exhibition Permission</option>
                  </select>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    We honor copyrights. All scraped metadata retains original licenses.
                  </span>
                </div>
              </div>

              {/* License and agreement check */}
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <input
                  id="agree-checkbox"
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={(e) => setAgreeChecked(e.target.checked)}
                  style={{ marginTop: "4px", cursor: "pointer" }}
                />
                <label htmlFor="agree-checkbox" style={{ fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer", lineHeight: "1.4" }}>
                  I warrant that I hold the copyrights to this content or possess clear authorization from the author, and hereby grant Sailing Almanac & Sail Southern permission to store, process, and distribute it.
                </label>
              </div>


              {/* Error messages */}
              {status === "error" && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--error)", fontSize: "14px" }}>
                  <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                  <span>{message}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <button
                type="submit"
                disabled={status === "loading" || !agreeChecked || !rightsGrant || !submitterEmail}
                className="btn btn-primary"
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "14px 0",
                  width: "100%",
                  cursor: "pointer"
                }}
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} />
                    <span>Processing Ingestion...</span>
                  </>
                ) : (
                  <>
                    <Send style={{ width: "16px", height: "16px" }} />
                    <span>Submit Dispatch</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
