import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Symbol from "../components/Symbol";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

async function getEntities() {
  try {
    const res = await fetch(`${API_BASE}/api/entities?limit=200`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data.entities || [];
  } catch (err) {
    console.error("[Entities Page] Failed to fetch entities:", err);
    return [];
  }
}

export const metadata = {
  title: "Entity Graph Index | Sail Southern",
  description: "Browse the sailing entity graph including yacht clubs, boat classes, regattas, and bodies of water.",
};

export default async function EntitiesIndexPage() {
  const entities = await getEntities();

  // Group entities by type
  const groups: Record<string, { typeLabel: string; items: any[] }> = {};
  for (const entity of entities) {
    const key = entity.entity_type;
    if (!groups[key]) {
      groups[key] = {
        typeLabel: entity.entity_type_label || key,
        items: [],
      };
    }
    groups[key].items.push(entity);
  }

  return (
    <div className="container" style={{ padding: "40px 0 80px 0" }}>
      <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "24px", marginBottom: "48px" }}>
        <h1 style={{ fontSize: "40px", fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "12px" }}>
          Sailing Knowledge Graph
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "600px" }}>
          Browse our open archive of verified boat classes, yacht clubs, regattas, and local sailing hubs.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
        {Object.entries(groups).map(([typeKey, group]) => (
          <section key={typeKey}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--primary-glow)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                }}
              >
                <Symbol name={getSymbolNameForType(typeKey)} size={20} />
              </div>
              <h2
                style={{
                  fontSize: "22px",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  color: "var(--text-primary)",
                }}
              >
                {group.typeLabel} ({group.items.length})
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
              {group.items.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/entities/${entity.slug}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px 20px",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                    boxShadow: "var(--glass-shadow)",
                  }}
                  className="entity-link-card"
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "15px",
                        color: "var(--text-primary)",
                        marginBottom: "4px",
                      }}
                      className="entity-name"
                    >
                      {entity.canonical_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {entity.mention_count} {entity.mention_count === 1 ? "mention" : "mentions"}
                    </div>
                  </div>
                  <ChevronRight style={{ width: "16px", height: "16px", color: "var(--text-muted)" }} className="chevron" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <style>{`
        .entity-link-card:hover {
          border-color: var(--primary) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.05) !important;
        }
        .entity-link-card:hover .entity-name {
          color: var(--primary) !important;
        }
        .entity-link-card:hover .chevron {
          color: var(--primary) !important;
          transform: translateX(2px);
        }
        .chevron {
          transition: all 0.2s ease;
        }
      `}</style>
    </div>
  );
}

// Map database type to symbol names available in getSymbol
function getSymbolNameForType(type: string): any {
  const entityMap: Record<string, string> = {
    boat_class:    "oneDesign",
    yacht_club:    "burgee",
    regatta:       "regattaTrophy",
    sailor:        "helm",
    body_of_water: "waveField",
    manufacturer:  "keelSection",
    region:        "mapPinWake",
    rating_system: "chartContour",
    sail_maker:    "sailPanel",
    sail_loft:     "sailPanel",
  };
  return entityMap[type] || "waveField";
}
