import { z } from "astro/zod";
import { defineIntegration } from "astro-integration-kit";
import type { ResolvedConfig } from "./types/config.js";
import {
  astroMicropubConfigSchema,
  validateConfig,
} from "./validators/config.js";

export default defineIntegration({
  name: "astro-micropub",
  optionsSchema: astroMicropubConfigSchema,
  setup({ options }) {
    return {
      hooks: {
        "astro:config:setup": (params) => {
          const { config, logger, injectRoute, updateConfig } = params;

          const siteUrl = validateSiteConfig(config.site?.toString(), logger);

          const resolvedConfig = resolveConfig(options, siteUrl, logger);

          logger.info("Configuring Micropub integration...");

          injectRoute({
            pattern: resolvedConfig.micropub.endpoint,
            entrypoint: "astro-micropub/routes/micropub",
            prerender: false,
          });

          logger.info(`Micropub endpoint: ${resolvedConfig.micropub.endpoint}`);

          injectRoute({
            pattern: resolvedConfig.micropub.mediaEndpoint,
            entrypoint: "astro-micropub/routes/media",
            prerender: false,
          });

          logger.info(
            `Media endpoint: ${resolvedConfig.micropub.mediaEndpoint}`
          );

          updateConfig({
            vite: {
              define: {
                __MICROPUB_CONFIG__: JSON.stringify({
                  micropub: resolvedConfig.micropub,
                  indieauth: resolvedConfig.indieauth,
                  discovery: resolvedConfig.discovery,
                  security: resolvedConfig.security,
                  site: resolvedConfig.site,
                  siteUrl: resolvedConfig.siteUrl,
                }),
              },
            },
          });

          logger.info("Micropub integration configured successfully");

          logger.info(
            `Using IndieAuth authorization endpoint: ${resolvedConfig.indieauth.authorizationEndpoint}`
          );
          logger.info(
            `Using IndieAuth token endpoint: ${resolvedConfig.indieauth.tokenEndpoint}`
          );
        },
      },
    };
  },
});

function validateSiteConfig(
  siteUrl: string | undefined,
  logger: { error: (message: string) => void; info: (message: string) => void }
): string {
  if (siteUrl) {
    return siteUrl;
  }

  logger.error(
    "Micropub requires the site URL to be configured in astro.config.mjs"
  );
  logger.info('Add site: "https://example.com" to your Astro config');
  throw new Error("Missing site URL in Astro config");
}

function resolveConfig(
  options: unknown,
  siteUrl: string,
  logger: { error: (message: string) => void }
): ResolvedConfig {
  try {
    const validated = validateConfig(options);

    return {
      micropub: {
        endpoint: validated.micropub?.endpoint ?? "/micropub",
        mediaEndpoint: validated.micropub?.mediaEndpoint ?? "/micropub/media",
        enableUpdates: validated.micropub?.enableUpdates ?? true,
        enableDeletes: validated.micropub?.enableDeletes ?? true,
        syndicationTargets: validated.micropub?.syndicationTargets ?? [],
      },
      indieauth: validated.indieauth,
      storage: validated.storage as ResolvedConfig["storage"],
      discovery: {
        enabled: validated.discovery?.enabled ?? true,
        includeHeaders: validated.discovery?.includeHeaders ?? true,
      },
      security: {
        requireScope: validated.security?.requireScope ?? true,
        allowedOrigins: validated.security?.allowedOrigins ?? ["*"],
        maxUploadSize: validated.security?.maxUploadSize ?? 10 * 1024 * 1024,
        allowedMimeTypes: validated.security?.allowedMimeTypes ?? [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/svg+xml",
        ],
        rateLimit: validated.security?.rateLimit ?? undefined,
        sanitizeHtml: validated.security?.sanitizeHtml ?? undefined,
      },
      site: validated.site,
      siteUrl,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Invalid Micropub configuration:");
      for (const err of error.errors) {
        logger.error(`  - ${err.path.join(".")}: ${err.message}`);
      }
      throw new Error(
        "Invalid Micropub configuration. Please check the errors above."
      );
    }
    throw error;
  }
}
