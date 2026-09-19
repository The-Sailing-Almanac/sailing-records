import React from "react";
import Link from "next/link";
import { ChevronLeft, Rss, ExternalLink } from "lucide-react";
import Symbol from "../../components/Symbol";
import { Metadata } from "next";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

async function getEntityDetails(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/api/entities/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[Entity Details] Failed to fetch slug ${slug}:`, err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEntityDetails(slug);
  if (!data || !data.data.entity) {
    return {
      title: "Entity Not Found | Sail Southern",
    };
  }
  return {
    title: `${data.data.entity.canonical_name} | Sail Southern`,
    description: data.data.entity.description || `Recent articles and records matching ${data.data.entity.canonical_name} in Sail Southern.`,
  };
}

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getEntityDetails(slug);

  if (!data || !data.data.entity) {
    return (
      <div className="container" style={{ padding: "80px 0", textAlign: "center" }}>
        <h2 style={{ fontSize: "28px", marginBottom: "16px" }}>Entity Not Found</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>
          The entity you are looking for does not exist in our graph.
        </p>
        <Link href="/entities" className="btn btn-primary">
          Browse All Entities
        </Link>
      </div>
    );
  }

  const { entity, articles } = data.data;
  const rssUrl = `${API_BASE}/api/entities/${entity.slug}/feed.rss`;

  return (
    <div className="container" style={{ padding: "40px 0 80px 0" }}>
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link
          href="/entities"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--primary)",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          <ChevronLeft style={{ width: "16px", height: "16px" }} />
          <span>All Entities</span>
        </Link>

        <a
          href={rssUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            fontSize: "13px",
          }}
        >
          <Rss style={{ width: "14px", height: "14px", color: "var(--accent)" }} />
          <span>RSS Feed</span>
        </a>
      </div>

      <main style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
        {/* Entity Hero Card */}
        <section
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "48px",
            boxShadow: "var(--glass-shadow)",
            display: "flex",
            gap: "32px",
            flexWrap: "wrap",
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative glowing gradient based on dominant color */}
          <div
            style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "200px",
              height: "200px",
              borderRadius: "50%",
              background: entity.dominant_color || "var(--primary)",
              filter: "blur(80px)",
              opacity: 0.15,
              zIndex: 1,
            }}
          />

          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "var(--radius-md)",
              background: `${entity.dominant_color || "var(--primary)"}1a`, // 10% opacity
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${entity.dominant_color || "var(--primary)"}4d`, // 30% opacity
              zIndex: 2,
            }}
          >
            <Symbol name={getSymbolNameForType(entity.entity_type)} size={48} color={entity.dominant_color || "var(--primary)"} />
          </div>

          <div style={{ flex: "1 1 400px", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <span
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  borderRadius: "100px",
                  background: "var(--primary-glow)",
                  color: "var(--primary)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {entity.entity_type_label || entity.entity_type}
              </span>
              {entity.is_verified && (
                <span
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    borderRadius: "100px",
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "var(--success)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                  }}
                >
                  Verified
                </span>
              )}
            </div>
            <h1 style={{ fontSize: "36px", fontFamily: "var(--font-heading)", fontWeight: 800, marginBottom: "12px", color: "var(--text-primary)" }}>
              {entity.canonical_name}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px", lineHeight: "1.6", maxWidth: "700px" }}>
              {entity.description || "No description available for this entity. Contribute edits via our submissions page."}
            </p>
          </div>
        </section>

        {/* Mentions & Articles */}
        <section>
          <h2 style={{ fontSize: "24px", fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: "24px", color: "var(--text-primary)" }}>
            Recent Dispatches Mentions ({articles.length})
          </h2>

          {articles.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
              {articles.map((item: any) => (
                <div
                  key={item.id}
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    padding: "24px",
                    boxShadow: "var(--glass-shadow)",
                    display: "grid",
                    gridTemplateColumns: item.og_image_url ? "repeat(auto-fit, minmax(200px, 1fr))" : "1fr",
                    gap: "24px",
                    alignItems: "center",
                  }}
                >
                  {item.og_image_url && (
                    <div style={{ position: "relative", width: "100%", height: "140px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                      <img src={item.og_image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
                      <a
                        href={item.sendit_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--text-primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        className="hover-link"
                      >
                        <span>{item.title}</span>
                        <ExternalLink style={{ width: "14px", height: "14px", color: "var(--text-muted)", flexShrink: 0 }} />
                      </a>
                    </h3>
                    {item.content_snippet && (
                      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "16px", lineHeight: "1.5" }}>
                        {item.content_snippet.slice(0, 160)}...
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                      {item.publisher_name && <span>{item.publisher_name}</span>}
                      {item.published_at && (
                        <>
                          <span>•</span>
                          <span>{new Date(item.published_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-color)", color: "var(--text-muted)" }}>
              No recent dispatches have mentioned this entity yet.
            </div>
          )}
        </section>
      </main>

      <style>{`
        .hover-link:hover {
          color: var(--primary) !important;
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
