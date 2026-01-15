import type { APIRoute } from "astro";
import { isNotFoundError, UrlOwnershipError } from "../lib/errors.js";
import { formToMicroformats, parseRequest } from "../lib/parsers.js";
import { withAuth } from "../lib/token-verification.js";
import {
  addCorsHeaders,
  createAuthError,
  createCorsPreflightResponse,
  createErrorResponse,
  getRuntimeConfig,
  isAbsoluteUrl,
} from "../lib/utils.js";
import type { ResolvedConfig } from "../types/config.js";
import type {
  MicroformatsEntry,
  TokenVerificationResult,
} from "../types/micropub.js";
import {
  convertToUpdateOperations,
  type MicropubActionRequest,
  validateMicropubAction,
  validateMicropubCreate,
} from "../validators/micropub.js";
import { hasScope } from "../validators/scopes.js";

/**
 * Validate that a URL belongs to the configured site
 */
function validateUrlOwnership(url: string, siteMe: string): void {
  const urlObj = new URL(url);
  const siteObj = new URL(siteMe);

  if (urlObj.origin !== siteObj.origin) {
    throw new UrlOwnershipError(`URL ${url} does not belong to this site`);
  }
}

export const prerender = false;

/**
 * OPTIONS - CORS preflight
 */
export const OPTIONS: APIRoute = ({ request }) => {
  const config = getRuntimeConfig();
  const requestOrigin = request.headers.get("origin");
  return createCorsPreflightResponse(
    config.security?.allowedOrigins,
    requestOrigin
  );
};

/**
 * GET - Query endpoint
 */
