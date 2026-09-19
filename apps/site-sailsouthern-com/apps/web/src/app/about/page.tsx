import React from "react";
import Link from "next/link";
import { Compass, ShieldCheck, Heart } from "lucide-react";
import Symbol from "../components/Symbol";

export const metadata = {
  title: "About Sail Southern | Sailing Almanac",
  description: "Learn about Sail Southern, an open-data directory and automated daily compiler of sailing news.",
};

export default function AboutPage() {
  return (
    <div className="container" style={{ padding: "60px 0 100px 0", maxWidth: "800px" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ display: "inline-flex", padding: "8px", borderRadius: "50%", background: "var(--primary-glow)", color: "var(--primary)", marginBottom: "16px" }}>
          <Symbol name="compassRose" size={40} />
        </div>
        <h1 style={{ fontSize: "42px", fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "12px" }}>
          About Sail Southern
        </h1>
        <p style={{ fontSize: "18px", color: "var(--text-secondary)" }}>
          The open archive and daily news record of the sailing world.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }} className="about-content">
        <section
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "32px",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <p style={{ fontSize: "16px", lineHeight: "1.7", color: "var(--text-secondary)" }}>
            <strong>Sail Southern</strong> is a continuously updated sailing news knowledgebase and almanac covering racing, cruising, and the full world of sail — built to be as open, complete, and machine-readable as possible.
          </p>
          <p style={{ fontSize: "16px", lineHeight: "1.7", color: "var(--text-secondary)" }}>
            Powered by open data and community contributions. Currently covering news from January 2025 forward, with historical backfill in progress.
          </p>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px" }}>
          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <Compass style={{ color: "var(--primary)", width: "32px", height: "32px", marginBottom: "12px", margin: "0 auto" }} />
            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", marginTop: "12px" }}>Open Data First</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              All records are stored transparently. No paywalls, no proprietary database lock-in.
            </p>
          </div>

          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <ShieldCheck style={{ color: "var(--primary)", width: "32px", height: "32px", marginBottom: "12px", margin: "0 auto" }} />
            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", marginTop: "12px" }}>Nautical Integrity</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              We preserve every article we index. Links don't rot here — we archive to the Wayback Machine to ensure the record endures.
            </p>
          </div>

          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <Heart style={{ color: "var(--primary)", width: "32px", height: "32px", marginBottom: "12px", margin: "0 auto" }} />
            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", marginTop: "12px" }}>Community Powered</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              Support us or submit data. All contributions shape the future of our archives.
            </p>
          </div>
        </div>

        {/* CTA: pending copy approval — slot reserved */}
      </div>
    </div>
  );
}
