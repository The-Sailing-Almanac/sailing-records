import { z } from "zod";

export const subscribeSchema = z.object({
  email: z.string().email("Valid email required"),
  frequency: z.array(z.string()).optional(),
});

export const submissionSchema = z.object({
  submission_type: z.string().min(1, "submission_type is required"),
  entity_name_or_url: z.string().min(1, "entity_name_or_url is required"),
  description: z.string().max(600, "Description cannot exceed 600 characters").optional().nullable(),
  contact_email: z.string().email("Valid contact email required").optional().or(z.literal("")).nullable(),
  suggested_tags: z.array(z.string()).optional(),
});

export const reactParamsSchema = z.object({
  id: z.string().uuid("Invalid article ID format"),
});

export const reactBodySchema = z.object({
  reaction: z.enum(["up", "down"] as const, {
    message: "reaction must be 'up' or 'down'",
  }),
});

export const senditParamsSchema = z.object({
  hash: z.string().regex(/^[a-zA-Z0-9]+$/, "Invalid redirect hash"),
});

export const senditQuerySchema = z.object({
  src: z.string().optional(),
  sid: z.string().optional(),
  utm_medium: z.string().optional(),
});

export const boatVoteSchema = z.object({
  field_name: z.string().min(1, "field_name is required"),
  vote: z.enum(["up", "flag"] as const, {
    message: "vote must be 'up' or 'flag'",
  }),
  comment: z.string().max(500, "Comment cannot exceed 500 characters").optional().nullable(),
});

export const phrfCompareSchema = z.object({
  boat_id: z.number().int("boat_id must be an integer"),
  regions: z.array(z.string().min(1)).min(1, "At least one region slug is required"),
  distance_nm: z.number().positive("distance_nm must be positive"),
});

export const handicapEstimateSchema = z.object({
  boat_id: z.number().int("boat_id must be an integer"),
  phrf_rating: z.number().int("phrf_rating must be an integer"),
  region_slug: z.string().optional().nullable(),
});

export const fleetIntelSchema = z.object({
  boat_identifiers: z.array(z.string().min(1)).min(1, "At least one boat identifier is required"),
  wind_band: z.enum(["light", "medium", "heavy"] as const).optional().default("medium"),
});

export const userSubmissionSchema = z.object({
  submission_type: z.enum(["photo", "story", "rig_correction", "owner_group"] as const),
  boat_id: z.number().int("boat_id must be an integer").optional().nullable(),
  submitter_email: z.string().email("Valid email required"),
  content_payload: z.record(z.string(), z.any()),
  rights_grant: z.string().min(1, "Licensing rights grant required"),
});

export const createTribeSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]+$/, "Slug must be alphanumeric/underscores"),
  name: z.string().min(1, "Name is required"),
  entity_ids: z.array(z.number().int()),
  admin_email: z.string().email("Valid admin email required").optional().nullable(),
});

export const createBulletinSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body_md: z.string().min(1, "Body content is required"),
  is_pinned: z.boolean().optional().default(false),
  author_email: z.string().email("Valid author email required").optional().nullable(),
});

export const createReplySchema = z.object({
  author_actor_uri: z.string().url("Valid author actor URI required"),
  author_name: z.string().min(1, "Author name is required"),
  content: z.string().min(1, "Content is required"),
});



