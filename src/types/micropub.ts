/**
 * Microformats2 entry representation
 */
export interface MicroformatsEntry {
  type: string[];
  properties: {
    [key: string]: unknown[];
  };
}

/**
 * Update operation types (spec-compliant)
 */
export type UpdateOperation =
  | { action: "replace"; property: string; value: unknown[] }
  | { action: "add"; property: string; value: unknown[] }
  | { action: "delete"; property: string; value?: unknown[] };

/**
 * Post metadata returned by storage
 */
export interface PostMetadata {
  url: string; // MUST be absolute
  published: Date;
  modified?: Date;
  deleted?: boolean;
}

/**
 * Token verification result from IndieAuth endpoint
 */
export interface TokenVerificationResult {
  active: boolean;
  me: string;
  client_id: string;
  scope: string;
  exp?: number;
}

/**
 * Syndication target configuration
 */
export interface SyndicationTarget {
  uid: string;
  name: string;
}

/**
 * Micropub action types
 */
export type MicropubAction = "create" | "update" | "delete" | "undelete";

/**
 * Micropub query types
 */
export type MicropubQuery = "config" | "source" | "syndicate-to";
