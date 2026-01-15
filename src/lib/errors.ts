/**
 * Custom error classes for Micropub operations
 * These provide structured error handling instead of string-based detection
 */

/**
 * Base class for Micropub errors
 */
export class MicropubError extends Error {
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
 * Error thrown for invalid request data
 */
export class InvalidRequestError extends MicropubError {
  constructor(message = "Invalid request") {
    super(message, "invalid_request");
    this.name = "InvalidRequestError";
  }
}

/**
 * Type guard to check if an error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard to check if an error is a UrlOwnershipError
 */
export function isUrlOwnershipError(
  error: unknown
): error is UrlOwnershipError {
  return error instanceof UrlOwnershipError;
}

/**
 * Type guard to check if an error is an InvalidRequestError
 */
export function isInvalidRequestError(
  error: unknown
): error is InvalidRequestError {
  return error instanceof InvalidRequestError;
}

/**
 * Type guard to check if an error is any MicropubError
 */
export function isMicropubError(error: unknown): error is MicropubError {
  return error instanceof MicropubError;
}
