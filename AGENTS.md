# Agent Guidelines

## Commands

- **Build**: `bun run build` (runs `tsc`)
- **Test**: `bun run test` (runs `vitest`). Single test: `bun x vitest test/unit/parsers.test.ts`
- **Lint/Format**: `bun x ultracite fix` (uses Biome)
- **Check**: `bun x ultracite check`

## Code Style

- **Imports**: Use ES modules with explicit `.js` extensions for local imports (e.g., `import { x } from './utils.js'`).
- **Formatting**: Uses Biome via Ultracite. 2 spaces indent. Semicolons required.
- **Naming**: camelCase for functions/vars, PascalCase for types/classes.
- **Types**: strict TypeScript. Avoid `any`. Use `zod` for validation.
- **Error Handling**: Use `try/catch`. Return standard error responses using helpers in `src/lib/utils.ts`.
- **Conventions**:
  - `src/routes/` for Astro API endpoints (export `GET`, `POST`, etc.).
  - `src/validators/` for input validation logic.

## Project Overview

`astro-micropub` is a Micropub **resource server** integration for Astro. It enables third-party clients (Quill, Indigenous, Micropublish) to create, update, and delete content via the W3C Micropub specification. It integrates with external IndieAuth providers—it does NOT provide authorization/token endpoints.

## Architecture

### Core Flow

1. **Integration Setup** (`src/integration.ts`): Uses `astro-integration-kit`. Validates config with Zod, injects routes for `/micropub` and `/micropub/media`, exposes config via Vite's `define` as `__MICROPUB_CONFIG__`.

2. **Route Handlers** (`src/routes/`): `micropub.ts` (create/update/delete/query), `media.ts` (file uploads). Both use `withAuth()` for token verification.

3. **Token Verification** (`src/lib/token-verification.ts`): Extracts Bearer tokens, verifies against external IndieAuth endpoint, caches results (120s TTL).

4. **Storage Adapters** (`src/storage/`): `MicropubStorageAdapter` and `MediaStorageAdapter` interfaces. `dev-fs-adapter.ts` is a reference implementation.

### Key Directories

- `src/types/` - Config and Micropub type definitions
- `src/validators/` - Zod schemas for config and request validation
- `src/lib/` - Parsers, token verification, CORS, error responses

### Required Configuration

- `indieauth.authorizationEndpoint` / `indieauth.tokenEndpoint`
- `storage.adapter` - Implementation of `MicropubStorageAdapter`
- `site.me` - Canonical site URL

## Testing

Tests use Vitest:
- `test/unit/` - Unit tests for parsers, validators, token verification
- `test/integration/` - Storage adapter tests
