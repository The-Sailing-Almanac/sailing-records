import Link from "next/link";
import { getSortedPostsMetadata } from "@/lib/posts";
import { Calendar, ArrowRight, BookOpen, Tag } from "lucide-react";

export const metadata = {
  title: "Blog & Coastal Dispatches — Sail Southern",
  description: "Read the latest sailing logs, yacht racing summaries, and weather forecasts from Sail Southern.",
};

export default function BlogList() {
  const posts = getSortedPostsMetadata();

  return (
    <div className="animate-fade-in" style={{ padding: "80px 0" }}>
      <div className="container">
        
        {/* Page Header */}
        <header style={{ marginBottom: "64px", borderBottom: "1px solid var(--border-color)", paddingBottom: "32px" }}>
          <div style={{ display: "inline-flex", padding: "6px 12px", borderRadius: "100px", background: "var(--primary-glow)", color: "var(--primary)", fontSize: "13px", fontWeight: 600, gap: "6px", alignItems: "center", marginBottom: "16px" }}>
            <BookOpen style={{ width: "14px", height: "14px" }} />
            <span>Coastal Logs</span>
          </div>
          <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>The Southern Dispatches</h1>
          <p style={{ fontSize: "18px", color: "var(--text-secondary)", maxWidth: "600px" }}>
            Racing analysis, weather dispatches, local news, and thoughts on sailing in southern waters.
          </p>
        </header>

        {/* Post Grid / List */}
        {posts.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "40px", maxWidth: "800px" }}>
            {posts.map((post) => (
              <article 
                key={post.slug} 
                className="glow-card" 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr", 
                  gap: "20px", 
                  alignItems: "start",
                  padding: "32px"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar style={{ width: "14px", height: "14px" }} />
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                    <span>&bull;</span>
                    <span>{post.readingTime}</span>
                  </div>
                  
                  <h2 style={{ fontSize: "28px", marginBottom: "16px" }}>
                    <Link href={`/blog/${post.slug}`} className="hover-link" style={{ color: "var(--text-primary)" }}>
                      {post.title}
                    </Link>
                  </h2>
                  
                  <p style={{ color: "var(--text-secondary)", fontSize: "16px", marginBottom: "20px", lineHeight: "1.6" }}>
                    {post.excerpt}
                  </p>
                  
                  {post.tags && post.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
                      {post.tags.map((tag) => (
                        <span 
                          key={tag} 
                          style={{ 
                            display: "inline-flex", 
                            alignItems: "center", 
                            gap: "4px", 
                            fontSize: "12px", 
                            padding: "4px 8px", 
                            background: "var(--bg-primary)", 
                            border: "1px solid var(--border-color)", 
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-secondary)"
                          }}
                        >
                          <Tag style={{ width: "10px", height: "10px" }} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div>
                    <Link href={`/blog/${post.slug}`} className="btn btn-secondary" style={{ padding: "10px 20px", fontSize: "14px" }}>
                      <span>Read Full Dispatch</span>
                      <ArrowRight style={{ width: "14px", height: "14px" }} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "64px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-color)", color: "var(--text-secondary)" }}>
            No dispatches posted yet. Check back soon!
          </div>
        )}
      </div>
    </div>
  );
}
