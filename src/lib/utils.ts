import crypto from "node:crypto";
import type { ResolvedConfig } from "../types/config.js";

declare const __MICROPUB_CONFIG__: ResolvedConfig | undefined;

/**
 * Generate a safe filename for uploaded files
 * Uses hash-based naming to prevent collisions and path traversal
 */
export async function generateSafeFilename(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = crypto
    .createHash("sha256")
    .update(Buffer.from(buffer))
    .digest("hex");
  const shortHash = hash.substring(0, 16);

  // Extract extension
  const nameParts = file.name.split(".");
  const ext = nameParts.length > 1 ? nameParts.at(-1) : "";

  // Generate filename: YYYY/MM/hash-originalname.ext
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  // Sanitize original filename
  const safeName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  if (ext) {
    return `${year}/${month}/${shortHash}-${safeName}`;
  }

  return `${year}/${month}/${shortHash}`;
}

/**
 * Ensure a URL is absolute
 */
export function ensureAbsoluteUrl(url: string, baseUrl: string): string {
  try {
    new URL(url); // If this doesn't throw, it's already absolute
    return url;
  } catch {
    return new URL(url, baseUrl).toString();
  }
}

/**
 * Validate that a URL is absolute
 */
export function isAbsoluteUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the appropriate CORS origin based on the request origin and allowed origins list
 */
export function getCorsOrigin(
  requestOrigin: string | null,
  allowedOrigins: string[] = ["*"]
): string {
  // If wildcard is allowed, return wildcard
  if (allowedOrigins.includes("*")) {
    return "*";
  }

  // If request origin matches an allowed origin, return it
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Default to first allowed origin (for non-browser requests or mismatched origins)
  return allowedOrigins[0] || "*";
}

/**
 * Create RFC 6750 compliant error response
 */
export function createAuthError(
  status: 401 | 403,
  error: string,
  errorDescription?: string,
  scope?: string,
  requestOrigin?: string | null,
  allowedOrigins?: string[]
): Response {
  let wwwAuthenticate = `Bearer realm="micropub", error="${error}"`;

  if (errorDescription) {
    wwwAuthenticate += `, error_description="${errorDescription}"`;
  }

  if (scope) {
    wwwAuthenticate += `, scope="${scope}"`;
  }

  const origin = getCorsOrigin(requestOrigin ?? null, allowedOrigins);

  return new Response(null, {
    status,
    headers: {
      "WWW-Authenticate": wwwAuthenticate,
      "Access-Control-Allow-Origin": origin,
    },
  });
}

/**
 * Create error response with JSON body
 */
export function createErrorResponse(
  status: number,
  error: string,
  errorDescription?: string,
  requestOrigin?: string | null,
  allowedOrigins?: string[]
): Response {
  const body = {
    error,
    ...(errorDescription && { error_description: errorDescription }),
  };

  const origin = getCorsOrigin(requestOrigin ?? null, allowedOrigins);

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
    },
  });
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(
  response: Response,
  allowedOrigins: string[] = ["*"],
  requestOrigin?: string | null
): Response {
  const headers = new Headers(response.headers);

  const origin = getCorsOrigin(requestOrigin ?? null, allowedOrigins);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (origin !== "*") {
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create CORS preflight response
 */
export function createCorsPreflightResponse(
  allowedOrigins: string[] = ["*"],
  requestOrigin?: string | null
): Response {
  const origin = getCorsOrigin(requestOrigin ?? null, allowedOrigins);

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400", // 24 hours
      ...(origin !== "*" && { "Access-Control-Allow-Credentials": "true" }),
    },
  });
}

/**
 * Get runtime configuration injected by Vite
 */
export function getRuntimeConfig(): ResolvedConfig {
  return __MICROPUB_CONFIG__ ?? ({} as ResolvedConfig);
}
