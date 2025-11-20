# Scout Report: astro-micropub

This is an Astro integration that turns an Astro site into a [Micropub](https://micropub.net/) resource server, allowing you to publish content (posts, photos) using third-party clients (like iA Writer, Quill, Micro.blog) directly to your Astro repository.

## 1. Project Status & Overview

The project is in a **Functional MVP** state. The core Micropub protocol (Create, Update, Delete, Query, Media) is implemented, but it currently relies on a local filesystem adapter (`DevFSAdapter`) which is only suitable for local development. The production-ready `GitAdapter` (intended to commit changes to the repo) is **missing**.

- **Type:** Astro Integration (`src/integration.ts`)
- **Language:** TypeScript
- **Test Framework:** Vitest
- **Validation:** Zod

## 2. Key Components

| Component         | Status     | Location                        | Description                                                                  |
| :---------------- | :--------- | :------------------------------ | :--------------------------------------------------------------------------- |
| **Integration**   | ✅ Ready   | `src/integration.ts`            | Injects routes and handles configuration.                                    |
| **Micropub API**  | ✅ Ready   | `src/routes/micropub.ts`        | Handles `GET` (queries) and `POST` (create/update/delete).                   |
| **Media API**     | ✅ Ready   | `src/routes/media.ts`           | Handles `multipart/form-data` file uploads.                                  |
| **Storage Layer** | ⚠️ Partial | `src/storage/`                  | `DevFSAdapter` exists. **`GitAdapter` is missing.**                          |
| **Auth**          | ✅ Ready   | `src/lib/token-verification.ts` | Verifies tokens against an external IndieAuth server.                        |
| **Discovery**     | ❌ Missing | `N/A`                           | The `MicropubDiscovery` component mentioned in `PLAN.md` is not implemented. |

## 3. Architecture

The system works by injecting API routes into the Astro project:

1.  **Request:** A Micropub client sends a request (e.g., "create post") to `/micropub`.
2.  **Auth:** The request is authenticated against a configured external IndieAuth token endpoint.
3.  **Validation:** The payload is validated (Zod schemas in `src/validators/`).
4.  **Storage:** The `MicropubStorageAdapter` takes the valid data and persists it. Currently, `DevFSAdapter` converts the JSON to Markdown/Frontmatter and writes it to `src/content/posts`.

## 4. Getting Back to Work

To resume development, you should focus on these immediate gaps:

1.  **Implement `GitAdapter`:** This is the biggest blocker for production. It needs to perform the same logic as `DevFSAdapter` (JSON -> Markdown) but commit the file to Git and push it (triggering a CI rebuild of the site).
2.  **Implement Discovery:** Create the `MicropubDiscovery.astro` component to inject `<link rel="micropub" ...>` tags into the user's head.
3.  **Verification:** Run the existing tests to ensure no regressions.

### Useful Commands

- `npm run test` - Run the test suite.
- `npm run build` - Verify compilation.
- `npm run lint` - Check code style.
