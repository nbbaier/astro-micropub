/**
 * Micropub scopes as defined in the spec
 */
export const MICROPUB_SCOPES = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  MEDIA: "media",
  DRAFT: "draft",
} as const;

/**
 * Check if a scope string contains a required scope
 */
export function hasScope(scopeString: string, requiredScope: string): boolean {
  const scopes = scopeString.split(" ").filter(Boolean);
  return scopes.includes(requiredScope);
}

/**
 * Check if a scope string contains any of the required scopes
 */
export function hasAnyScope(
  scopeString: string,
  requiredScopes: string[],
): boolean {
  const scopes = scopeString.split(" ").filter(Boolean);
  return requiredScopes.some((required) => scopes.includes(required));
}

/**
 * Check if a scope string contains all required scopes
 */
export function hasAllScopes(
  scopeString: string,
  requiredScopes: string[],
): boolean {
  const scopes = scopeString.split(" ").filter(Boolean);
  return requiredScopes.every((required) => scopes.includes(required));
}

/**
 * Parse scope string into array
 */
export function parseScopes(scopeString: string): string[] {
  return scopeString.split(" ").filter(Boolean);
}

/**
 * Validate that scopes include create permission
 */
export function requireCreateScope(scopeString: string): boolean {
  return hasScope(scopeString, MICROPUB_SCOPES.CREATE);
}

/**
 * Validate that scopes include update permission
 */
export function requireUpdateScope(scopeString: string): boolean {
  return hasScope(scopeString, MICROPUB_SCOPES.UPDATE);
}

/**
 * Validate that scopes include delete permission
 */
export function requireDeleteScope(scopeString: string): boolean {
  return hasScope(scopeString, MICROPUB_SCOPES.DELETE);
}

/**
 * Validate that scopes include media permission
 */
export function requireMediaScope(scopeString: string): boolean {
  return hasScope(scopeString, MICROPUB_SCOPES.MEDIA);
}
