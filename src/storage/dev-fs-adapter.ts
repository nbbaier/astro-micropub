import { promises as fs } from "fs";
import { join, dirname } from "path";
import matter from "gray-matter";
import slugify from "slugify";
import type { MicropubStorageAdapter, MediaStorageAdapter } from "./adapter.js";
import type {
  MicroformatsEntry,
  UpdateOperation,
  PostMetadata,
} from "../types/micropub.js";

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
export class DevFSAdapter
implements MicropubStorageAdapter, MediaStorageAdapter
{
  private contentDir: string;
  private mediaDir: string;
  private siteUrl: string;

  constructor(options: DevFSAdapterOptions) {
    this.contentDir = options.contentDir;
    this.mediaDir = options.mediaDir || "public/media";
    this.siteUrl = options.siteUrl;

    if (this.isProduction() || this.isServerless()) {
      console.warn(
        "\n⚠️  WARNING: DevFSAdapter is NOT suitable for production!\n" +
          "   Files will be lost on serverless platforms.\n" +
          "   Use GitAdapter or DatabaseAdapter instead.\n",
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
      const match = urlObj.pathname.match(/\/posts\/([^\/]+)/);
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

    let content = "";

    // Handle content
    if (entry.properties.content) {
      const contentValue = entry.properties.content[0];
      if (typeof contentValue === "string") {
        content = contentValue;
      } else if (contentValue && typeof contentValue === "object") {
        const cv = contentValue as { markdown?: string; html?: string; value?: string };
        if (cv.markdown) {
          content = cv.markdown;
          if (cv.html) {
            frontmatter.content_html = cv.html;
          }
        } else if (cv.html) {
          frontmatter.content_html = cv.html;
          content = cv.value || "";
        } else if (cv.value) {
          content = cv.value;
        }
      }
    }

    // Handle photos with alt text
    if (entry.properties.photo) {
      const photos = entry.properties.photo;
      const alts = entry.properties["mp-photo-alt"] || [];
      frontmatter.photo = photos.map((url: unknown, i: number) => ({
        url: String(url),
        alt: String(alts[i] || ""),
      }));
    }

    // Handle post-status
    if (entry.properties["post-status"]?.[0] === "draft") {
      frontmatter.draft = true;
    }

    // Handle visibility
    if (entry.properties.visibility) {
      frontmatter.visibility = entry.properties.visibility[0];
    }

    // Map other properties (skip mp-* internals and already handled props)
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
      if (!skip.includes(key) && !key.startsWith("mp-")) {
        frontmatter[key] = values.length === 1 ? values[0] : values;
      }
    }

    return { frontmatter, content };
  }

  /**
   * Convert markdown with frontmatter back to MF2 entry
   */
  private markdownToEntry(
    _slug: string,
    fileContent: string,
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
      properties.photo = frontmatter.photo.map((p: unknown) => (p as { url: string }).url);
      properties["mp-photo-alt"] = frontmatter.photo.map(
        (p: unknown) => (p as { alt?: string }).alt || "",
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
    properties?: string[],
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
    operations: UpdateOperation[],
  ): Promise<PostMetadata> {
    const entry = await this.getPost(url);
    if (!entry) {
      throw new Error("Post not found");
    }

    // Apply operations
    for (const op of operations) {
      this.applyOperation(entry.properties, op);
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
      published: new Date((publishedValue as string | number | Date) ?? Date.now()),
      modified: new Date(),
    };
  }

  /**
   * Apply an update operation
   */
  private applyOperation(properties: Record<string, unknown[]>, op: UpdateOperation): void {
    switch (op.action) {
    case "replace":
      properties[op.property] = op.value;
      break;

    case "add":
      if (!properties[op.property]) {
        properties[op.property] = [];
      }
      properties[op.property].push(...op.value);
      break;

    case "delete":
      if (op.value && op.value.length > 0) {
        // Delete specific values (deep equality)
        properties[op.property] = properties[op.property].filter(
          (v: unknown) =>
            !op.value!.some(
              (deleteVal) => JSON.stringify(v) === JSON.stringify(deleteVal),
            ),
        );
        if (properties[op.property].length === 0) {
          delete properties[op.property];
        }
      } else {
        // Delete entire property
        delete properties[op.property];
      }
      break;
    }
  }

  /**
   * Delete a post (soft delete by adding deleted flag)
   */
  async deletePost(url: string): Promise<void> {
    const entry = await this.getPost(url);
    if (!entry) {
      throw new Error("Post not found");
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
      throw new Error("Post not found");
    }

    delete entry.properties.deleted;

    const slug = this.urlToSlug(url);
    if (!slug) {
      throw new Error("Invalid URL");
    }

    const { frontmatter, content } = this.entryToMarkdown(entry);
    delete frontmatter.deleted;

    const fileContent = matter.stringify(content, frontmatter);
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
    const publicPath = this.mediaDir.replace(/^public/, "");
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
