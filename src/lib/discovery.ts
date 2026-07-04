import type { ResolvedConfig } from "../types/config.js";

/**
 * Serializable discovery data exposed to the `<MicropubDiscovery />`
 * component via the `virtual:astro-micropub/config` module.
 *
 * All endpoint URLs are resolved to absolute form so that clients can
 * discover them regardless of the page they are fetched from.
 */
export interface DiscoveryLinks {
  authorizationEndpoint: string;
  enabled: boolean;
  micropub: string;
  micropubMedia: string;
  tokenEndpoint: string;
}

/**
 * Resolve a possibly-relative endpoint against the canonical site URL.
 * External IndieAuth endpoints are already absolute and pass through
 * unchanged.
 */
function toAbsolute(endpoint: string, siteUrl: string): string {
  return new URL(endpoint, siteUrl).href;
}

/**
 * Build the absolute discovery links used for endpoint auto-discovery.
 */
export function buildDiscoveryLinks(config: ResolvedConfig): DiscoveryLinks {
  const { micropub, indieauth, discovery, siteUrl } = config;

  return {
    enabled: discovery.enabled,
    micropub: toAbsolute(micropub.endpoint, siteUrl),
    micropubMedia: toAbsolute(micropub.mediaEndpoint, siteUrl),
    authorizationEndpoint: indieauth.authorizationEndpoint,
    tokenEndpoint: indieauth.tokenEndpoint,
  };
}
