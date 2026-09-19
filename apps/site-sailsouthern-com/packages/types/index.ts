export interface ArticleLink {
  id: string; // UUID
  url_hash: string;
  canonical_url: string;
  title: string;
  dek?: string | null;
  author?: string | null;
  publisher_name?: string | null;
  published_at?: string | Date | null;
  discovered_at?: string | Date | null;
  language?: string | null;
  region_guess?: string | null;
  body_of_water?: string | null;
  relevance_score?: number | null;
  negative_flags?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  user_flags?: Record<string, any> | null;
  archive_status?: string | null;
  moderation_state?: string | null;
  extracted_text?: string | null;
  dq_score?: number | null;
  dq_missing_fields?: string[] | null;
  dq_checked_at?: string | Date | null;
  og_image_url?: string | null;
  og_image_scraped_at?: string | Date | null;
  is_suppressed?: boolean;
  is_archived?: boolean;
  is_flagged?: boolean;
  redirect_hash?: string | null;
  event_date?: string | Date | null;
  popularity_score?: number | null;
  click_count?: number | null;
  reaction_up_count?: number | null;
  reaction_down_count?: number | null;
}

export interface FeedEndpoint {
  id: string; // UUID
  source_id?: string | null;
  url: string;
  format?: string | null;
  last_polled_at?: string | Date | null;
  is_active: boolean;
  created_at?: string | Date | null;
  http_status?: number | null;
  last_checked_at?: string | Date | null;
  validation_error?: string | null;
  wayback_url?: string | null;
}

export interface EntityType {
  id: number;
  slug: string;
  label: string;
  description?: string | null;
}

export interface Entity {
  id: number;
  entity_type_id: number;
  entity_type?: string | null;
  slug: string;
  canonical_name: string;
  aliases?: string[] | null;
  description?: string | null;
  dominant_color?: string | null;
  metadata?: Record<string, any> | null;
  is_verified?: boolean;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

export interface EntityMention {
  id: number;
  article_id: string; // UUID
  entity_id: number;
  confidence?: number | null;
  mention_text?: string | null;
  created_at?: string | Date | null;
}

export interface NewsletterEdition {
  id: number;
  edition_date: string | Date;
  edition_type?: 'daily' | 'weekly' | string | null;
  edition_label?: string | null;
  status?: 'draft' | 'published' | 'archived' | string | null;
  trend_threshold?: number | null;
  compiled_at?: string | Date | null;
  published_at?: string | Date | null;
  archived_at?: string | Date | null;
  created_at?: string | Date | null;
}

export interface NewsletterSlot {
  id: number;
  edition_id: number;
  article_id: string; // UUID
  section: string;
  section_display_name?: string | null;
  slot_position: number;
  injection_type?: string | null;
  injected_at?: string | Date | null;
  is_active?: boolean;
  bumped_to_section?: string | null;
  bumped_at?: string | Date | null;
}

export interface RedirectClick {
  id: number;
  redirect_link_id: number;
  clicked_at: string | Date;
  ip_hash: string;
  user_agent?: string | null;
  referer?: string | null;
}

export interface RedirectLink {
  id: number;
  url_hash: string;
  original_url: string;
  created_at: string | Date;
}

export interface Submission {
  id: number;
  submission_type: string;
  entity_name_or_url?: string | null;
  description?: string | null;
  contact_email?: string | null;
  suggested_tags?: string[] | null;
  status?: 'pending' | 'approved' | 'rejected' | string | null;
  reviewer_notes?: string | null;
  created_at?: string | Date | null;
  reviewed_at?: string | Date | null;
}

export interface SupporterTier {
  id: number;
  name: string;
  display_name: string;
  price_usd?: number | null;
  billing_type?: 'one_time' | 'monthly' | 'annual' | 'pwyw' | string | null;
  is_active?: boolean;
  features?: any[] | Record<string, any> | null;
}

export interface Supporter {
  id: number;
  email: string;
  display_name?: string | null;
  social_handle?: string | null;
  social_platform?: string | null;
  is_anonymous?: boolean;
  tier_id?: number | null;
  stripe_customer_id?: string | null;
  stripe_payment_id?: string | null;
  is_active?: boolean;
  physical_gift_sent?: boolean;
  physical_gift_address?: Record<string, any> | null;
  joined_at?: string | Date | null;
  notes?: string | null;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  } | string;
  code?: string;
  statusCode?: number;
}

export type ApiSuccessResponse<T> = {
  data: T;
  statusCode: number;
};
