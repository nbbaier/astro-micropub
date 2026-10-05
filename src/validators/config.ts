import { z } from "astro/zod";

/**
 * Syndication target schema
 */
export const syndicationTargetSchema = z.object({
  name: z.string(),
  uid: z.string().url(),
});

/**
 * Micropub configuration schema
 */
export const micropubConfigSchema = z.object({
  enableDeletes: z.boolean().default(true),
  enableUpdates: z.boolean().default(true),
  endpoint: z.string().default("/micropub"),
  mediaEndpoint: z.string().default("/micropub/media"),
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
  maxRequests: z.number().positive().default(100),
  windowMs: z
    .number()
    .positive()
    .default(15 * 60 * 1000), // 15 minutes
});

/**
 * Security configuration schema
 */
export const securityConfigSchema = z.object({
  allowedMimeTypes: z.array(z.string()).default([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Note: SVG excluded by default due to XSS risk (can contain JavaScript)
  ]),
  allowedOrigins: z.array(z.string()).default(["*"]),
  maxUploadSize: z
    .number()
    .positive()
    .default(10 * 1024 * 1024), // 10 MB
  rateLimit: rateLimitConfigSchema.optional(),
  requireScope: z.boolean().default(true),
  sanitizeHtml: z
    .custom<(input: string) => string>((v) => typeof v === "function")
    .optional(),
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
  author: siteAuthorSchema.optional(),
  me: z.string().url(),
  name: z.string().optional(),
});

/**
 * Complete integration configuration schema
 */
export const astroMicropubConfigSchema = z.object({
  discovery: discoveryConfigSchema.optional().default(() => ({
    enabled: true,
    includeHeaders: true,
  })),
  indieauth: indieAuthConfigSchema,
  micropub: micropubConfigSchema.optional().default(() => ({
    enableDeletes: true,
    enableUpdates: true,
    endpoint: "/micropub",
    mediaEndpoint: "/micropub/media",
    syndicationTargets: [],
  })),
  security: securityConfigSchema.optional().default(() => ({
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedOrigins: ["*"],
    maxUploadSize: 10 * 1024 * 1024,
    requireScope: true,
  })),
  site: siteConfigSchema,
  storage: z.object({
    adapter: z.any(), // MicropubStorageAdapter - validated at runtime
    mediaAdapter: z.any().optional(), // MediaStorageAdapter - validated at runtime
  }),
});

/**
 * Validate and apply defaults to configuration
 */
export function validateConfig(config: unknown) {
  return astroMicropubConfigSchema.parse(config);
}
