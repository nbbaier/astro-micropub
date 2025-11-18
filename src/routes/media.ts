import type { APIRoute } from 'astro';
import { withAuth } from '../lib/token-verification.js';
import {
  createAuthError,
  createErrorResponse,
  createCorsPreflightResponse,
  addCorsHeaders,
  getRuntimeConfig,
  generateSafeFilename,
} from '../lib/utils.js';
import { hasScope } from '../validators/scopes.js';

export const prerender = false;

/**
 * OPTIONS - CORS preflight
 */
export const OPTIONS: APIRoute = async () => {
  const config = getRuntimeConfig();
  return createCorsPreflightResponse(config.security?.allowedOrigins);
};

/**
 * POST - Upload media files
 */
export const POST: APIRoute = async ({ request }) => {
  const config = getRuntimeConfig();

  // Verify authentication
  const auth = await withAuth(
    request,
    config.indieauth.tokenEndpoint,
    config.indieauth.tokenVerificationCache
  );

  if (!auth.authorized || !auth.verification) {
    return createAuthError(401, 'invalid_token');
  }

  // Check for media scope (STRICT - media scope is required, not just create)
  if (config.security?.requireScope && !hasScope(auth.verification.scope, 'media')) {
    return createAuthError(403, 'insufficient_scope', undefined, 'media');
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return addCorsHeaders(
        createErrorResponse(400, 'invalid_request', 'No file provided'),
        config.security?.allowedOrigins
      );
    }

    // Validate file size
    const maxSize = config.security?.maxUploadSize || 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return addCorsHeaders(
        createErrorResponse(
          413,
          'invalid_request',
          `File exceeds maximum size of ${maxSize} bytes`
        ),
        config.security?.allowedOrigins
      );
    }

    // Validate file type
    const allowedTypes = config.security?.allowedMimeTypes || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    if (!allowedTypes.includes(file.type)) {
      return addCorsHeaders(
        createErrorResponse(
          415,
          'invalid_request',
          `File type ${file.type} is not allowed`
        ),
        config.security?.allowedOrigins
      );
    }

    // Generate safe filename
    const filename = await generateSafeFilename(file);

    // Get media adapter (default to main storage adapter if no separate media adapter)
    const mediaAdapter = config.storage?.mediaAdapter || config.storage?.adapter;

    if (!mediaAdapter || !mediaAdapter.saveFile) {
      return addCorsHeaders(
        createErrorResponse(500, 'server_error', 'Media storage not configured'),
        config.security?.allowedOrigins
      );
    }

    // Save file
    const absoluteUrl = await mediaAdapter.saveFile(file, filename);

    // Return 201 Created with Location header
    return addCorsHeaders(
      new Response(null, {
        status: 201,
        headers: {
          Location: absoluteUrl,
        },
      }),
      config.security?.allowedOrigins
    );
  } catch (error: any) {
    console.error('Media upload error:', error);

    return addCorsHeaders(
      createErrorResponse(500, 'server_error', 'Failed to upload file'),
      config.security?.allowedOrigins
    );
  }
};
