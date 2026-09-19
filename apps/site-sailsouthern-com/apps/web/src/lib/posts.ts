import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'src/content/posts');

export interface PostMetadata {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  author: string;
  readingTime: string;
  tags?: string[];
  coverImage?: string;
}

export interface PostData extends PostMetadata {
  contentHtml: string;
}

// Calculate reading time based on standard reading speed (200 words/min)
function calculateReadingTime(content: string): string {
  const wordsPerMinute = 200;
  const numberOfWords = content.split(/\s+/g).length;
  const minutes = Math.ceil(numberOfWords / wordsPerMinute);
  return `${minutes} min read`;
}

// Get all posts metadata sorted by date (descending)
export function getSortedPostsMetadata(): PostMetadata[] {
  // Ensure the directory exists
  if (!fs.existsSync(postsDirectory)) {
    fs.mkdirSync(postsDirectory, { recursive: true });
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data, content } = matter(fileContents);
      
      const readingTime = calculateReadingTime(content);

      return {
        slug,
        title: data.title || 'Untitled',
        date: data.date || '2026-01-01',
        excerpt: data.excerpt || '',
        author: data.author || 'Sail Southern Editorial',
        readingTime,
        tags: data.tags || [],
        coverImage: data.coverImage || '',
      };
    });

  // Sort posts by date
  return allPostsData.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Get all post slugs for next.js generateStaticParams
export function getAllPostSlugs() {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }
  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      return {
        slug: fileName.replace(/\.md$/, ''),
      };
    });
}

// Get complete data for a single post by slug
export async function getPostData(slug: string): Promise<PostData | null> {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  
  const readingTime = calculateReadingTime(content);

  const { marked } = await import('marked');
  const { default: DOMPurify } = await import('isomorphic-dompurify');
  const contentHtml = DOMPurify.sanitize(await marked.parse(content));

  return {
    slug,
    contentHtml,
    title: data.title || 'Untitled',
    date: data.date || '2026-01-01',
    excerpt: data.excerpt || '',
    author: data.author || 'Sail Southern Editorial',
    readingTime,
    tags: data.tags || [],
    coverImage: data.coverImage || '',
  };
}
