import type { ResolvedConfig } from "../types/config.js";

const TRAILING_SLASHES = /\/+$/;

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
 * Join Astro's `base` path with a site-relative endpoint, collapsing any
 * duplicate slash between them. `base` defaults to "/" and only contributes a
 * prefix when the site is deployed under a subpath (e.g. `/blog`).
 */
function joinBasePath(base: string, endpoint: string): string {
  const prefix = base.replace(TRAILING_SLASHES, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${prefix}${path}`;
}

/**
 * Resolve a site-relative endpoint to an absolute URL against the canonical
 * site URL, honoring the configured `base`. External IndieAuth endpoints are
 * already absolute and are passed through unchanged by the caller.
 */
function toAbsolute(endpoint: string, siteUrl: string, base: string): string {
  return new URL(joinBasePath(base, endpoint), siteUrl).href;
}

/**
 * Build the absolute discovery links used for endpoint auto-discovery.
 *
 * @param config Resolved integration config.
 * @param base Astro's `config.base` (defaults to "/"). The injected Micropub
 *   routes are served under this prefix, so discovery links must include it to
 *   remain reachable on sites deployed to a subpath.
 */
export function buildDiscoveryLinks(
  config: ResolvedConfig,
  base = "/"
): DiscoveryLinks {
  const { micropub, indieauth, discovery, siteUrl } = config;

  return {
    enabled: discovery.enabled,
    micropub: toAbsolute(micropub.endpoint, siteUrl, base),
    micropubMedia: toAbsolute(micropub.mediaEndpoint, siteUrl, base),
    authorizationEndpoint: indieauth.authorizationEndpoint,
    tokenEndpoint: indieauth.tokenEndpoint,
  };
}
