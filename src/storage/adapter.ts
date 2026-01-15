import type {
  MicroformatsEntry,
  PostMetadata,
  UpdateOperation,
} from "../types/micropub.js";

/**
 * Core storage adapter interface for Micropub posts
 */
export interface MicropubStorageAdapter {
  /**
   * Create a new post
   * @param entry - Microformats2 entry to create
   * @returns Metadata with absolute URL of created post
   */
  createPost(entry: MicroformatsEntry): Promise<PostMetadata>;

  /**
   * Retrieve a post by URL
   * @param url - Absolute URL of the post
   * @param properties - Optional array of properties to filter
   * @returns Microformats2 entry or null if not found
   */
  getPost(
    url: string,
    properties?: string[]
  ): Promise<MicroformatsEntry | null>;

  /**
   * Update a post
   * @param url - Absolute URL of the post
   * @param operations - Array of update operations to apply
   * @returns Updated post metadata
   */
  updatePost(url: string, operations: UpdateOperation[]): Promise<PostMetadata>;

  /**
   * Delete a post (soft delete)
   * @param url - Absolute URL of the post
   */
  deletePost(url: string): Promise<void>;

  /**
   * Restore a deleted post
   * @param url - Absolute URL of the post
   */
  undeletePost(url: string): Promise<void>;
}

/**
 * Media storage adapter interface for file uploads
 */
export interface MediaStorageAdapter {
  /**
   * Save an uploaded file
   * @param file - File to save
   * @param filename - Generated filename
   * @returns Absolute URL of saved file
   */
  saveFile(file: File, filename: string): Promise<string>;

  /**
   * Delete a media file
   * @param url - Absolute URL of the file
   */
  deleteFile(url: string): Promise<void>;
}
