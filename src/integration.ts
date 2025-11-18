import { defineIntegration } from 'astro-integration-kit';
import { z } from 'zod';
import { validateConfig, astroMicropubConfigSchema } from './validators/config.js';
import type { ResolvedConfig } from './types/config.js';

export default defineIntegration({
  name: 'astro-micropub',
  optionsSchema: astroMicropubConfigSchema,
  setup({ options }) {
    return {
      hooks: {
        'astro:config:setup': async (params) => {
          const { config, logger, injectRoute, updateConfig } = params;

          // Validate configuration
          let resolvedConfig: ResolvedConfig;
          try {
            const validated = validateConfig(options);

            // Apply defaults
            resolvedConfig = {
              micropub: {
                endpoint: validated.micropub?.endpoint ?? '/micropub',
                mediaEndpoint: validated.micropub?.mediaEndpoint ?? '/micropub/media',
                enableUpdates: validated.micropub?.enableUpdates ?? true,
                enableDeletes: validated.micropub?.enableDeletes ?? true,
                syndicationTargets: validated.micropub?.syndicationTargets ?? [],
              },
              indieauth: validated.indieauth,
              storage: validated.storage as any, // Type will be validated at runtime
              discovery: {
                enabled: validated.discovery?.enabled ?? true,
                includeHeaders: validated.discovery?.includeHeaders ?? true,
              },
              security: {
                requireScope: validated.security?.requireScope ?? true,
                allowedOrigins: validated.security?.allowedOrigins ?? ['*'],
                maxUploadSize: validated.security?.maxUploadSize ?? 10 * 1024 * 1024,
                allowedMimeTypes: validated.security?.allowedMimeTypes ?? [
                  'image/jpeg',
                  'image/png',
                  'image/gif',
                  'image/webp',
                  'image/svg+xml',
                ],
                rateLimit: validated.security?.rateLimit ?? undefined,
                sanitizeHtml: validated.security?.sanitizeHtml ?? undefined,
              },
              site: validated.site,
            };
          } catch (error) {
            if (error instanceof z.ZodError) {
              logger.error('Invalid Micropub configuration:');
              error.errors.forEach((err) => {
                logger.error(`  - ${err.path.join('.')}: ${err.message}`);
              });
              throw new Error('Invalid Micropub configuration. Please check the errors above.');
            }
            throw error;
          }

          // Validate that site URL is configured
          if (!config.site) {
            logger.error(
              'Micropub requires the site URL to be configured in astro.config.mjs'
            );
            logger.info('Add site: "https://example.com" to your Astro config');
            throw new Error('Missing site URL in Astro config');
          }

          logger.info('Configuring Micropub integration...');

          // Inject Micropub endpoint route
          injectRoute({
            pattern: resolvedConfig.micropub.endpoint,
            entrypoint: 'astro-micropub/routes/micropub',
            prerender: false,
          });

          logger.info(`Micropub endpoint: ${resolvedConfig.micropub.endpoint}`);

          // Inject Media endpoint route
          injectRoute({
            pattern: resolvedConfig.micropub.mediaEndpoint,
            entrypoint: 'astro-micropub/routes/media',
            prerender: false,
          });

          logger.info(`Media endpoint: ${resolvedConfig.micropub.mediaEndpoint}`);

          // Make configuration available to routes via Vite
          updateConfig({
            vite: {
              define: {
                '__MICROPUB_CONFIG__': JSON.stringify({
                  micropub: resolvedConfig.micropub,
                  indieauth: resolvedConfig.indieauth,
                  discovery: resolvedConfig.discovery,
                  security: resolvedConfig.security,
                  site: resolvedConfig.site,
                  siteUrl: config.site.toString(),
                }),
              },
            },
          });

          logger.info('Micropub integration configured successfully');

          // Log IndieAuth endpoints
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
