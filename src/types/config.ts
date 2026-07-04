import type {
  MediaStorageAdapter,
  MicropubStorageAdapter,
} from "../storage/adapter.js";
import type { SyndicationTarget } from "./micropub.js";

/**
 * Micropub configuration options
 */
export interface MicropubConfig {
  enableDeletes?: boolean;
  enableUpdates?: boolean;
  endpoint?: string;
  mediaEndpoint?: string;
  syndicationTargets?: SyndicationTarget[];
}

/**
 * IndieAuth configuration options (external endpoints)
 */
export interface IndieAuthConfig {
  authorizationEndpoint: string; // REQUIRED: External auth endpoint URL
  tokenEndpoint: string; // REQUIRED: External token endpoint URL
  tokenVerificationCache?: number; // Cache duration in seconds (default: 120)
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  adapter: MicropubStorageAdapter;
  mediaAdapter?: MediaStorageAdapter;
}

/**
 * Discovery configuration options
 */
export interface DiscoveryConfig {
  enabled?: boolean;
  includeHeaders?: boolean;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  maxRequests?: number;
  windowMs?: number;
}

/**
 * Security configuration options
 */
export interface SecurityConfig {
  allowedMimeTypes?: string[];
  allowedOrigins?: string[];
  maxUploadSize?: number;
  rateLimit?: RateLimitConfig;
  requireScope?: boolean;
  sanitizeHtml?: (html: string) => string;
}

/**
 * Site configuration options
 */
export interface SiteConfig {
  author?: {
    name: string;
    photo?: string;
    url?: string;
  };
  me: string; // REQUIRED: Site URL (canonical)
  name?: string;
}

/**
 * Complete integration configuration
 */
export interface AstroMicropubConfig {
  discovery?: DiscoveryConfig;
  indieauth: IndieAuthConfig; // REQUIRED
  micropub?: MicropubConfig;
  security?: SecurityConfig;
  site: SiteConfig; // REQUIRED
  storage: StorageConfig; // REQUIRED
}

/**
 * Internal configuration with defaults applied
 */
export interface ResolvedConfig {
  discovery: Required<DiscoveryConfig>;
  indieauth: IndieAuthConfig;
  micropub: Required<MicropubConfig>;
  security: Required<Omit<SecurityConfig, "rateLimit" | "sanitizeHtml">> & {
    rateLimit?: RateLimitConfig;
    sanitizeHtml?: (html: string) => string;
  };
  site: SiteConfig;
  siteUrl: string;
  storage: StorageConfig;
}
