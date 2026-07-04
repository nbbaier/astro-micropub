import { describe, expect, it } from "vitest";
import { buildDiscoveryLinks } from "../../src/lib/discovery.js";
import type { ResolvedConfig } from "../../src/types/config.js";

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    micropub: {
      endpoint: "/micropub",
      mediaEndpoint: "/micropub/media",
      enableUpdates: true,
      enableDeletes: true,
      syndicationTargets: [],
    },
    indieauth: {
      authorizationEndpoint: "https://indieauth.com/auth",
      tokenEndpoint: "https://tokens.indieauth.com/token",
      tokenVerificationCache: 120,
    },
    storage: { adapter: {} as ResolvedConfig["storage"]["adapter"] },
    discovery: { enabled: true, includeHeaders: true },
    security: {
      requireScope: true,
      allowedOrigins: ["*"],
      maxUploadSize: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg"],
    },
    site: { me: "https://example.com/" },
    siteUrl: "https://example.com/",
    ...overrides,
  };
}

describe("buildDiscoveryLinks", () => {
  it("resolves relative Micropub endpoints against the site URL", () => {
    const links = buildDiscoveryLinks(makeConfig());

    expect(links.micropub).toBe("https://example.com/micropub");
    expect(links.micropubMedia).toBe("https://example.com/micropub/media");
  });

  it("passes through absolute external IndieAuth endpoints unchanged", () => {
    const links = buildDiscoveryLinks(makeConfig());

    expect(links.authorizationEndpoint).toBe("https://indieauth.com/auth");
    expect(links.tokenEndpoint).toBe("https://tokens.indieauth.com/token");
  });

  it("propagates the discovery enabled flag", () => {
    const links = buildDiscoveryLinks(
      makeConfig({ discovery: { enabled: false, includeHeaders: true } })
    );

    expect(links.enabled).toBe(false);
  });

  it("handles a site URL that includes a base path", () => {
    const links = buildDiscoveryLinks(
      makeConfig({ siteUrl: "https://example.com/blog/" })
    );

    // Root-relative endpoints resolve against the origin, not the base path.
    expect(links.micropub).toBe("https://example.com/micropub");
  });
});
