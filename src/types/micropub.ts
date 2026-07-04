/**
 * Microformats2 entry representation
 */
export interface MicroformatsEntry {
  properties: {
    [key: string]: unknown[];
  };
  type: string[];
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
  deleted?: boolean;
  modified?: Date;
  published: Date;
  url: string; // MUST be absolute
}

/**
 * Token verification result from IndieAuth endpoint
 */
export interface TokenVerificationResult {
  active: boolean;
  client_id: string;
  exp?: number;
  me: string;
  scope: string;
}

/**
 * Syndication target configuration
 */
export interface SyndicationTarget {
  name: string;
  uid: string;
}

/**
 * Micropub action types
 */
export type MicropubAction = "create" | "update" | "delete" | "undelete";

/**
 * Micropub query types
 */
export type MicropubQuery = "config" | "source" | "syndicate-to";
