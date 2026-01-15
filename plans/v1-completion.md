# Astro Micropub - v1.0 Completion Plan

**Status**: In Progress
**Goal**: Complete remaining features for v1.0 release (Production Readiness)
**Original Plan**: `plans/ARCHIVED_PLAN.md`

This document outlines the specific remaining tasks required to bring `astro-micropub` to version 1.0, focusing on production storage, performance, and specification compliance.

## 1. Storage: GitAdapter (Critical)
**Objective**: Implement the production-ready storage adapter that commits changes to Git.

- [ ] **Create `src/storage/git-adapter.ts`**
    - [ ] Implement `MicropubStorageAdapter` interface.
    - [ ] Add constructor with `GitAdapterOptions` (repo path, branch, author info, deploy hooks).
    - [ ] Implement `createPost`:
        - [ ] Generate unique slug.
        - [ ] Convert MF2 to Markdown/Frontmatter (reuse logic from DevFS or extract shared helper).
        - [ ] Write file to disk.
        - [ ] Execute `git add`, `git commit`.
        - [ ] Execute `git push` (optional).
        - [ ] Trigger deploy webhook (optional).
    - [ ] Implement `updatePost`:
        - [ ] Read existing file.
        - [ ] Apply update operations (replace/add/delete).
        - [ ] Write back, commit, push.
    - [ ] Implement `deletePost`/`undeletePost` (soft delete via frontmatter).
- [ ] **Refactor `DevFSAdapter`**: Extract shared logic (MF2 <-> Markdown conversion) into `src/lib/storage-utils.ts` to avoid duplication.
- [ ] **Export**: Update `src/storage/index.ts` to export `GitAdapter`.

## 2. Media: Streaming Uploads (Performance)
**Objective**: Prevent memory exhaustion by streaming file uploads instead of buffering.

- [ ] **Refactor `src/routes/media.ts`**
    - [ ] Replace `request.formData()` with `busboy` (already installed).
    - [ ] Implement streaming pipeline: Request stream -> Busboy -> Media Adapter `saveFile`.
    - [ ] Ensure validation (MIME type, size) happens during stream if possible, or immediately upon header inspection.
- [ ] **Update `MediaStorageAdapter` Interface**
    - [ ] Allow `saveFile` to accept `ReadableStream` or `NodeJS.ReadableStream` in addition to `File` object, or standardize on a stream-compatible format.
    - [ ] Update `DevFSAdapter.saveFile` to handle stream.
    - [ ] Update `GitAdapter` (if it handles media) to handle stream (likely writing to temp file then committing).

## 3. Discovery (Compliance)
**Objective**: Allow Micropub clients to automatically discover endpoints.

- [ ] **Create Component**: `src/components/MicropubDiscovery.astro`
    - [ ] Props: `micropubEndpoint`, `mediaEndpoint`, `authorizationEndpoint`, `tokenEndpoint`.
    - [ ] Render `<link>` tags with `rel="micropub"`, `rel="authorization_endpoint"`, etc.
- [ ] **HTTP Headers**:
    - [ ] Update `src/routes/micropub.ts` and `src/routes/media.ts`.
    - [ ] In `GET` and `POST` responses, append `Link` headers pointing to relevant endpoints.
    - [ ] Ensure absolute URLs are used.

## 4. Rate Limiting (Security)
**Objective**: Protect the API from abuse.

- [ ] **Implement Rate Limiter**:
    - [ ] Create `src/lib/rate-limit.ts`.
    - [ ] Simple in-memory counter (Map<IP, {count, resetTime}>).
    - [ ] (Future/Optional) Redis support for serverless.
- [ ] **Apply Middleware**:
    - [ ] Use in `src/routes/micropub.ts` and `src/routes/media.ts`.
    - [ ] Check `config.security.rateLimit`.
    - [ ] Return 429 Too Many Requests if exceeded.

## 5. Extensions & Consistency (Compliance)
**Objective**: Finalize support for standard Micropub properties.

- [ ] **Review `mp-*` support**:
    - [ ] `mp-slug`: Ensure it's respected in `GitAdapter`.
    - [ ] `post-status`: Map to `draft: true/false` in frontmatter.
    - [ ] `visibility`: Map to frontmatter property.
    - [ ] `mp-photo-alt`: Ensure photo alt text is preserved in frontmatter (e.g., as object array or separate frontmatter key).

## 6. Testing & Polish
- [ ] **Unit Tests**: Add tests for `GitAdapter` (mocking `child_process`).
- [ ] **Integration Tests**: Verify `busboy` streaming works with mock requests.
- [ ] **Documentation**:
    - [ ] Add `examples/` directory.
    - [ ] Document `GitAdapter` usage.
- [ ] **Micropub.rocks**: Run validation suite against a deployed instance.

## Execution Order
1.  **Refactor Storage Utils** (Prepare for GitAdapter)
2.  **Implement GitAdapter** (Core Feature)
3.  **Refactor Media Streaming** (Performance)
4.  **Discovery Component** (Easy Win)
5.  **Rate Limiting** (Security)
6.  **Final Polish**
