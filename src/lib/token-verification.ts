import type { TokenVerificationResult } from "../types/micropub.js";

/**
 * Simple in-memory cache for token verifications
 */
class TokenCache {
  private readonly cache = new Map<
    string,
    { result: TokenVerificationResult; expiry: number }
  >();

  set(
    token: string,
    result: TokenVerificationResult,
    ttlSeconds: number
  ): void {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(token, { result, expiry });

    // Auto-cleanup after TTL
    setTimeout(() => {
      this.cache.delete(token);
    }, ttlSeconds * 1000);
  }

  get(token: string): TokenVerificationResult | null {
    const entry = this.cache.get(token);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(token);
      return null;
    }

    // Check token's own expiry if present
    if (entry.result.exp && entry.result.exp < Date.now() / 1000) {
      this.cache.delete(token);
      return null;
    }

    return entry.result;
  }

  clear(): void {
    this.cache.clear();
  }
}

const tokenCache = new TokenCache();

/**
 * Extract Bearer token from Authorization header
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Verify a token with the IndieAuth token endpoint
 */
/** Default timeout for token verification requests (5 seconds) */
const TOKEN_VERIFICATION_TIMEOUT_MS = 5000;

export async function verifyToken(
  token: string,
  tokenEndpoint: string,
  cacheTTL = 120
): Promise<TokenVerificationResult | null> {
  // Validate token is non-empty
  if (!token || token.trim().length === 0) {
    return null;
  }

  // Check cache first
  const cached = tokenCache.get(token);
  if (cached) {
    return cached;
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      TOKEN_VERIFICATION_TIMEOUT_MS
    );

    // Verify with IndieAuth token endpoint
    const response = await fetch(tokenEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Validate required fields
    if (!(data.me && data.scope)) {
      return null;
    }

    const result: TokenVerificationResult = {
      active: true,
      me: data.me as string,
      client_id: (data.client_id as string) || "",
      scope: data.scope as string,
      exp: data.exp as number | undefined,
    };

    // Check if token is already expired
    if (result.exp && result.exp < Date.now() / 1000) {
      return null;
    }

    // Cache the result
    tokenCache.set(token, result, cacheTTL);

    return result;
  } catch {
    return null;
  }
}

/**
 * Clear the token cache (useful for testing)
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}

/**
 * Middleware to verify authorization and populate request context
 */
export async function withAuth(
  request: Request,
  tokenEndpoint: string,
  cacheTTL?: number
): Promise<{
  authorized: boolean;
  verification?: TokenVerificationResult;
  error?: string;
}> {
  const token = extractToken(request);

  if (!token) {
    return {
      authorized: false,
      error: "invalid_token",
    };
  }

  const verification = await verifyToken(token, tokenEndpoint, cacheTTL);

  if (!verification) {
    return {
      authorized: false,
      error: "invalid_token",
    };
  }

  return {
    authorized: true,
    verification,
  };
}
