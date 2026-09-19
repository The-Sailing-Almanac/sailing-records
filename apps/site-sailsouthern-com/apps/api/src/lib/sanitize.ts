import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes user input HTML/text using DOMPurify to prevent XSS.
 */
export function sanitize(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";
  return DOMPurify.sanitize(input).trim();
}
