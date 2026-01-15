import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import slugify from "slugify";
import { NotFoundError } from "../lib/errors.js";
import type {
  MicroformatsEntry,
  PostMetadata,
  UpdateOperation,
} from "../types/micropub.js";
import type { MediaStorageAdapter, MicropubStorageAdapter } from "./adapter.js";

export interface DevFSAdapterOptions {
  contentDir: string;
  mediaDir?: string;
  siteUrl: string;
}

/**
 * Development filesystem adapter
 *
 * ⚠️ WARNING: NOT suitable for production serverless deployments!
 * Files will be lost on serverless platforms. Use GitAdapter or DatabaseAdapter instead.
 */
const POST_PATH_REGEX = /\/posts\/([^/]+)/;
const PUBLIC_PATH_REGEX = /^public/;

export class DevFSAdapter
  implements MicropubStorageAdapter, MediaStorageAdapter
{
  private readonly contentDir: string;
  private readonly mediaDir: string;
  private readonly siteUrl: string;

  constructor(options: DevFSAdapterOptions) {
    this.contentDir = options.contentDir;
    this.mediaDir = options.mediaDir || "public/media";
    this.siteUrl = options.siteUrl;

    if (this.isProduction() || this.isServerless()) {
      console.warn(
        "\n⚠️  WARNING: DevFSAdapter is NOT suitable for production!\n" +
          "   Files will be lost on serverless platforms.\n" +
          "   Use GitAdapter or DatabaseAdapter instead.\n"
      );
    }

    this.ensureDirectories();
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }

  private isServerless(): boolean {
    // Common serverless environment indicators
    return !!(
      process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTION_NAME
    );
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.contentDir, { recursive: true });
      await fs.mkdir(this.mediaDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        console.warn("Failed to create directories:", error);
      }
    }
  }

  /**
   * Generate a URL-safe slug from entry properties
   */
  private generateSlug(entry: MicroformatsEntry): string {
    // Check for mp-slug first
    const customSlug = entry.properties["mp-slug"]?.[0];
    if (typeof customSlug === "string") {
      return slugify(customSlug, { lower: true, strict: true });
    }

    // Try name/title
    const name = entry.properties.name?.[0];
    if (typeof name === "string") {
      return slugify(name, { lower: true, strict: true });
    }

    // Try content (first 50 chars)
    const content = entry.properties.content?.[0];
    if (content) {
      const text =
        typeof content === "string"
          ? content
          : (content as { value?: string; text?: string }).value ||
            (content as { value?: string; text?: string }).text ||
            "";
      const truncated = text.substring(0, 50).trim();
      if (truncated) {
        return slugify(truncated, { lower: true, strict: true });
      }
    }

    // Fallback to timestamp
    return `post-${Date.now()}`;
  }

  /**
   * Ensure slug is unique by checking filesystem
   */
  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.postExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Check if a post file exists
   */
  private async postExists(slug: string): Promise<boolean> {
    const filePath = join(this.contentDir, `${slug}.md`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert slug to absolute URL
   */
  private slugToUrl(slug: string): string {
    return new URL(`/posts/${slug}`, this.siteUrl).toString();
  }

  /**
   * Convert absolute URL to slug
   */
  private urlToSlug(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const match = urlObj.pathname.match(POST_PATH_REGEX);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Convert MF2 entry to markdown with frontmatter
   */
  private entryToMarkdown(entry: MicroformatsEntry): {
    frontmatter: Record<string, unknown>;
    content: string;
  } {
    const frontmatter: Record<string, unknown> = {
      type: entry.type[0],
      published: entry.properties.published?.[0] || new Date().toISOString(),
    };

    const content = this.getContent(entry, frontmatter);
    this.addPhotosToFrontmatter(entry, frontmatter);
    this.addDraftToFrontmatter(entry, frontmatter);
    this.addVisibilityToFrontmatter(entry, frontmatter);
    this.addOtherPropertiesToFrontmatter(entry, frontmatter);

    return { frontmatter, content };
  }

  private getContent(
    entry: MicroformatsEntry,
    frontmatter: Record<string, unknown>
  ): string {
    const contentValue = entry.properties.content?.[0];
    if (!contentValue) {
      return "";
    }

    if (typeof contentValue === "string") {
      return contentValue;
    }

    if (contentValue && typeof contentValue === "object") {
      const cv = contentValue as {
        markdown?: string;
        html?: string;
        value?: string;
      };
      if (cv.markdown) {
        if (cv.html) {
          frontmatter.content_html = cv.html;
        }
        return cv.markdown;
      }
      if (cv.html) {
        frontmatter.content_html = cv.html;
        return cv.value || "";
      }
      if (cv.value) {
        return cv.value;
      }
    }

    return "";
  }

  private addPhotosToFrontmatter(
    entry: MicroformatsEntry,
    frontmatter: Record<string, unknown>
  ): void {
    if (!entry.properties.photo) {
      return;
    }

    const photos = entry.properties.photo;
    const alts = entry.properties["mp-photo-alt"] || [];
    frontmatter.photo = photos.map((url: unknown, i: number) => ({
      url: String(url),
      alt: String(alts[i] || ""),
    }));
  }

  private addDraftToFrontmatter(
    entry: MicroformatsEntry,
    frontmatter: Record<string, unknown>
  ): void {
    if (entry.properties["post-status"]?.[0] === "draft") {
      frontmatter.draft = true;
    }
  }

  private addVisibilityToFrontmatter(
    entry: MicroformatsEntry,
    frontmatter: Record<string, unknown>
  ): void {
    if (entry.properties.visibility) {
      frontmatter.visibility = entry.properties.visibility[0];
    }
  }

  private addOtherPropertiesToFrontmatter(
    entry: MicroformatsEntry,
    frontmatter: Record<string, unknown>
  ): void {
    const skip = [
      "content",
      "published",
      "photo",
      "mp-photo-alt",
      "mp-slug",
      "post-status",
      "visibility",
    ];

    for (const [key, values] of Object.entries(entry.properties)) {
      if (!(skip.includes(key) || key.startsWith("mp-"))) {
        frontmatter[key] = values.length === 1 ? values[0] : values;
      }
    }
  }

  /**
   * Convert markdown with frontmatter back to MF2 entry
   */
  private markdownToEntry(
    _slug: string,
    fileContent: string
  ): MicroformatsEntry {
    const { data: frontmatter, content } = matter(fileContent);

    const properties: Record<string, unknown[]> = {};

    // Restore content (trim trailing newlines added by gray-matter)
    if (content) {
      const trimmedContent = content.trimEnd();
      if (frontmatter.content_html) {
        properties.content = [
          {
            html: frontmatter.content_html,
            value: trimmedContent,
          },
        ];
      } else {
        properties.content = [trimmedContent];
      }
    }

    // Restore photos
    if (frontmatter.photo) {
      properties.photo = frontmatter.photo.map(
        (p: unknown) => (p as { url: string }).url
      );
      properties["mp-photo-alt"] = frontmatter.photo.map(
        (p: unknown) => (p as { alt?: string }).alt || ""
      );
    }

    // Restore post-status
    if (frontmatter.draft) {
      properties["post-status"] = ["draft"];
    }

    // Restore other properties
    const skip = [
      "type",
      "published",
      "content_html",
      "photo",
      "draft",
      "visibility",
    ];
    for (const [key, value] of Object.entries(frontmatter)) {
      if (!skip.includes(key)) {
        properties[key] = Array.isArray(value) ? value : [value];
      }
    }

    // Add published if present
    if (frontmatter.published) {
      properties.published = [frontmatter.published];
    }

    return {
      type: [frontmatter.type || "h-entry"],
      properties,
    };
  }

  /**
   * Create a new post
   */
  async createPost(entry: MicroformatsEntry): Promise<PostMetadata> {
    const baseSlug = this.generateSlug(entry);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const { frontmatter, content } = this.entryToMarkdown(entry);
    const fileContent = matter.stringify(content, frontmatter);

    const filePath = join(this.contentDir, `${slug}.md`);

    // Ensure directory exists
    await fs.mkdir(dirname(filePath), { recursive: true });

    // Write file
    await fs.writeFile(filePath, fileContent, "utf-8");

    return {
      url: this.slugToUrl(slug),
      published: new Date(frontmatter.published as string | number | Date),
    };
  }

  /**
   * Get a post by URL
   */
  async getPost(
    url: string,
    properties?: string[]
  ): Promise<MicroformatsEntry | null> {
    const slug = this.urlToSlug(url);
    if (!slug) {
      return null;
    }

    const filePath = join(this.contentDir, `${slug}.md`);

    try {
      const fileContent = await fs.readFile(filePath, "utf-8");
      const entry = this.markdownToEntry(slug, fileContent);

      // Filter properties if requested
      if (properties && properties.length > 0) {
        const filtered: Record<string, unknown[]> = {};
        for (const prop of properties) {
          if (entry.properties[prop]) {
            filtered[prop] = entry.properties[prop];
          }
        }
        return {
          type: entry.type,
          properties: filtered,
        };
      }

      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Update a post
   */
  async updatePost(
    url: string,
    operations: UpdateOperation[]
  ): Promise<PostMetadata> {
    const entry = await this.getPost(url);
    if (!entry) {
      throw new NotFoundError("Post not found");
    }

    // Apply operations
    for (const op of operations) {
      entry.properties = this.applyOperation(entry.properties, op);
    }

    // Update modified timestamp
    entry.properties.updated = [new Date().toISOString()];

    // Save back
    const slug = this.urlToSlug(url);
    if (!slug) {
      throw new Error("Invalid URL");
    }

    const { frontmatter, content } = this.entryToMarkdown(entry);
    const fileContent = matter.stringify(content, frontmatter);
    const filePath = join(this.contentDir, `${slug}.md`);

    await fs.writeFile(filePath, fileContent, "utf-8");

    const publishedValue = entry.properties.published?.[0];
    return {
      url,
      published: new Date(
        (publishedValue as string | number | Date) ?? Date.now()
      ),
      modified: new Date(),
    };
  }

  /**
   * Apply an update operation
   */
  private applyOperation(
    properties: Record<string, unknown[]>,
    op: UpdateOperation
  ): Record<string, unknown[]> {
    switch (op.action) {
      case "replace":
        return {
          ...properties,
          [op.property]: op.value,
        };

      case "add": {
        const existing = properties[op.property] ?? [];
        return {
          ...properties,
          [op.property]: [...existing, ...op.value],
        };
      }

      case "delete": {
        if (op.value && op.value.length > 0) {
          // Delete specific values (deep equality)
          const currentValues = properties[op.property] ?? [];
          const updated = currentValues.filter(
            (v: unknown) =>
              !op.value?.some(
                (deleteVal) => JSON.stringify(v) === JSON.stringify(deleteVal)
              )
          );
          if (updated.length > 0) {
            return {
              ...properties,
              [op.property]: updated,
            };
          }
        }

        return this.removeProperty(properties, op.property);
      }

      default:
        return properties;
    }
  }

  private removeProperty(
    properties: Record<string, unknown[]>,
    property: string
  ): Record<string, unknown[]> {
    const { [property]: _removed, ...rest } = properties;
    return rest;
  }

  /**
   * Delete a post (soft delete by adding deleted flag)
   */
  async deletePost(url: string): Promise<void> {
    const entry = await this.getPost(url);
    if (!entry) {
      throw new NotFoundError("Post not found");
    }

    entry.properties.deleted = [true];

    const slug = this.urlToSlug(url);
    if (!slug) {
      throw new Error("Invalid URL");
    }

    const { frontmatter, content } = this.entryToMarkdown(entry);
    frontmatter.deleted = true;

    const fileContent = matter.stringify(content, frontmatter);
    const filePath = join(this.contentDir, `${slug}.md`);

    await fs.writeFile(filePath, fileContent, "utf-8");
  }

  /**
   * Undelete a post
   */
  async undeletePost(url: string): Promise<void> {
    const entry = await this.getPost(url);
    if (!entry) {
      throw new NotFoundError("Post not found");
    }

    const { deleted: _deleted, ...remainingProperties } = entry.properties;
    entry.properties = remainingProperties;

    const slug = this.urlToSlug(url);
    if (!slug) {
      throw new Error("Invalid URL");
    }

    const { frontmatter, content } = this.entryToMarkdown(entry);
    const { deleted: _deletedFlag, ...remainingFrontmatter } = frontmatter;

    const fileContent = matter.stringify(content, remainingFrontmatter);
    const filePath = join(this.contentDir, `${slug}.md`);

    await fs.writeFile(filePath, fileContent, "utf-8");
  }

  /**
   * Save a media file
   */
  async saveFile(file: File, filename: string): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = join(this.mediaDir, filename);

    // Ensure directory exists
    await fs.mkdir(dirname(filePath), { recursive: true });

    // Write file
    await fs.writeFile(filePath, buffer);

    // Return absolute URL (assuming mediaDir is in public/)
    const publicPath = this.mediaDir.replace(PUBLIC_PATH_REGEX, "");
    return new URL(`${publicPath}/${filename}`, this.siteUrl).toString();
  }

  /**
   * Delete a media file
   */
  async deleteFile(url: string): Promise<void> {
    const urlObj = new URL(url);
    const publicPath = urlObj.pathname;
    const filePath = join("public", publicPath);

    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore file deletion errors
    }
  }
}
