import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DevFSAdapter } from '../../src/storage/dev-fs-adapter.js';
import type { MicroformatsEntry } from '../../src/types/micropub.js';

const TEST_DIR = join(process.cwd(), 'test', 'fixtures', 'content');
const TEST_MEDIA_DIR = join(process.cwd(), 'test', 'fixtures', 'media');
const TEST_SITE_URL = 'https://example.com';

describe('DevFSAdapter', () => {
  let adapter: DevFSAdapter;

  beforeEach(async () => {
    // Clean up test directories
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.rm(TEST_MEDIA_DIR, { recursive: true, force: true });

    adapter = new DevFSAdapter({
      contentDir: TEST_DIR,
      mediaDir: TEST_MEDIA_DIR,
      siteUrl: TEST_SITE_URL,
    });
  });

  afterEach(async () => {
    // Clean up after tests
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.rm(TEST_MEDIA_DIR, { recursive: true, force: true });
  });

  describe('createPost', () => {
    it('should create a simple text post', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Hello World'],
          published: ['2024-01-01T12:00:00Z'],
        },
      };

      const metadata = await adapter.createPost(entry);

      expect(metadata.url).toMatch(/^https:\/\/example\.com\/posts\/.+/);
      expect(metadata.published).toBeInstanceOf(Date);

      // Verify file was created
      const files = await fs.readdir(TEST_DIR);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/\.md$/);
    });

    it('should create a post with custom slug', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Test post'],
          'mp-slug': ['my-custom-slug'],
        },
      };

      const metadata = await adapter.createPost(entry);

      expect(metadata.url).toBe('https://example.com/posts/my-custom-slug');

      // Verify file name
      const files = await fs.readdir(TEST_DIR);
      expect(files).toContain('my-custom-slug.md');
    });

    it('should generate slug from name', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          name: ['My Blog Post'],
          content: ['Content here'],
        },
      };

      const metadata = await adapter.createPost(entry);

      expect(metadata.url).toBe('https://example.com/posts/my-blog-post');
    });

    it('should handle slug collisions', async () => {
      const entry1: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          name: ['Test Post'],
          content: ['First post'],
        },
      };

      const entry2: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          name: ['Test Post'],
          content: ['Second post'],
        },
      };

      const metadata1 = await adapter.createPost(entry1);
      const metadata2 = await adapter.createPost(entry2);

      expect(metadata1.url).toBe('https://example.com/posts/test-post');
      expect(metadata2.url).toBe('https://example.com/posts/test-post-1');
    });

    it('should preserve frontmatter properties', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          name: ['My Post'],
          content: ['Content'],
          category: ['web', 'indieweb'],
          published: ['2024-01-01T12:00:00Z'],
        },
      };

      const metadata = await adapter.createPost(entry);

      // Read the file and verify
      const files = await fs.readdir(TEST_DIR);
      const content = await fs.readFile(join(TEST_DIR, files[0]), 'utf-8');

      expect(content).toContain('name: My Post');
      expect(content).toContain('category:');
      expect(content).toContain('- web');
      expect(content).toContain('- indieweb');
    });

    it('should handle photo properties with alt text', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Photo post'],
          photo: ['https://example.com/photo.jpg'],
          'mp-photo-alt': ['A beautiful sunset'],
        },
      };

      await adapter.createPost(entry);

      const files = await fs.readdir(TEST_DIR);
      const content = await fs.readFile(join(TEST_DIR, files[0]), 'utf-8');

      expect(content).toContain('photo:');
      expect(content).toMatch(/url:.*https:\/\/example\.com\/photo\.jpg/);
      expect(content).toContain('alt: A beautiful sunset');
    });

    it('should handle draft status', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Draft post'],
          'post-status': ['draft'],
        },
      };

      await adapter.createPost(entry);

      const files = await fs.readdir(TEST_DIR);
      const content = await fs.readFile(join(TEST_DIR, files[0]), 'utf-8');

      expect(content).toContain('draft: true');
    });
  });

  describe('getPost', () => {
    it('should retrieve a post by URL', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          name: ['Test Post'],
          content: ['Test content'],
        },
      };

      const metadata = await adapter.createPost(entry);
      const retrieved = await adapter.getPost(metadata.url);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.type).toEqual(['h-entry']);
      expect(retrieved?.properties.name).toEqual(['Test Post']);
      expect(retrieved?.properties.content).toEqual(['Test content']);
    });

    it('should return null for non-existent post', async () => {
      const result = await adapter.getPost('https://example.com/posts/non-existent');
      expect(result).toBeNull();
    });

    it('should filter properties when requested', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          name: ['Test'],
          content: ['Content'],
          category: ['web'],
        },
      };

      const metadata = await adapter.createPost(entry);
      const retrieved = await adapter.getPost(metadata.url, ['name', 'category']);

      expect(retrieved?.properties).toHaveProperty('name');
      expect(retrieved?.properties).toHaveProperty('category');
      expect(retrieved?.properties).not.toHaveProperty('content');
    });
  });

  describe('updatePost', () => {
    it('should replace properties', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          name: ['Original'],
          content: ['Original content'],
        },
      };

      const metadata = await adapter.createPost(entry);

      await adapter.updatePost(metadata.url, [
        {
          action: 'replace',
          property: 'content',
          value: ['Updated content'],
        },
      ]);

      const updated = await adapter.getPost(metadata.url);
      expect(updated?.properties.content).toEqual(['Updated content']);
      expect(updated?.properties.name).toEqual(['Original']); // Unchanged
    });

    it('should add values to properties', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Test'],
          category: ['web'],
        },
      };

      const metadata = await adapter.createPost(entry);

      await adapter.updatePost(metadata.url, [
        {
          action: 'add',
          property: 'category',
          value: ['indieweb'],
        },
      ]);

      const updated = await adapter.getPost(metadata.url);
      expect(updated?.properties.category).toEqual(['web', 'indieweb']);
    });

    it('should delete entire properties', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Test'],
          category: ['web'],
        },
      };

      const metadata = await adapter.createPost(entry);

      await adapter.updatePost(metadata.url, [
        {
          action: 'delete',
          property: 'category',
        },
      ]);

      const updated = await adapter.getPost(metadata.url);
      expect(updated?.properties).not.toHaveProperty('category');
    });

    it('should delete specific values from properties', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Test'],
          category: ['web', 'indieweb', 'blog'],
        },
      };

      const metadata = await adapter.createPost(entry);

      await adapter.updatePost(metadata.url, [
        {
          action: 'delete',
          property: 'category',
          value: ['indieweb'],
        },
      ]);

      const updated = await adapter.getPost(metadata.url);
      expect(updated?.properties.category).toEqual(['web', 'blog']);
    });

    it('should add updated timestamp', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Test'],
        },
      };

      const metadata = await adapter.createPost(entry);

      await adapter.updatePost(metadata.url, [
        {
          action: 'replace',
          property: 'content',
          value: ['Updated'],
        },
      ]);

      const updated = await adapter.getPost(metadata.url);
      expect(updated?.properties.updated).toBeDefined();
    });
  });

  describe('deletePost', () => {
    it('should soft delete a post', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Test'],
        },
      };

      const metadata = await adapter.createPost(entry);
      await adapter.deletePost(metadata.url);

      const deleted = await adapter.getPost(metadata.url);
      expect(deleted?.properties.deleted).toEqual([true]);
    });
  });

  describe('undeletePost', () => {
    it('should restore a deleted post', async () => {
      const entry: MicroformatsEntry = {
        type: ['h-entry'],
        properties: {
          content: ['Test'],
        },
      };

      const metadata = await adapter.createPost(entry);
      await adapter.deletePost(metadata.url);
      await adapter.undeletePost(metadata.url);

      const restored = await adapter.getPost(metadata.url);
      expect(restored?.properties.deleted).toBeUndefined();
    });
  });

  describe('saveFile', () => {
    it('should save a file and return absolute URL', async () => {
      const content = 'test file content';
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], 'test.txt', { type: 'text/plain' });

      const url = await adapter.saveFile(file, 'test-file.txt');

      expect(url).toMatch(/^https:\/\/example\.com\/.+\/test-file\.txt$/);

      // Verify file exists
      const savedContent = await fs.readFile(join(TEST_MEDIA_DIR, 'test-file.txt'), 'utf-8');
      expect(savedContent).toBe(content);
    });
  });
});
