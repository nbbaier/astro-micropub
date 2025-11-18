import type { MicropubStorageAdapter, MediaStorageAdapter } from '../storage/adapter.js';
import type { SyndicationTarget } from './micropub.js';

/**
 * Micropub configuration options
 */
export interface MicropubConfig {
  endpoint?: string;
  mediaEndpoint?: string;
  enableUpdates?: boolean;
  enableDeletes?: boolean;
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
  windowMs?: number;
  maxRequests?: number;
}

/**
 * Security configuration options
 */
export interface SecurityConfig {
  requireScope?: boolean;
  allowedOrigins?: string[];
  maxUploadSize?: number;
  allowedMimeTypes?: string[];
  rateLimit?: RateLimitConfig;
  sanitizeHtml?: (html: string) => string;
}

/**
 * Site configuration options
 */
export interface SiteConfig {
  me: string; // REQUIRED: Site URL (canonical)
  name?: string;
  author?: {
    name: string;
    photo?: string;
    url?: string;
  };
}

/**
 * Complete integration configuration
 */
export interface AstroMicropubConfig {
  micropub?: MicropubConfig;
  indieauth: IndieAuthConfig; // REQUIRED
  storage: StorageConfig; // REQUIRED
  discovery?: DiscoveryConfig;
  security?: SecurityConfig;
  site: SiteConfig; // REQUIRED
}

/**
 * Internal configuration with defaults applied
 */
export interface ResolvedConfig {
  micropub: Required<MicropubConfig>;
  indieauth: IndieAuthConfig;
  storage: StorageConfig;
  discovery: Required<DiscoveryConfig>;
  security: Required<Omit<SecurityConfig, 'rateLimit' | 'sanitizeHtml'>> & {
    rateLimit?: RateLimitConfig;
    sanitizeHtml?: (html: string) => string;
  };
  site: SiteConfig;
}
