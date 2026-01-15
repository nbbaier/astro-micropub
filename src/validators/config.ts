import { z } from "astro/zod";

/**
 * Syndication target schema
 */
export const syndicationTargetSchema = z.object({
  uid: z.string().url(),
  name: z.string(),
});

/**
 * Micropub configuration schema
 */
export const micropubConfigSchema = z.object({
  endpoint: z.string().default("/micropub"),
  mediaEndpoint: z.string().default("/micropub/media"),
  enableUpdates: z.boolean().default(true),
  enableDeletes: z.boolean().default(true),
  syndicationTargets: z.array(syndicationTargetSchema).default([]),
});

/**
 * IndieAuth configuration schema
 */
export const indieAuthConfigSchema = z.object({
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url(),
  tokenVerificationCache: z.number().min(0).max(3600).default(120),
});

/**
 * Discovery configuration schema
 */
export const discoveryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  includeHeaders: z.boolean().default(true),
});

/**
 * Rate limit configuration schema
 */
export const rateLimitConfigSchema = z.object({
  windowMs: z
    .number()
    .positive()
    .default(15 * 60 * 1000), // 15 minutes
  maxRequests: z.number().positive().default(100),
});

/**
 * Security configuration schema
 */
export const securityConfigSchema = z.object({
  requireScope: z.boolean().default(true),
  allowedOrigins: z.array(z.string()).default(["*"]),
  maxUploadSize: z
    .number()
    .positive()
    .default(10 * 1024 * 1024), // 10 MB
  allowedMimeTypes: z.array(z.string()).default([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Note: SVG excluded by default due to XSS risk (can contain JavaScript)
  ]),
  rateLimit: rateLimitConfigSchema.optional(),
  sanitizeHtml: z.function().args(z.string()).returns(z.string()).optional(),
});

/**
 * Site author schema
 */
export const siteAuthorSchema = z.object({
  name: z.string(),
  photo: z.string().url().optional(),
  url: z.string().url().optional(),
});

/**
 * Site configuration schema
 */
export const siteConfigSchema = z.object({
  me: z.string().url(),
  name: z.string().optional(),
  author: siteAuthorSchema.optional(),
});

/**
 * Complete integration configuration schema
 */
export const astroMicropubConfigSchema = z.object({
  micropub: micropubConfigSchema.optional().default(() => ({})),
  indieauth: indieAuthConfigSchema,
  storage: z.object({
    adapter: z.any(), // MicropubStorageAdapter - validated at runtime
    mediaAdapter: z.any().optional(), // MediaStorageAdapter - validated at runtime
  }),
  discovery: discoveryConfigSchema.optional().default(() => ({})),
  security: securityConfigSchema.optional().default(() => ({})),
  site: siteConfigSchema,
});

/**
 * Validate and apply defaults to configuration
 */
export function validateConfig(config: unknown) {
  return astroMicropubConfigSchema.parse(config);
}
