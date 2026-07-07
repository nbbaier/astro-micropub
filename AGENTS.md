# Agent Guidelines

## Commands

- **Build**: `bun run build` (runs `tsc`)
- **Test**: `bun run test` (runs `vitest`). Single test: `bun x vitest test/unit/parsers.test.ts`
- **Lint/Format**: `bun x ultracite fix` (uses Biome)
- **Check**: `bun x ultracite check`
- **Diagnose Ultracite setup**: `bun x ultracite doctor`

## Code Style

- **Imports**: Use ES modules with explicit `.js` extensions for local imports (e.g., `import { x } from './utils.js'`).
- **Formatting**: Uses Biome via Ultracite. 2 spaces indent. Semicolons required. Run `bun x ultracite fix` before committing.
- **Naming**: camelCase for functions/vars, PascalCase for types/classes. Use meaningful names instead of magic numbers.
- **Types**: strict TypeScript. Avoid `any`; prefer `unknown` when genuinely unknown. Use `zod` for validation. Use `as const` for immutable/literal values and type narrowing over assertions.
- **Modern JS/TS**: arrow functions for callbacks, `for...of` over `.forEach()`/indexed loops, optional chaining/nullish coalescing, template literals, destructuring, `const` by default (`let` only when reassigned, never `var`).
- **Async**: always `await` promises, use `async/await` over promise chains, no async Promise executors.
- **Error Handling**: Use `try/catch` meaningfully (don't catch just to rethrow). Throw `Error` objects with descriptive messages. Return standard error responses using helpers in `src/lib/utils.ts`. Prefer early returns over nested conditionals.
- **Security**: `rel="noopener"` on `target="_blank"` links; avoid `dangerouslySetInnerHTML`, `eval()`, direct `document.cookie` writes; validate/sanitize user input.
- **Performance**: no spread in loop accumulators; top-level regex literals (not built in loops); specific imports over namespace imports; avoid barrel files.
- **Conventions**:
  - `src/routes/` for Astro API endpoints (export `GET`, `POST`, etc.).
  - `src/validators/` for input validation logic.
  - No `console.log`/`debugger`/`alert` in production code.

## Project Overview

`astro-micropub` is a Micropub **resource server** integration for Astro. It enables third-party clients (Quill, Indigenous, Micropublish) to create, update, and delete content via the W3C Micropub specification. It integrates with external IndieAuth providers—it does NOT provide authorization/token endpoints.

## Architecture

### Core Flow

1. **Integration Setup** (`src/integration.ts`): A plain Astro integration (default-exported factory returning an `AstroIntegration`). Validates config with Zod, injects routes for `/micropub` and `/micropub/media`, exposes config via Vite's `define` as `__MICROPUB_CONFIG__`, and serves the `virtual:astro-micropub/config` module via an inline Vite plugin.

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
- Assertions live inside `it()`/`test()` blocks; no `.only`/`.skip` in committed code; avoid done-callback style, use async/await; keep `describe` nesting flat.

## Agent skills

### Issue tracker

Issues are tracked as GitHub Issues in `nbbaier/astro-micropub`; external PRs are not pulled into triage. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) — no repo-specific overrides. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
