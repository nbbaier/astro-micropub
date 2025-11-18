import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractToken,
  verifyToken,
  clearTokenCache,
  withAuth,
} from '../../src/lib/token-verification.js';

describe('extractToken', () => {
  it('should extract token from Bearer authorization header', () => {
    const request = new Request('https://example.com', {
      headers: {
        Authorization: 'Bearer test-token-123',
      },
    });

    const token = extractToken(request);
    expect(token).toBe('test-token-123');
  });

  it('should handle case-insensitive Bearer prefix', () => {
    const request = new Request('https://example.com', {
      headers: {
        Authorization: 'bearer test-token-456',
      },
    });

    const token = extractToken(request);
    expect(token).toBe('test-token-456');
  });

  it('should return null when no authorization header', () => {
    const request = new Request('https://example.com');
    const token = extractToken(request);
    expect(token).toBeNull();
  });

  it('should return null for non-Bearer tokens', () => {
    const request = new Request('https://example.com', {
      headers: {
        Authorization: 'Basic dXNlcjpwYXNz',
      },
    });

    const token = extractToken(request);
    expect(token).toBeNull();
  });

  it('should trim whitespace from token', () => {
    const request = new Request('https://example.com', {
      headers: {
        Authorization: 'Bearer   token-with-spaces   ',
      },
    });

    const token = extractToken(request);
    expect(token).toBe('token-with-spaces');
  });
});

describe('verifyToken', () => {
  beforeEach(() => {
    clearTokenCache();
    vi.clearAllMocks();
  });

  it('should verify valid token with endpoint', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        me: 'https://user.example.com/',
        client_id: 'https://client.example.com/',
        scope: 'create update',
      }),
    });

    const result = await verifyToken('test-token', 'https://tokens.example.com/token');

    expect(result).toEqual({
      active: true,
      me: 'https://user.example.com/',
      client_id: 'https://client.example.com/',
      scope: 'create update',
      exp: undefined,
    });

    expect(fetch).toHaveBeenCalledWith('https://tokens.example.com/token', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/json',
      },
    });
  });

  it('should return null for invalid token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await verifyToken('invalid-token', 'https://tokens.example.com/token');
    expect(result).toBeNull();
  });

  it('should return null when response missing required fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        // Missing 'me' and 'scope'
        client_id: 'https://client.example.com/',
      }),
    });

    const result = await verifyToken('test-token', 'https://tokens.example.com/token');
    expect(result).toBeNull();
  });

  it('should cache verification results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        me: 'https://user.example.com/',
        client_id: 'https://client.example.com/',
        scope: 'create',
      }),
    });

    // First call
    await verifyToken('cached-token', 'https://tokens.example.com/token', 60);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    await verifyToken('cached-token', 'https://tokens.example.com/token', 60);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle token expiry', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        me: 'https://user.example.com/',
        client_id: 'https://client.example.com/',
        scope: 'create',
        exp: Math.floor(Date.now() / 1000) - 100, // Expired
      }),
    });

    const result = await verifyToken('expired-token', 'https://tokens.example.com/token');
    expect(result).toBeNull();
  });

  it('should handle network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await verifyToken('test-token', 'https://tokens.example.com/token');
    expect(result).toBeNull();
  });
});

describe('withAuth', () => {
  beforeEach(() => {
    clearTokenCache();
    vi.clearAllMocks();
  });

  it('should return unauthorized when no token', async () => {
    const request = new Request('https://example.com');
    const result = await withAuth(request, 'https://tokens.example.com/token');

    expect(result).toEqual({
      authorized: false,
      error: 'invalid_token',
    });
  });

  it('should return authorized with valid token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        me: 'https://user.example.com/',
        client_id: 'https://client.example.com/',
        scope: 'create update',
      }),
    });

    const request = new Request('https://example.com', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    const result = await withAuth(request, 'https://tokens.example.com/token');

    expect(result.authorized).toBe(true);
    expect(result.verification).toEqual({
      active: true,
      me: 'https://user.example.com/',
      client_id: 'https://client.example.com/',
      scope: 'create update',
      exp: undefined,
    });
  });

  it('should return unauthorized with invalid token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const request = new Request('https://example.com', {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    const result = await withAuth(request, 'https://tokens.example.com/token');

    expect(result).toEqual({
      authorized: false,
      error: 'invalid_token',
    });
  });
});
