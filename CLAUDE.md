# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`astro-micropub` is a production-ready Micropub resource server integration for Astro. It enables third-party clients (like Quill, Indigenous, Micropublish) to create, update, and delete content on Astro sites via the W3C Micropub specification.

**Key distinction**: This is a Micropub **resource server** that integrates with external IndieAuth providers (like tokens.indieauth.com). It does NOT provide IndieAuth authorization/token endpoints.

## Development Commands

```bash
# Install dependencies
npm install

# Build the integration
npm run build

# Development mode (watch for changes)
npm run dev

# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:coverage

# Lint TypeScript files
npm run lint

# Format code
npm run format
```

### Running Individual Tests

```bash
# Run a specific test file
npx vitest test/unit/parsers.test.ts

# Run tests matching a pattern
npx vitest test/unit/

# Run a specific test by name
npx vitest -t "token verification"
```

## Architecture

### Core Integration Flow

1. **Integration Setup** (`src/integration.ts`): Uses `astro-integration-kit` to define the integration. During `astro:config:setup`:
   - Validates configuration with Zod schemas
   - Injects dynamic routes for `/micropub` and `/micropub/media` endpoints
   - Makes configuration available to routes via Vite's `define` with `__MICROPUB_CONFIG__`

2. **Route Handlers** (`src/routes/`):
   - `micropub.ts`: Main endpoint for create/update/delete/query operations
   - `media.ts`: File upload endpoint with streaming support
   - Both use `withAuth()` for token verification before processing requests

3. **Token Verification** (`src/lib/token-verification.ts`):
   - Extracts Bearer tokens from Authorization headers
   - Verifies tokens against external IndieAuth token endpoint
   - Caches verification results (default: 120s TTL) to reduce external calls
   - Returns scope, client_id, and me URL for authorization checks

4. **Storage Adapter Pattern** (`src/storage/`):
   - `adapter.ts`: Defines `MicropubStorageAdapter` and `MediaStorageAdapter` interfaces
   - `dev-fs-adapter.ts`: Development-only filesystem adapter (warns in production)
   - Adapters handle all post CRUD operations and file storage
   - Return `PostMetadata` with absolute URLs

### Request Processing Flow

**POST /micropub** (Create):
1. Verify token with `withAuth()`
2. Check `create` scope with `hasScope()`
3. Parse request body (JSON or form-encoded) with `parseRequest()`
4. Convert to Microformats2 format with `formToMicroformats()` if needed
5. Validate with `validateMicropubCreate()`
6. Call `adapter.createPost(entry)`
7. Return 201 with Location header

**POST /micropub** (Update/Delete):
1. Verify token and check appropriate scope (`update` or `delete`)
2. Parse action type from request body
3. Validate with `validateMicropubAction()`
4. Convert update operations with `convertToUpdateOperations()`
5. Call `adapter.updatePost()`, `adapter.deletePost()`, or `adapter.undeletePost()`
6. Return 204 No Content

**GET /micropub** (Query):
1. Verify token
2. Handle query types: `config`, `source`, `syndicate-to`
3. For `source`, call `adapter.getPost(url, properties)`
4. Return JSON response with CORS headers

### Configuration Management

Configuration is validated in two stages:
1. **Build time**: `src/validators/config.ts` uses Zod to validate user configuration
2. **Runtime**: Configuration is injected via Vite define as `__MICROPUB_CONFIG__`
3. **Route access**: `getRuntimeConfig()` in `src/lib/utils.ts` retrieves the injected config

Required configuration fields:
- `indieauth.authorizationEndpoint`: External IndieAuth auth endpoint
- `indieauth.tokenEndpoint`: External IndieAuth token endpoint (used for verification)
- `storage.adapter`: Implementation of `MicropubStorageAdapter`
- `site.me`: Canonical site URL

## Key Files and Patterns

### Type Definitions (`src/types/`)

- `config.ts`: Configuration interfaces (`AstroMicropubConfig`, `ResolvedConfig`)
- `micropub.ts`: Micropub types (`MicroformatsEntry`, `UpdateOperation`, `TokenVerificationResult`)

### Validators (`src/validators/`)

- `config.ts`: Zod schemas for integration configuration
- `micropub.ts`: Validates Micropub requests (create, update, delete)
- `scopes.ts`: OAuth 2.0 scope checking (`hasScope()`)

### Libraries (`src/lib/`)

- `parsers.ts`: Parse multipart/form-data and application/x-www-form-urlencoded
- `token-verification.ts`: IndieAuth token verification with caching
- `utils.ts`: CORS, error responses, RFC 6750 auth errors

## Storage Adapter Implementation

When implementing a custom storage adapter, implement the `MicropubStorageAdapter` interface:

```typescript
interface MicropubStorageAdapter {
  createPost(entry: MicroformatsEntry): Promise<PostMetadata>;
  getPost(url: string, properties?: string[]): Promise<MicroformatsEntry | null>;
  updatePost(url: string, operations: UpdateOperation[]): Promise<PostMetadata>;
  deletePost(url: string): Promise<void>;
  undeletePost(url: string): Promise<void>;
}
```

Key requirements:
- **URLs must be absolute**: All returned URLs must be fully qualified (e.g., `https://example.com/posts/hello-world`)
- **Update operations**: Handle `replace`, `add`, and `delete` operation types
- **Soft deletes**: `deletePost()` should soft-delete (e.g., set `published: false`)
- **Property filtering**: `getPost()` should respect the optional `properties` array

See `src/storage/dev-fs-adapter.ts` for a reference implementation.

## Testing Patterns

Tests use Vitest with the following structure:

- `test/unit/`: Unit tests for parsers, validators, token verification
- `test/integration/`: Integration tests for storage adapters

Mock the token endpoint when testing auth flows:
```typescript
const mockTokenEndpoint = 'https://tokens.example.com/token';
```

## Security Considerations

- **Scope enforcement**: Routes check for `create`, `update`, or `delete` scopes
- **CORS**: All responses include CORS headers based on `security.allowedOrigins`
- **RFC 6750 compliance**: Auth errors include proper `WWW-Authenticate` headers
- **Token caching**: Reduces load on IndieAuth servers but respects token expiry
- **URL validation**: All URLs in requests must be absolute (checked with `isAbsoluteUrl()`)

## Module System

This project uses ES modules (`"type": "module"` in package.json):
- Use `.js` extensions in imports (TypeScript will resolve to `.ts` files)
- Export types with `export type` syntax
- Vite handles bundling for the integration

## Build Output

`npm run build` produces:
- `dist/`: Compiled JavaScript with `.d.ts` type definitions
- Source maps for debugging
- Three export paths: main integration, storage adapters, and types
