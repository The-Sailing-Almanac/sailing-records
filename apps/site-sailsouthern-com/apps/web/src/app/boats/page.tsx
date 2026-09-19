import React from "react";
import Link from "next/link";
import { ChevronRight, Search, Anchor, Filter, Compass } from "lucide-react";
import Symbol from "../components/Symbol";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

interface PageProps {
  searchParams: Promise<{
    builder?: string;
    model?: string;
    rig_type?: string;
    year_range?: string;
    page?: string;
  }>;
}

export const metadata = {
  title: "Sailboat Specifications Almanac | Sail Southern",
  description: "Browse and search consensus-driven rig, hull, and engine specifications for sailboats and classes.",
};

async function getBoats(params: {
  builder?: string;
  model?: string;
  rig_type?: string;
  year_range?: string;
  page?: string;
}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.builder) queryParams.set("builder", params.builder);
    if (params.model) queryParams.set("model", params.model);
    if (params.rig_type) queryParams.set("rig_type", params.rig_type);
    if (params.year_range) queryParams.set("year_range", params.year_range);
    
    // Default page is 1
    const currentPage = parseInt(params.page || "1", 10);
    queryParams.set("page", currentPage.toString());
    queryParams.set("limit", "18"); // 18 items per page fits 3-column grid nicely

    const res = await fetch(`${API_BASE}/api/boats?${queryParams.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }

    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error("[Boats Page] Failed to fetch boats:", err);
    return { boats: [], page: 1, limit: 18, total: 0 };
  }
}

export default async function BoatsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const builder = resolvedSearchParams.builder || "";
  const model = resolvedSearchParams.model || "";
  const rig_type = resolvedSearchParams.rig_type || "";
  const year_range = resolvedSearchParams.year_range || "";
  const page = resolvedSearchParams.page || "1";

  const { boats, total, limit } = await getBoats({
    builder,
    model,
    rig_type,
    year_range,
    page,
  });

  const currentPage = parseInt(page, 10);
  const totalPages = Math.ceil(total / limit);

  // Helper to build URL with preserved search filters but updated page
  const getPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    if (builder) params.set("builder", builder);
    if (model) params.set("model", model);
    if (rig_type) params.set("rig_type", rig_type);
    if (year_range) params.set("year_range", year_range);
    params.set("page", targetPage.toString());
    return `/boats?${params.toString()}`;
  };

  return (
    <div style={{ paddingBottom: "80px", paddingTop: "40px" }}>
      <div className="container">
        {/* Header Section */}
        <div
          style={{
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "24px",
            marginBottom: "40px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
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
            }}
          >
            <Symbol name="booksAlmanac" size={14} color="var(--primary)" />
            <span style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Rig &amp; Spec Consensus Database
            </span>
          </div>

          <h1
            style={{
              fontSize: "40px",
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Sailboat Almanac Index
          </h1>
          
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "16px",
              maxWidth: "700px",
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            Verify rig measurements, hull shapes, engine data, and handicap formulas. Our database combines multiple canonical sources with community-driven validation.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: "32px",
            alignItems: "start",
          }}
          className="boats-layout"
        >
          {/* Filters Sidebar */}
          <aside
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "24px",
              position: "sticky",
              top: "96px",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <Filter size={18} style={{ color: "var(--primary)" }} />
              <h2 style={{ fontSize: "16px", fontFamily: "var(--font-heading)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                Filter Database
              </h2>
            </div>

            <form method="GET" action="/boats" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>
                  Builder
                </label>
                <input
                  type="text"
                  name="builder"
                  defaultValue={builder}
                  placeholder="e.g. Catalina, Beneteau"
                  className="form-input"
                  style={{ padding: "10px 12px", fontSize: "14px" }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>
                  Model
                </label>
                <input
                  type="text"
                  name="model"
                  defaultValue={model}
                  placeholder="e.g. 30, Oceanis 350"
                  className="form-input"
                  style={{ padding: "10px 12px", fontSize: "14px" }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>
                  Rig Type
                </label>
                <input
                  type="text"
                  name="rig_type"
                  defaultValue={rig_type}
                  placeholder="e.g. Sloop, Ketch"
                  className="form-input"
                  style={{ padding: "10px 12px", fontSize: "14px" }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>
                  Production Year Range
                </label>
                <select
                  name="year_range"
                  defaultValue={year_range}
                  className="form-input"
                  style={{ padding: "10px 12px", fontSize: "14px", height: "40px", cursor: "pointer" }}
                >
                  <option value="">All Production Years</option>
                  <option value="1900-1969">Pre-1970</option>
                  <option value="1970-1979">1970s</option>
                  <option value="1980-1989">1980s</option>
                  <option value="1990-1999">1990s</option>
                  <option value="2000-2009">2000s</option>
                  <option value="2010-2019">2010s</option>
                  <option value="2020-2029">2020s</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", padding: "10px 16px", fontSize: "14px", marginTop: "8px" }}
              >
                <Search size={16} />
                Search Specs
              </button>

              {(builder || model || rig_type || year_range) && (
                <Link
                  href="/boats"
                  className="btn btn-secondary"
                  style={{ width: "100%", padding: "10px 16px", fontSize: "14px", textAlign: "center", textDecoration: "none" }}
                >
                  Clear Filters
                </Link>
              )}
            </form>
          </aside>

          {/* Results Area */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                color: "var(--text-secondary)",
                fontSize: "14px",
              }}
            >
              <span>
                Found <strong>{total}</strong> sailboat profiles
              </span>
              {totalPages > 1 && (
                <span>
                  Page <strong>{currentPage}</strong> of {totalPages}
                </span>
              )}
            </div>

            {boats.length === 0 ? (
              <div
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "48px 24px",
                  textAlign: "center",
                  boxShadow: "var(--glass-shadow)",
                }}
              >
                <Compass size={48} style={{ color: "var(--text-muted)", marginBottom: "16px", strokeWidth: 1.2 }} />
                <h3 style={{ fontSize: "18px", color: "var(--text-primary)", marginBottom: "8px" }}>
                  No boats match your search
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "400px", margin: "0 auto 20px auto" }}>
                  Try loosening your filter terms or checking spelling. Ensure year ranges are matched properly.
                </p>
                <Link href="/boats" className="btn btn-secondary" style={{ fontSize: "13px", padding: "8px 16px" }}>
                  Reset Filters
                </Link>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "20px",
                    marginBottom: "40px",
                  }}
                >
                  {boats.map((boat: any) => (
                    <Link
                      key={boat.id}
                      href={`/boats/${boat.id}`}
                      className="glow-card"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: "20px",
                        textDecoration: "none",
                        color: "inherit",
                        height: "100%",
                      }}
                    >
                      <div>
                        {/* Builder */}
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "var(--primary)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: "4px",
                          }}
                        >
                          {boat.builder_name}
                        </div>
                        
                        {/* Model */}
                        <h3
                          style={{
                            fontSize: "18px",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: "8px",
                          }}
                        >
                          {boat.model_name}
                          {boat.variant_name && (
                            <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-secondary)", marginLeft: "4px" }}>
                              ({boat.variant_name})
                            </span>
                          )}
                        </h3>

                        {/* Specs grid */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "8px",
                            borderTop: "1px solid var(--border-color)",
                            paddingTop: "12px",
                            marginTop: "12px",
                            fontSize: "13px",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Production</span>
                            <strong>
                              {boat.year_start}
                              {boat.year_end ? ` - ${boat.year_end}` : " +"}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Rig Type</span>
                            <strong>{boat.rig_type || "N/A"}</strong>
                          </div>
                          {boat.loa_m !== null && (
                            <div>
                              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>LOA</span>
                              <strong>{boat.loa_m.toFixed(2)} m</strong>
                            </div>
                          )}
                          {boat.displacement_kg !== null && (
                            <div>
                              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Displacement</span>
                              <strong>{boat.displacement_kg.toLocaleString()} kg</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          color: "var(--primary)",
                          fontSize: "13px",
                          fontWeight: 600,
                          marginTop: "16px",
                          gap: "4px",
                        }}
                      >
                        <span>Specifications</span>
                        <ChevronRight size={14} />
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "12px",
                      borderTop: "1px solid var(--border-color)",
                      paddingTop: "32px",
                    }}
                  >
                    {currentPage > 1 ? (
                      <Link href={getPageUrl(currentPage - 1)} className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "14px" }}>
                        Previous
                      </Link>
                    ) : (
                      <button disabled className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "14px", opacity: 0.5, cursor: "not-allowed" }}>
                        Previous
                      </button>
                    )}

                    <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                      Page {currentPage} of {totalPages}
                    </span>

                    {currentPage < totalPages ? (
                      <Link href={getPageUrl(currentPage + 1)} className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "14px" }}>
                        Next
                      </Link>
                    ) : (
                      <button disabled className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "14px", opacity: 0.5, cursor: "not-allowed" }}>
                        Next
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
