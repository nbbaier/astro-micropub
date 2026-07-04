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

  it("resolves root-relative endpoints against the origin, ignoring any path in site", () => {
    const links = buildDiscoveryLinks(
      makeConfig({ siteUrl: "https://example.com/blog/" })
    );

    // A path in `site` is not the same as Astro's `base`; root-relative
    // endpoints resolve against the origin.
    expect(links.micropub).toBe("https://example.com/micropub");
  });

  it("prefixes Micropub endpoints with Astro's base path", () => {
    const links = buildDiscoveryLinks(makeConfig(), "/blog");

    expect(links.micropub).toBe("https://example.com/blog/micropub");
    expect(links.micropubMedia).toBe("https://example.com/blog/micropub/media");
  });

  it("does not double the slash when base has a trailing slash", () => {
    const links = buildDiscoveryLinks(makeConfig(), "/blog/");

    expect(links.micropub).toBe("https://example.com/blog/micropub");
  });

  it("leaves endpoints unchanged for the default root base", () => {
    const withDefault = buildDiscoveryLinks(makeConfig());
    const withRoot = buildDiscoveryLinks(makeConfig(), "/");

    expect(withDefault.micropub).toBe("https://example.com/micropub");
    expect(withRoot.micropub).toBe("https://example.com/micropub");
  });

  it("does not apply the base path to external IndieAuth endpoints", () => {
    const links = buildDiscoveryLinks(makeConfig(), "/blog");

    expect(links.authorizationEndpoint).toBe("https://indieauth.com/auth");
    expect(links.tokenEndpoint).toBe("https://tokens.indieauth.com/token");
  });

  it("does not double the base prefix when the endpoint already includes it", () => {
    const links = buildDiscoveryLinks(
      makeConfig({
        micropub: {
          endpoint: "/blog/micropub",
          mediaEndpoint: "/blog/micropub/media",
          enableUpdates: true,
          enableDeletes: true,
          syndicationTargets: [],
        },
      }),
      "/blog"
    );

    expect(links.micropub).toBe("https://example.com/blog/micropub");
    expect(links.micropubMedia).toBe("https://example.com/blog/micropub/media");
  });
});
