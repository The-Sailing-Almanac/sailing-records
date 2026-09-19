import { getPostData, getAllPostSlugs } from "@/lib/posts";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User, Clock, ArrowRight } from "lucide-react";
import SubscribeForm from "../../components/SubscribeForm";

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate static parameters for static site generation (SSG)
export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  return slugs.map((item) => ({
    slug: item.slug,
  }));
}

// Generate metadata dynamically for SEO
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPostData(slug);
  
  if (!post) {
    return {
      title: "Post Not Found — Sail Southern",
    };
  }

  return {
    title: `${post.title} — Sail Southern`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostData(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="animate-fade-in" style={{ padding: "80px 0" }}>
      <div className="container" style={{ maxWidth: "800px" }}>
        
        {/* Back Link */}
        <Link 
          href="/blog" 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "8px", 
            color: "var(--text-secondary)", 
            fontSize: "14px", 
            marginBottom: "32px",
            fontWeight: 500
          }} 
          className="hover-link"
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          <span>Back to dispatches</span>
        </Link>

        {/* Article Header */}
        <header style={{ marginBottom: "48px" }}>
          <h1 style={{ fontSize: "44px", lineHeight: "1.15", marginBottom: "24px" }}>
            {post.title}
          </h1>

          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "24px", 
              flexWrap: "wrap",
              padding: "16px 0",
              borderTop: "1px solid var(--border-color)",
              borderBottom: "1px solid var(--border-color)",
              fontSize: "14px",
              color: "var(--text-secondary)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <User style={{ width: "16px", height: "16px", color: "var(--primary)" }} />
              <span>{post.author}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar style={{ width: "16px", height: "16px", color: "var(--primary)" }} />
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock style={{ width: "16px", height: "16px", color: "var(--primary)" }} />
              <span>{post.readingTime}</span>
            </div>
          </div>
        </header>

        {/* Article Markdown/HTML Body */}
        <section 
          className="article-content" 
          dangerouslySetInnerHTML={{ __html: post.contentHtml }} 
          style={{ marginBottom: "80px" }}
        />

        {/* CTA: pending copy approval — slot reserved */}

      </div>
    </article>
  );
}
