/**
 * Custom error classes for Micropub operations
 * These provide structured error handling instead of string-based detection
 */

/**
 * Base class for Micropub errors
 */
class MicropubError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "MicropubError";
    this.code = code;
  }
}

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends MicropubError {
  constructor(message = "Resource not found") {
    super(message, "not_found");
    this.name = "NotFoundError";
  }
}

/**
 * Error thrown when a URL doesn't belong to the configured site
 */
export class UrlOwnershipError extends MicropubError {
  constructor(message = "URL does not belong to this site") {
    super(message, "forbidden");
    this.name = "UrlOwnershipError";
  }
}

/**
 * Type guard to check if an error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}