export const GET: APIRoute = async ({ request, url }) => {
  const config = getRuntimeConfig();
  const requestOrigin = request.headers.get("origin");

  // Verify authentication
  const auth = await withAuth(
    request,
    config.indieauth.tokenEndpoint,
    config.indieauth.tokenVerificationCache
  );

  if (!(auth.authorized && auth.verification)) {
    return createAuthError(
      401,
      "invalid_token",
      undefined,
      undefined,
      requestOrigin,
      config.security?.allowedOrigins
    );
  }

  const query = url.searchParams.get("q");

  if (!query) {
    return addCorsHeaders(
      createErrorResponse(400, "invalid_request", "Missing q parameter"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  try {
    // Handle different query types
    switch (query) {
      case "config":
        return handleConfigQuery(config, requestOrigin);

      case "source":
        return await handleSourceQuery(url, config, requestOrigin);

      case "syndicate-to":
        return handleSyndicateToQuery(config, requestOrigin);

      default:
        return addCorsHeaders(
          createErrorResponse(
            400,
            "invalid_request",
            `Unknown query: ${query}`
          ),
          config.security?.allowedOrigins,
          requestOrigin
        );
    }
  } catch {
    return addCorsHeaders(
      createErrorResponse(500, "server_error", "Internal server error"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }
};

/**
 * POST - Create, update, or delete posts
 */
export const POST: APIRoute = async ({ request }) => {
  const config = getRuntimeConfig();
  const requestOrigin = request.headers.get("origin");

  // Verify authentication
  const auth = await withAuth(
    request,
    config.indieauth.tokenEndpoint,
    config.indieauth.tokenVerificationCache
  );

  if (!(auth.authorized && auth.verification)) {
    return createAuthError(
      401,
      "invalid_token",
      undefined,
      undefined,
      requestOrigin,
      config.security?.allowedOrigins
    );
  }

  try {
    // Parse request
    const { data, files } = await parseRequest(request);

    // Check if this is an action request (update/delete/undelete)
    if (data.action) {
      return await handleAction(data, auth.verification, config, requestOrigin);
    }

    // Otherwise, it's a create request
    return await handleCreate(
      data,
      files?.map((f) => f.file),
      auth.verification,
      config,
      requestOrigin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("content type")) {
      return addCorsHeaders(
        createErrorResponse(400, "invalid_request", message),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    return addCorsHeaders(
      createErrorResponse(500, "server_error", "Internal server error"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }
};

/**
 * Handle config query
 */
function handleConfigQuery(
  config: ResolvedConfig,
  requestOrigin: string | null
): Response {
  const responseData: Record<string, unknown> = {};

  // Add media endpoint
  if (config.micropub?.mediaEndpoint) {
    const mediaUrl = new URL(
      config.micropub.mediaEndpoint,
      config.siteUrl
    ).toString();
    responseData["media-endpoint"] = mediaUrl;
  }

  // Add syndication targets
  if (config.micropub?.syndicationTargets?.length > 0) {
    responseData["syndicate-to"] = config.micropub.syndicationTargets;
  }

  // Add supported queries
  responseData.queries = ["config", "source", "syndicate-to"];

  return addCorsHeaders(
    new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    config.security?.allowedOrigins,
    requestOrigin
  );
}

/**
 * Handle source query
 */
async function handleSourceQuery(
  url: URL,
  config: ResolvedConfig,
  requestOrigin: string | null
): Promise<Response> {
  const sourceUrl = url.searchParams.get("url");

  if (!sourceUrl) {
    return addCorsHeaders(
      createErrorResponse(400, "invalid_request", "Missing url parameter"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  // Validate that URL is absolute
  if (!isAbsoluteUrl(sourceUrl)) {
    return addCorsHeaders(
      createErrorResponse(400, "invalid_request", "URL must be absolute"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  // Get properties filter if specified
  const properties = url.searchParams.getAll("properties[]");

  try {
    const entry = await config.storage.adapter.getPost(
      sourceUrl,
      properties.length > 0 ? properties : undefined
    );

    if (!entry) {
      return addCorsHeaders(
        createErrorResponse(404, "not_found", "Post not found"),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    return addCorsHeaders(
      new Response(JSON.stringify(entry), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      config.security?.allowedOrigins,
      requestOrigin
    );
  } catch {
    return addCorsHeaders(
      createErrorResponse(500, "server_error", "Failed to retrieve post"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }
}

/**
 * Handle syndicate-to query
 */
function handleSyndicateToQuery(
  config: ResolvedConfig,
  requestOrigin: string | null
): Response {
  const targets = config.micropub?.syndicationTargets || [];

  return addCorsHeaders(
    new Response(
      JSON.stringify({
        "syndicate-to": targets,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    ),
    config.security?.allowedOrigins,
    requestOrigin
  );
}

/**
 * Handle create request
 */
async function handleCreate(
  data: Record<string, unknown>,
  _files: File[] | undefined,
  verification: TokenVerificationResult,
  config: ResolvedConfig,
  requestOrigin: string | null
): Promise<Response> {
  // Check for create scope
  if (
    config.security?.requireScope &&
    !hasScope(verification.scope, "create")
  ) {
    return createAuthError(
      403,
      "insufficient_scope",
      undefined,
      "create",
      requestOrigin,
      config.security?.allowedOrigins
    );
  }

  let entry: MicroformatsEntry;

  try {
    // Convert to MF2 format based on input type
    if (data.type && data.properties) {
      // Already in MF2 JSON format
      entry = validateMicropubCreate(data);
    } else if (data.h) {
      // Form-encoded format
      entry = formToMicroformats(data);
    } else {
      return addCorsHeaders(
        createErrorResponse(
          400,
          "invalid_request",
          "Missing required fields (type and properties, or h)"
        ),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    // Validate required content
    if (
      !(
        entry.properties.content ||
        entry.properties.name ||
        entry.properties.photo
      )
    ) {
      return addCorsHeaders(
        createErrorResponse(
          400,
          "invalid_request",
          "Post must have content, name, or photo"
        ),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    // Create post via storage adapter
    const metadata = await config.storage.adapter.createPost(entry);

    // Return 201 Created with Location header
    return addCorsHeaders(
      new Response(null, {
        status: 201,
        headers: {
          Location: metadata.url,
        },
      }),
      config.security?.allowedOrigins,
      requestOrigin
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return addCorsHeaders(
        createErrorResponse(400, "invalid_request", "Invalid entry format"),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    return addCorsHeaders(
      createErrorResponse(500, "server_error", "Failed to create post"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }
}

/**
 * Handle action requests (update/delete/undelete)
 */
async function handleAction(
  data: Record<string, unknown>,
  verification: TokenVerificationResult,
  config: ResolvedConfig,
  requestOrigin: string | null
): Promise<Response> {
  try {
    const action = validateMicropubAction(data);

    switch (action.action) {
      case "update":
        return await handleUpdate(action, verification, config, requestOrigin);

      case "delete":
        return await handleDelete(action, verification, config, requestOrigin);

      case "undelete":
        return await handleUndelete(
          action,
          verification,
          config,
          requestOrigin
        );

      default:
        return addCorsHeaders(
          createErrorResponse(
            400,
            "invalid_request",
            `Unknown action: ${data.action}`
          ),
          config.security?.allowedOrigins,
          requestOrigin
        );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return addCorsHeaders(
        createErrorResponse(400, "invalid_request", "Invalid action format"),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    return addCorsHeaders(
      createErrorResponse(500, "server_error", "Failed to perform action"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }
}

/**
 * Handle update action
 */
async function handleUpdate(
  action: MicropubActionRequest & { action: "update" },
  verification: TokenVerificationResult,
  config: ResolvedConfig,
  requestOrigin: string | null
): Promise<Response> {
  // Check for update scope
  if (
    config.security?.requireScope &&
    !hasScope(verification.scope, "update")
  ) {
    return createAuthError(
      403,
      "insufficient_scope",
      undefined,
      "update",
      requestOrigin,
      config.security?.allowedOrigins
    );
  }

  if (!config.micropub?.enableUpdates) {
    return addCorsHeaders(
      createErrorResponse(403, "forbidden", "Updates are disabled"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  // Validate URL is absolute
  if (!isAbsoluteUrl(action.url)) {
    return addCorsHeaders(
      createErrorResponse(400, "invalid_request", "URL must be absolute"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  // Validate URL belongs to this site
  try {
    validateUrlOwnership(action.url, config.site.me);
  } catch (error) {
    if (error instanceof UrlOwnershipError) {
      return addCorsHeaders(
        createErrorResponse(403, "forbidden", error.message),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }
    throw error;
  }

  try {
    // Convert update request to operations
    const operations = convertToUpdateOperations(action);

    // Apply update via storage adapter
    await config.storage.adapter.updatePost(action.url, operations);

    return addCorsHeaders(
      new Response(null, { status: 204 }),
      config.security?.allowedOrigins,
      requestOrigin
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return addCorsHeaders(
        createErrorResponse(404, "not_found", "Post not found"),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    return addCorsHeaders(
      createErrorResponse(500, "server_error", "Failed to update post"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }
}

/**
 * Handle delete action
 */
async function handleDelete(
  action: MicropubActionRequest & { action: "delete" },
  verification: TokenVerificationResult,
  config: ResolvedConfig,
  requestOrigin: string | null
): Promise<Response> {
  // Check for delete scope
  if (
    config.security?.requireScope &&
    !hasScope(verification.scope, "delete")
  ) {
    return createAuthError(
      403,
      "insufficient_scope",
      undefined,
      "delete",
      requestOrigin,
      config.security?.allowedOrigins
    );
  }

  if (!config.micropub?.enableDeletes) {
    return addCorsHeaders(
      createErrorResponse(403, "forbidden", "Deletes are disabled"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  // Validate URL is absolute
  if (!isAbsoluteUrl(action.url)) {
    return addCorsHeaders(
      createErrorResponse(400, "invalid_request", "URL must be absolute"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  // Validate URL belongs to this site
  try {
    validateUrlOwnership(action.url, config.site.me);
  } catch (error) {
    if (error instanceof UrlOwnershipError) {
      return addCorsHeaders(
        createErrorResponse(403, "forbidden", error.message),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }
    throw error;
  }

  try {
    await config.storage.adapter.deletePost(action.url);

    return addCorsHeaders(
      new Response(null, { status: 204 }),
      config.security?.allowedOrigins,
      requestOrigin
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return addCorsHeaders(
        createErrorResponse(404, "not_found", "Post not found"),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    return addCorsHeaders(
      createErrorResponse(500, "server_error", "Failed to delete post"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }
}

/**
 * Handle undelete action
 */
async function handleUndelete(
  action: MicropubActionRequest & { action: "undelete" },
  verification: TokenVerificationResult,
  config: ResolvedConfig,
  requestOrigin: string | null
): Promise<Response> {
  // Check for delete scope (undelete requires same permission as delete)
  if (
    config.security?.requireScope &&
    !hasScope(verification.scope, "delete")
  ) {
    return createAuthError(
      403,
      "insufficient_scope",
      undefined,
      "delete",
      requestOrigin,
      config.security?.allowedOrigins
    );
  }

  if (!config.micropub?.enableDeletes) {
    return addCorsHeaders(
      createErrorResponse(403, "forbidden", "Undelete is disabled"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  // Validate URL is absolute
  if (!isAbsoluteUrl(action.url)) {
    return addCorsHeaders(
      createErrorResponse(400, "invalid_request", "URL must be absolute"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }

  // Validate URL belongs to this site
  try {
    validateUrlOwnership(action.url, config.site.me);
  } catch (error) {
    if (error instanceof UrlOwnershipError) {
      return addCorsHeaders(
        createErrorResponse(403, "forbidden", error.message),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }
    throw error;
  }

  try {
    await config.storage.adapter.undeletePost(action.url);

    return addCorsHeaders(
      new Response(null, { status: 204 }),
      config.security?.allowedOrigins,
      requestOrigin
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return addCorsHeaders(
        createErrorResponse(404, "not_found", "Post not found"),
        config.security?.allowedOrigins,
        requestOrigin
      );
    }

    return addCorsHeaders(
      createErrorResponse(500, "server_error", "Failed to undelete post"),
      config.security?.allowedOrigins,
      requestOrigin
    );
  }
}
