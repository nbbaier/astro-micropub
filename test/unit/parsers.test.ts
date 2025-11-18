import { describe, it, expect } from 'vitest';
import { parseFormEncoded, formToMicroformats } from '../../src/lib/parsers.js';

describe('parseFormEncoded', () => {
  it('should parse simple form data', () => {
    const result = parseFormEncoded('h=entry&content=Hello+World');
    expect(result).toEqual({
      h: 'entry',
      content: 'Hello World',
    });
  });

  it('should handle array notation with brackets', () => {
    const result = parseFormEncoded('category[]=foo&category[]=bar&category[]=baz');
    expect(result).toEqual({
      category: ['foo', 'bar', 'baz'],
    });
  });

  it('should handle mixed arrays and scalars', () => {
    const result = parseFormEncoded('h=entry&content=Test&category[]=web&category[]=indieweb');
    expect(result).toEqual({
      h: 'entry',
      content: 'Test',
      category: ['web', 'indieweb'],
    });
  });

  it('should convert duplicate keys to arrays', () => {
    const result = parseFormEncoded('tag=foo&tag=bar');
    expect(result).toEqual({
      tag: ['foo', 'bar'],
    });
  });

  it('should handle URL encoded values', () => {
    const result = parseFormEncoded('content=Hello%20World%21&url=https%3A%2F%2Fexample.com');
    expect(result).toEqual({
      content: 'Hello World!',
      url: 'https://example.com',
    });
  });

  it('should handle empty values', () => {
    const result = parseFormEncoded('h=entry&content=');
    expect(result).toEqual({
      h: 'entry',
      content: '',
    });
  });
});

describe('formToMicroformats', () => {
  it('should convert simple form data to MF2', () => {
    const result = formToMicroformats({
      h: 'entry',
      content: 'Hello World',
    });

    expect(result).toEqual({
      type: ['h-entry'],
      properties: {
        content: ['Hello World'],
      },
    });
  });

  it('should handle arrays in properties', () => {
    const result = formToMicroformats({
      h: 'entry',
      content: 'Test post',
      category: ['foo', 'bar'],
    });

    expect(result).toEqual({
      type: ['h-entry'],
      properties: {
        content: ['Test post'],
        category: ['foo', 'bar'],
      },
    });
  });

  it('should skip h and action fields', () => {
    const result = formToMicroformats({
      h: 'entry',
      action: 'create',
      content: 'Test',
    });

    expect(result).toEqual({
      type: ['h-entry'],
      properties: {
        content: ['Test'],
      },
    });
  });

  it('should convert scalar values to arrays', () => {
    const result = formToMicroformats({
      h: 'entry',
      name: 'Post Title',
      content: 'Post content',
    });

    expect(result).toEqual({
      type: ['h-entry'],
      properties: {
        name: ['Post Title'],
        content: ['Post content'],
      },
    });
  });

  it('should default to h-entry if h is not specified', () => {
    const result = formToMicroformats({
      content: 'Hello',
    });

    expect(result.type).toEqual(['h-entry']);
  });

  it('should handle custom post types', () => {
    const result = formToMicroformats({
      h: 'event',
      name: 'My Event',
    });

    expect(result).toEqual({
      type: ['h-event'],
      properties: {
        name: ['My Event'],
      },
    });
  });
});
