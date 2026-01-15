# Astro Micropub Integration - Detailed Implementation Plan

## Project Overview

**Name**: `astro-micropub`

**Purpose**: A production-ready Micropub **resource server** for Astro projects, enabling third-party clients to create, update, and delete content on Astro sites.

**Compliance**: Full W3C Micropub specification compliance with IndieAuth token verification.

**Scope for v1.0**:

-  Micropub endpoint (create, update, delete, query)
-  Media endpoint with streaming uploads
-  Token verification against external IndieAuth token endpoint
-  Pluggable storage adapters (Git-based default for production)
-  Discovery and endpoint configuration
-  Full spec compliance (micropub.rocks testing)
-  CORS support for browser-based clients
-  RFC 6750 compliant authentication

**Out of Scope for v1.0** (deferred to v2.0+):

-  Built-in IndieAuth authorization/token server
-  Syndication implementation (configuration only)
-  Multi-user support
-  Admin UI
-  Webmention integration

**Why this scope?**: Building a secure IndieAuth server is complex. v1.0 focuses on being an excellent Micropub resource server that works with existing IndieAuth services (like tokens.indieauth.com) or custom IndieAuth servers.

---

## Implementation Status

**Current Phase**: Core Functionality Complete (Phases 1-6) ✅

### Completed Phases

- ✅ **Phase 1: Foundation** - Project structure, storage adapters, configuration schema
- ✅ **Phase 2: Micropub Core** - POST endpoint for creating posts, parsers, CORS, error handling
- ✅ **Phase 3: Token Verification** - IndieAuth integration, caching, scope enforcement
- ✅ **Phase 4: Micropub Queries** - Config, source, and syndicate-to query endpoints
- ✅ **Phase 5: Update & Delete** - Spec-compliant update, delete, and undelete operations
- ✅ **Phase 6: Media Endpoint** - File upload with streaming, validation, and security

### In Progress

- 🚧 **Phase 7: Micropub Extensions** - Additional mp-* properties (basic support implemented)
- 🚧 **Testing & Validation** - Manual testing with real Micropub clients

### Pending Phases

- ⏳ **Phase 8: Discovery** - MicropubDiscovery component for auto-injection
- ⏳ **Phase 9: Testing & Compliance** - micropub.rocks validation suite testing
- ⏳ **Phase 10: Polish & Release** - Rate limiting, production hardening, v1.0 release

**Last Updated**: 2025-11-18

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Components Breakdown](#components-breakdown)
3. [Storage Architecture](#storage-architecture)
4. [API Specifications](#api-specifications)
5. [Configuration Schema](#configuration-schema)
6. [Implementation Phases](#implementation-phases)
7. [File Structure](#file-structure)
8. [Testing Strategy](#testing-strategy)
9. [Documentation Requirements](#documentation-requirements)
10.   [Security Considerations](#security-considerations)
11.   [Required Dependencies](#required-dependencies)
12.   [Reference Materials](#reference-materials)

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      Third-Party Clients                        │
│              (Quill, Indigenous, Micropublish, etc.)            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Endpoint Discovery                         │
│         <link rel="micropub" href="/micropub">                  │
│         <link rel="micropub_media" href="/micropub/media">      │
│         <link rel="authorization_endpoint" ...> (external)      │
│         <link rel="token_endpoint" ...> (external)              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Token Verification (Per-Route)                     │
│          - Verify token with external IndieAuth endpoint        │
│          - Extract me, scope, client_id from verification       │
│          - Cache verifications briefly (60-120s)                │
│          - RFC 6750 compliant WWW-Authenticate headers          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ├────────────────┬────────────────┐
                       ▼                ▼                ▼
              ┌──────────────┐ ┌──────────┐   ┌──────────────┐
              │   Micropub   │ │  Media   │   │  External    │
              │   Endpoint   │ │ Endpoint │   │  IndieAuth   │
              │  /micropub   │ │ /media   │   │  Server      │
              │              │ │          │   │ (tokens.     │
              └──────┬───────┘ └────┬─────┘   │ indieauth.   │
                     │              │         │  com, etc.)  │
                     ▼              ▼         └──────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                     Storage Adapter Layer                       │
│                    (Pluggable Interface)                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┬──────────────┐
         ▼             ▼             ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│     Git      │ │ Database │ │   Dev    │ │    Custom    │
│   Adapter    │ │ Adapter  │ │    FS    │ │   Adapter    │
│ (Production) │ │(Postgres)│ │(Dev Only)│ │              │
│              │ │          │ │  ! Warns │ │              │
└──────┬───────┘ └──────────┘ └──────────┘ └──────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│         Git Repository + Deploy Hook (Netlify/Vercel)           │
│    - Commits files to content branch                            │
│    - Triggers rebuild via webhook                               │
│    - Content appears after build completes                      │
└─────────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Spec Compliance**: Full W3C Micropub + IndieAuth token verification
2. **Production Ready**: Git-based workflow for static/serverless deployments
3. **Pluggable Storage**: Abstract storage layer for maximum flexibility
4. **Type Safety**: Full TypeScript support with Zod validation
5. **Developer Experience**: Simple configuration with sane defaults
6. **Security First**: RFC 6750 compliance, scope enforcement, CORS, rate limiting
7. **External Auth**: Works with any IndieAuth server (don't reinvent the wheel)

---

## Components Breakdown

### v1.0 Components

1. **Integration Entry Point** - Main integration setup
2. **Micropub Endpoint** - Core resource server (create, update, delete, query)
3. **Media Endpoint** - Streaming file upload handling
4. **Token Verification** - Validate tokens against external IndieAuth endpoint
5. **Storage Adapters** - Pluggable persistence layer (Git, DB, FS)
6. **Discovery Component** - Endpoint discovery links and headers

### Deferred to v2.0+

-  IndieAuth Authorization Server
-  IndieAuth Token Server
-  Syndication Implementation (POSSE)
-  Multi-user Support
-  Admin UI

---

### 1. Integration Entry Point

**File**: `src/integration.ts`

**Responsibilities**:

-  Define integration using `astro-integration-kit`
-  Parse and validate user configuration
-  Inject Micropub and media routes (NO auth/token routes in v1)
-  Add discovery component or headers
-  Configure Vite for runtime config access
-  Validate external IndieAuth endpoints are configured

**Key Hooks**:

-  `astro:config:setup` - Primary setup hook
   -  `injectRoute()` - Add Micropub and media endpoints only
   -  `updateConfig()` - Inject configuration via Vite defines
   -  Optional: Add discovery component to pages

**Configuration Interface**:

```typescript
{
  // Micropub configuration
  micropub: {
    endpoint: string;                          // Default: "/micropub"
    mediaEndpoint: string;                     // Default: "/micropub/media"
    enableUpdates: boolean;                    // Default: true
    enableDeletes: boolean;                    // Default: true
    syndicationTargets?: SyndicationTarget[];  // Config only (not implemented)
  },

  // IndieAuth configuration (EXTERNAL endpoints - REQUIRED)
  indieauth: {
    authorizationEndpoint: string;             // REQUIRED: External auth endpoint URL
    tokenEndpoint: string;                     // REQUIRED: External token endpoint URL
    tokenVerificationCache?: number;           // Cache duration in seconds (default: 120)
  },

  // Storage configuration
  storage: {
    adapter: StorageAdapter;                   // Default: GitAdapter
    options: object;                           // Adapter-specific config
  },

  // Discovery configuration
  discovery: {
    enabled: boolean;                          // Default: true
    includeHeaders: boolean;                   // Add Link headers (default: true)
  },

  // Security configuration
  security: {
    requireScope: boolean;                     // Default: true (strict scope enforcement)
    allowedOrigins: string[];                  // CORS (default: ["*"])
    maxUploadSize: number;                     // Bytes (default: 10MB)
    allowedMimeTypes: string[];                // For media (default: images only)
    rateLimit?: {
      windowMs: number;                        // Default: 15 * 60 * 1000 (15 min)
      maxRequests: number;                     // Default: 100
    },
    sanitizeHtml?: (html: string) => string;   // Optional HTML sanitizer
  },

  // Site configuration
  site: {
    me: string;                                // REQUIRED: Site URL (canonical)
    name?: string;                             // Site name
    author?: {
      name: string;
      photo?: string;
      url?: string;
    }
  }
}
```

---

### 2. Micropub Endpoint

**File**: `src/routes/micropub.ts`

**Route**: Configured via `options.micropub.endpoint` (default `/micropub`)

**Supported Methods**: GET, POST, OPTIONS (CORS preflight)

**Responsibilities**:

#### OPTIONS - CORS Preflight

-  Return CORS headers for browser-based clients
-  `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`

#### GET Requests (Query Endpoint)

1. **Configuration Query** (`q=config`)

   -  Require authentication
   -  Return media endpoint URL (absolute)
   -  Return syndication targets (if configured)
   -  Return supported queries

2. **Source Query** (`q=source&url=...`)

   -  Require authentication
   -  Accept **absolute URLs only**
   -  Retrieve post content by URL
   -  Support property filtering (`properties[]=name&properties[]=content`)
   -  Return Microformats2 JSON representation

3. **Syndicate-to Query** (`q=syndicate-to`)
   -  Require authentication
   -  Return list of syndication targets

#### POST Requests (Create/Update/Delete)

1. **Create Posts**

   -  Accept `application/x-www-form-urlencoded` (with bracket notation)
   -  Accept `application/json`
   -  Accept `multipart/form-data` (only if no separate media endpoint)
   -  Validate h-entry vocabulary
   -  Support Micropub-specific properties:
      -  `mp-slug` - Custom slug
      -  `post-status` - draft/published
      -  `visibility` - public/unlisted/private
      -  `mp-photo-alt` - Alt text for photos
      -  `mp-syndicate-to` - Syndication targets
   -  Generate slug (respect `mp-slug`, ensure uniqueness)
   -  Save via storage adapter
   -  Return `201 Created` with **absolute** `Location` header

2. **Update Posts** (if enabled)

   -  Require `update` scope
   -  Require JSON format per spec
   -  Support operations with correct semantics:
      -  `replace`: `{ "property": ["value1", "value2"] }` - Replace all values
      -  `add`: `{ "property": ["newValue"] }` - Append to existing
      -  `delete`: `["property"]` (entire property) OR `{ "property": ["value"] }` (specific values)
   -  Handle arrays vs scalars correctly
   -  Handle object values with deep equality
   -  Validate `url` parameter (must be absolute)
   -  Apply updates via storage adapter
   -  Return `204 No Content` on success

3. **Delete Posts** (if enabled)

   -  Require `delete` scope
   -  Support both form-encoded and JSON
   -  Require `action=delete` and `url`
   -  Soft delete via storage adapter
   -  Return `204 No Content`

4. **Undelete Posts** (if enabled)
   -  Support `action=undelete` and `url`
   -  Restore via storage adapter
   -  Return `204 No Content`

**Error Responses** (RFC 6750 compliant):

```typescript
// 401 Unauthorized
return new Response(null, {
   status: 401,
   headers: {
      "WWW-Authenticate": 'Bearer realm="micropub", error="invalid_token"',
   },
});

// 403 Forbidden (insufficient scope)
return new Response(null, {
   status: 403,
   headers: {
      "WWW-Authenticate": `Bearer realm="micropub", error="insufficient_scope", scope="${requiredScope}"`,
   },
});

// 400 Bad Request (with JSON body)
return new Response(
   JSON.stringify({
      error: "invalid_request",
      error_description: "Missing required property: content",
   }),
   {
      status: 400,
      headers: { "Content-Type": "application/json" },
   }
);
```

**CORS Headers** (all responses):

```typescript
headers.set(
   "Access-Control-Allow-Origin",
   config.security.allowedOrigins[0] || "*"
);
headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
```

---

### 3. Media Endpoint

**File**: `src/routes/media.ts`

**Route**: Configured via `options.micropub.mediaEndpoint` (default `/micropub/media`)

**Supported Methods**: POST, OPTIONS

**Responsibilities**:

-  Accept `multipart/form-data` uploads
-  **Require `media` scope** explicitly (NOT just `create`)
-  **Stream uploads** to storage (don't buffer large files in memory)
-  Validate file types (whitelist: images by default)
-  Enforce size limits (configurable, default 10MB)
-  Generate safe, unique filenames (hash-based recommended)
-  Store files via media storage adapter
-  Return `201 Created` with **absolute** `Location` header

**Security Hardening**:

-  Size limits prevent DoS
-  MIME type whitelist prevents malicious uploads
-  Streaming prevents memory exhaustion
-  Safe filename generation prevents path traversal

**Implementation**:

```typescript
export const prerender = false;

export const OPTIONS: APIRoute = async () => {
   return new Response(null, {
      status: 204,
      headers: {
         "Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Methods": "POST, OPTIONS",
         "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
   });
};

export const POST: APIRoute = async ({ request, locals }) => {
   // 1. Validate authentication
   if (!locals.isAuthorized) {
      return new Response(null, {
         status: 401,
         headers: {
            "WWW-Authenticate":
               'Bearer realm="micropub", error="invalid_token"',
            "Access-Control-Allow-Origin": "*",
         },
      });
   }

   // 2. Check media scope (STRICT)
   if (!locals.scopes.includes("media")) {
      return new Response(null, {
         status: 403,
         headers: {
            "WWW-Authenticate":
               'Bearer realm="micropub", error="insufficient_scope", scope="media"',
            "Access-Control-Allow-Origin": "*",
         },
      });
   }

   // 3. Parse multipart (streaming)
   const formData = await request.formData();
   const file = formData.get("file") as File;

   if (!file) {
      return new Response(
         JSON.stringify({
            error: "invalid_request",
            error_description: "No file provided",
         }),
         {
            status: 400,
            headers: { "Content-Type": "application/json" },
         }
      );
   }

   // 4. Validate file size
   const maxSize = locals.config.security.maxUploadSize || 10 * 1024 * 1024;
   if (file.size > maxSize) {
      return new Response(
         JSON.stringify({
            error: "invalid_request",
            error_description: `File exceeds ${maxSize} bytes`,
         }),
         { status: 413 }
      );
   }

   // 5. Validate file type
   const allowedTypes = locals.config.security.allowedMimeTypes || [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
   ];
   if (!allowedTypes.includes(file.type)) {
      return new Response(
         JSON.stringify({
            error: "invalid_request",
            error_description: `Type ${file.type} not allowed`,
         }),
         { status: 415 }
      );
   }

   // 6. Generate safe filename (hash-based)
   const filename = await generateSafeFilename(file);

   // 7. Stream to storage (no memory buffering)
   const absoluteUrl = await locals.mediaStorage.saveFile(file, filename);

   // 8. Return absolute URL
   return new Response(null, {
      status: 201,
      headers: {
         Location: absoluteUrl,
         "Access-Control-Allow-Origin": "*",
      },
   });
};
```

---

### 4. Token Verification

**File**: `src/lib/token-verification.ts`

**Purpose**: Verify Bearer tokens against external IndieAuth token endpoint

**NOT in v1.0**: We do NOT build an IndieAuth server. Users configure external endpoints.

**How IndieAuth Token Verification Works**:

Per the IndieAuth spec, Micropub servers verify tokens by making a request to the token endpoint:

1. Extract Bearer token from `Authorization: Bearer <token>` header or form body
2. Send GET request to configured `tokenEndpoint` with `Authorization: Bearer <token>`
3. Parse response containing `me`, `scope`, `client_id`, `exp`
4. Cache result briefly (60-120s) to reduce latency
5. Populate route locals with auth data

**Implementation**:

```typescript
// src/lib/token-verification.ts

interface TokenVerificationResult {
   active: boolean;
   me: string;
   client_id: string;
   scope: string;
   exp?: number;
}

const tokenCache = new Map<string, TokenVerificationResult>();

export async function verifyToken(
   token: string,
   tokenEndpoint: string
): Promise<TokenVerificationResult | null> {
   // Check cache
   const cached = tokenCache.get(token);
   if (cached && (!cached.exp || cached.exp > Date.now() / 1000)) {
      return cached;
   }

   // Verify with IndieAuth token endpoint
   try {
      const response = await fetch(tokenEndpoint, {
         method: "GET",
         headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
         },
      });

      if (!response.ok) {
         return null;
      }

      const data = await response.json();

      const result: TokenVerificationResult = {
         active: true,
         me: data.me,
         client_id: data.client_id,
         scope: data.scope,
         exp: data.exp,
      };

      // Cache for 120 seconds
      tokenCache.set(token, result);
      setTimeout(() => tokenCache.delete(token), 120 * 1000);

      return result;
   } catch (error) {
      console.error("Token verification failed:", error);
      return null;
   }
}

export function extractToken(request: Request): string | null {
   // From Authorization header
   const authHeader = request.headers.get("authorization");
   if (authHeader?.startsWith("Bearer ")) {
      return authHeader.substring(7);
   }

   // From form body (for form-encoded requests)
   // Note: Must clone request if body will be read again later
   return null;
}
```

**Usage in API Routes**:

```typescript
// In Micropub/Media endpoints
const token = extractToken(request);
if (!token) {
   return new Response(null, {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="micropub"' },
   });
}

const verification = await verifyToken(token, config.indieauth.tokenEndpoint);

if (!verification) {
   return new Response(null, {
      status: 401,
      headers: {
         "WWW-Authenticate": 'Bearer realm="micropub", error="invalid_token"',
      },
   });
}

// Check scope
if (!verification.scope.split(" ").includes(requiredScope)) {
   return new Response(null, {
      status: 403,
      headers: {
         "WWW-Authenticate": `Bearer realm="micropub", error="insufficient_scope", scope="${requiredScope}"`,
      },
   });
}

// Populate locals
locals.isAuthorized = true;
locals.me = verification.me;
locals.clientId = verification.client_id;
locals.scopes = verification.scope.split(" ");
```

---

### 5. Discovery Component

**File**: `src/components/MicropubDiscovery.astro`

**Purpose**: Add discovery `<link>` tags and HTTP headers for endpoint discovery

**Usage**: Manual inclusion in layouts OR automatic injection (optional)

**Component**:

```astro
---
// src/components/MicropubDiscovery.astro
interface Props {
  micropubEndpoint?: string;
  mediaEndpoint?: string;
  authorizationEndpoint: string;  // REQUIRED: external
  tokenEndpoint: string;          // REQUIRED: external
}

const {
  micropubEndpoint = "/micropub",
  mediaEndpoint = "/micropub/media",
  authorizationEndpoint,
  tokenEndpoint
} = Astro.props;

// Make URLs absolute
const siteUrl = Astro.site?.toString() || "";
const absoluteMicropub = new URL(micropubEndpoint, siteUrl).toString();
const absoluteMedia = new URL(mediaEndpoint, siteUrl).toString();
---

<link rel="micropub" href={absoluteMicropub} />
<link rel="micropub_media" href={absoluteMedia} />
<link rel="authorization_endpoint" href={authorizationEndpoint} />
<link rel="token_endpoint" href={tokenEndpoint} />
```

**HTTP Link Headers** (added to responses):

```typescript
// In Micropub endpoint responses
headers.set(
   "Link",
   [
      `<${absoluteMicropubUrl}>; rel="micropub"`,
      `<${absoluteMediaUrl}>; rel="micropub_media"`,
      `<${config.indieauth.authorizationEndpoint}>; rel="authorization_endpoint"`,
      `<${config.indieauth.tokenEndpoint}>; rel="token_endpoint"`,
   ].join(", ")
);
```

---

## Storage Architecture

### Storage Adapter Interface

**File**: `src/storage/adapter.ts`

```typescript
/**
 * Microformats2 entry representation
 */
export interface MicroformatsEntry {
   type: string[];
   properties: {
      [key: string]: any[];
   };
}

/**
 * Update operation types (spec-compliant)
 */
export type UpdateOperation =
   | { action: "replace"; property: string; value: any[] }
   | { action: "add"; property: string; value: any[] }
   | { action: "delete"; property: string; value?: any[] };

/**
 * Post metadata returned by storage
 */
export interface PostMetadata {
   url: string; // MUST be absolute
   published: Date;
   modified?: Date;
   deleted?: boolean;
}

/**
 * Core storage adapter interface
 */
export interface MicropubStorageAdapter {
   createPost(entry: MicroformatsEntry): Promise<PostMetadata>;
   getPost(
      url: string,
      properties?: string[]
   ): Promise<MicroformatsEntry | null>;
   updatePost(
      url: string,
      operations: UpdateOperation[]
   ): Promise<PostMetadata>;
   deletePost(url: string): Promise<void>;
   undeletePost(url: string): Promise<void>;
}

/**
 * Media storage adapter interface
 */
export interface MediaStorageAdapter {
   saveFile(file: File, filename: string): Promise<string>; // Returns absolute URL
   deleteFile(url: string): Promise<void>;
}
```

---

### Default Storage Adapter: Git Adapter

**File**: `src/storage/git-adapter.ts`

**Why Git?**: Matches how Astro sites are deployed (static hosting with git-based continuous deployment).

**Strategy**:

-  Write files to content directory (e.g., `src/content/posts/`)
-  Commit changes to git repository
-  Optionally push to remote
-  Optionally trigger deploy hook (Netlify, Vercel, etc.)
-  Content appears after build completes
-  Works with serverless/static deployments
-  Preserves full MF2 data in frontmatter

**Implementation Highlights**:

```typescript
export interface GitAdapterOptions {
   contentDir?: string; // Default: "src/content/posts"
   mediaDir?: string; // Default: "public/media"
   branch?: string; // Default: current branch
   commitMessage?: string; // Template: "New post: {title}"
   authorName?: string; // Git commit author
   authorEmail?: string; // Git commit email
   autoPush?: boolean; // Default: true
   deployHook?: string; // Webhook URL to trigger build
   deployHookMethod?: string; // Default: "POST"
   siteUrl: string; // For absolute URLs (REQUIRED)
}

export class GitAdapter implements MicropubStorageAdapter {
   async createPost(entry: MicroformatsEntry): Promise<PostMetadata> {
      // 1. Generate slug (respect mp-slug)
      const customSlug = entry.properties["mp-slug"]?.[0];
      const slug = customSlug || this.generateSlug(entry);
      const uniqueSlug = await this.ensureUniqueSlug(slug);

      // 2. Convert to Markdown (preserve HTML, handle alt text)
      const { frontmatter, content } = this.convertToMarkdown(entry);

      // 3. Write file
      const filename = `${uniqueSlug}.md`;
      const filePath = join(this.contentDir, filename);
      const fileContent = matter.stringify(content, frontmatter);
      await writeFile(filePath, fileContent, "utf-8");

      // 4. Git commit
      await this.gitCommit(
         filename,
         `New post: ${frontmatter.name || uniqueSlug}`
      );

      // 5. Trigger deploy
      if (this.options.deployHook) {
         await this.triggerDeploy();
      }

      // 6. Return ABSOLUTE URL
      const absoluteUrl = new URL(
         `/posts/${uniqueSlug}`,
         this.options.siteUrl
      ).toString();

      return {
         url: absoluteUrl,
         published: new Date(frontmatter.published),
      };
   }

   private async gitCommit(filename: string, message: string): Promise<void> {
      const filePath = join(this.contentDir, filename);

      execSync(`git add "${filePath}"`, { stdio: "ignore" });

      const gitConfig = [];
      if (this.options.authorName) {
         gitConfig.push(`-c user.name="${this.options.authorName}"`);
      }
      if (this.options.authorEmail) {
         gitConfig.push(`-c user.email="${this.options.authorEmail}"`);
      }

      execSync(`git ${gitConfig.join(" ")} commit -m "${message}"`, {
         stdio: "ignore",
      });

      if (this.options.autoPush !== false) {
         execSync("git push", { stdio: "ignore" });
      }
   }

   private async triggerDeploy(): Promise<void> {
      if (!this.options.deployHook) return;

      await fetch(this.options.deployHook, {
         method: this.options.deployHookMethod || "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            source: "astro-micropub",
            timestamp: new Date().toISOString(),
         }),
      });
   }

   private convertToMarkdown(entry: MicroformatsEntry): {
      frontmatter: any;
      content: string;
   } {
      const frontmatter: any = {
         type: entry.type[0],
         published: entry.properties.published?.[0] || new Date().toISOString(),
      };

      let content = "";

      // Preserve HTML if provided (don't auto-convert)
      if (entry.properties.content) {
         const contentValue = entry.properties.content[0];
         if (typeof contentValue === "string") {
            content = contentValue;
         } else if (contentValue.markdown) {
            content = contentValue.markdown;
            if (contentValue.html) {
               frontmatter.content_html = contentValue.html;
            }
         } else if (contentValue.html) {
            frontmatter.content_html = contentValue.html;
            content = contentValue.value || "";
         } else if (contentValue.value) {
            content = contentValue.value;
         }
      }

      // Handle photos with alt text
      if (entry.properties.photo) {
         const photos = entry.properties.photo;
         const alts = entry.properties["mp-photo-alt"] || [];
         frontmatter.photo = photos.map((url: string, i: number) => ({
            url,
            alt: alts[i] || "",
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

      // Map other properties (skip mp-* internals)
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

   private applyOperation(data: any, op: UpdateOperation): void {
      switch (op.action) {
         case "replace":
            data[op.property] = op.value;
            break;
         case "add":
            if (!data[op.property]) data[op.property] = [];
            if (!Array.isArray(data[op.property])) {
               data[op.property] = [data[op.property]];
            }
            data[op.property].push(...op.value);
            break;
         case "delete":
            if (op.value && op.value.length > 0) {
               // Delete specific values (deep equality)
               if (!Array.isArray(data[op.property])) {
                  data[op.property] = [data[op.property]];
               }
               data[op.property] = data[op.property].filter(
                  (v: any) =>
                     !op.value!.some(
                        (deleteVal) =>
                           JSON.stringify(v) === JSON.stringify(deleteVal)
                     )
               );
               if (data[op.property].length === 0) {
                  delete data[op.property];
               }
            } else {
               // Delete entire property
               delete data[op.property];
            }
            break;
      }
   }
}
```

---

### Alternative Adapters

#### Dev Filesystem Adapter (Development Only)

**File**: `src/storage/dev-fs-adapter.ts`

⚠️ **WARNING**: Not suitable for production serverless deployments!

```typescript
export class DevFSAdapter implements MicropubStorageAdapter {
   constructor(options: { contentDir: string }) {
      // Warn in production
      if (process.env.NODE_ENV === "production" || isServerless()) {
         console.warn(
            "\n⚠️  WARNING: DevFSAdapter is NOT suitable for production!\n" +
               "   Files will be lost on serverless platforms.\n" +
               "   Use GitAdapter or DatabaseAdapter instead.\n"
         );
      }
   }

   // Simple file operations without git commits
}
```

#### Database Adapter (PostgreSQL/SQLite)

**File**: `src/storage/database-adapter.ts`

**Use Case**: SSR sites, dynamic content, real-time updates

```typescript
export class DatabaseAdapter implements MicropubStorageAdapter {
   async createPost(entry: MicroformatsEntry): Promise<PostMetadata> {
      const slug = await this.generateUniqueSlug(entry);

      await this.db.query(
         `
      INSERT INTO micropub_posts (id, slug, type, properties, published)
      VALUES ($1, $2, $3, $4, $5)
    `,
         [
            generateId(),
            slug,
            entry.type[0],
            JSON.stringify(entry.properties), // Store full MF2 JSON
            new Date(entry.properties.published?.[0] || Date.now()),
         ]
      );

      return {
         url: new URL(`/posts/${slug}`, this.options.siteUrl).toString(),
         published: new Date(),
      };
   }
}
```

**Schema**:

```sql
CREATE TABLE micropub_posts (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  properties JSONB NOT NULL,
  published TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_published ON micropub_posts(published);
CREATE INDEX idx_slug ON micropub_posts(slug);
```

---

## API Specifications

### Micropub Endpoint

#### Create Post (form-encoded)

**Request**:

```http
POST /micropub HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
Content-Type: application/x-www-form-urlencoded

h=entry&content=Hello+World&category[]=indieweb&category[]=test&mp-slug=hello
```

**Response**:

```http
HTTP/1.1 201 Created
Location: https://example.com/posts/hello
Access-Control-Allow-Origin: *
```

#### Create Post (JSON)

**Request**:

```http
POST /micropub HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
Content-Type: application/json

{
  "type": ["h-entry"],
  "properties": {
    "name": ["My Post"],
    "content": ["Content"],
    "category": ["indieweb"],
    "mp-slug": ["my-post"],
    "post-status": ["published"]
  }
}
```

**Response**:

```http
HTTP/1.1 201 Created
Location: https://example.com/posts/my-post
Access-Control-Allow-Origin: *
```

#### Update Post (spec-compliant)

**Request**:

```http
POST /micropub HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
Content-Type: application/json

{
  "action": "update",
  "url": "https://example.com/posts/my-post",
  "replace": {
    "content": ["Updated content"]
  },
  "add": {
    "category": ["updated"]
  },
  "delete": ["syndication"]
}
```

**Response**:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
```

#### Delete Post

**Request**:

```http
POST /micropub HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
Content-Type: application/json

{
  "action": "delete",
  "url": "https://example.com/posts/my-post"
}
```

**Response**:

```http
HTTP/1.1 204 No Content
```

#### Query Config

**Request**:

```http
GET /micropub?q=config HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
```

**Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "media-endpoint": "https://example.com/micropub/media",
  "syndicate-to": [
    {
      "uid": "https://twitter.com/username",
      "name": "Twitter"
    }
  ]
}
```

#### Query Source

**Request**:

```http
GET /micropub?q=source&url=https://example.com/posts/my-post&properties[]=name&properties[]=content HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
```

**Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "type": ["h-entry"],
  "properties": {
    "name": ["My Post"],
    "content": ["Content"]
  }
}
```

---

### Media Endpoint

**Request**:

```http
POST /micropub/media HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

[binary data]
------WebKitFormBoundary--
```

**Response**:

```http
HTTP/1.1 201 Created
Location: https://example.com/media/2025/01/abc123-photo.jpg
Access-Control-Allow-Origin: *
```

---

## Configuration Schema

### Full Configuration Example (v1.0)

```typescript
// astro.config.mjs
import { defineConfig } from "astro/config";
import micropub from "astro-micropub";
import { GitAdapter } from "astro-micropub/storage";

export default defineConfig({
   site: "https://example.com", // REQUIRED

   integrations: [
      micropub({
         micropub: {
            endpoint: "/micropub",
            mediaEndpoint: "/micropub/media",
            enableUpdates: true,
            enableDeletes: true,
            syndicationTargets: [
               { uid: "https://twitter.com/user", name: "Twitter" },
            ],
         },

         // EXTERNAL IndieAuth endpoints (REQUIRED)
         indieauth: {
            authorizationEndpoint: "https://indieauth.com/auth",
            tokenEndpoint: "https://tokens.indieauth.com/token",
            tokenVerificationCache: 120,
         },

         storage: {
            adapter: new GitAdapter({
               contentDir: "src/content/posts",
               authorName: "Micropub Bot",
               authorEmail: "bot@example.com",
               deployHook: process.env.NETLIFY_BUILD_HOOK,
               siteUrl: "https://example.com",
            }),
         },

         discovery: {
            enabled: true,
            includeHeaders: true,
         },

         security: {
            requireScope: true,
            allowedOrigins: [
               "https://quill.p3k.io",
               "https://indigenous.realize.be",
            ],
            maxUploadSize: 10 * 1024 * 1024,
            allowedMimeTypes: [
               "image/jpeg",
               "image/png",
               "image/gif",
               "image/webp",
            ],
            rateLimit: {
               windowMs: 15 * 60 * 1000,
               maxRequests: 100,
            },
         },

         site: {
            me: "https://example.com/",
            name: "My Blog",
            author: {
               name: "John Doe",
               url: "https://example.com/",
            },
         },
      }),
   ],
});
```

---

## Implementation Phases (Revised for v1.0)

### Phase 1: Foundation (Week 1)

**Goal**: Project structure and storage layer

**Tasks**:

1. Set up project structure and TypeScript config
2. Define storage adapter interfaces
3. Implement GitAdapter with commit + deploy hooks
4. Implement DevFSAdapter with production warnings
5. Create integration entry point
6. Configuration schema with Zod validation
7. Validate external IndieAuth endpoints in config

**Deliverables**:

-  Storage interfaces
-  GitAdapter (production-ready)
-  DevFSAdapter (dev-only)
-  Integration skeleton
-  Config validation

---

### Phase 2: Micropub Core (Week 2)

**Goal**: Basic create endpoint

**Tasks**:

1. Implement POST /micropub endpoint
2. Form-encoded parser (bracket notation support)
3. JSON parser
4. Multipart parser (if no media endpoint)
5. Post creation logic
6. Slug generation (respect mp-slug, ensure uniqueness)
7. RFC 6750 error handling
8. CORS support (OPTIONS preflight)
9. Route injection

**Deliverables**:

-  Working POST /micropub
-  Form, JSON, multipart support
-  Spec-compliant errors
-  CORS headers

---

### Phase 3: Token Verification (Week 3)

**Goal**: Authenticate requests via external IndieAuth

**Tasks**:

1. Implement token extraction (header + form body)
2. Implement verification HTTP request
3. Parse verification response (me, scope, client_id)
4. Add caching (60-120s)
5. Populate locals
6. Scope checking utilities
7. Test with tokens.indieauth.com

**Deliverables**:

-  Token verification library
-  Caching
-  Scope enforcement
-  Integration with routes

---

### Phase 4: Micropub Queries (Week 4)

**Goal**: Query endpoints

**Tasks**:

1. GET /micropub handler
2. Config query (q=config)
3. Source query (q=source) with absolute URL validation
4. Syndicate-to query
5. Property filtering (properties[] param)
6. Authentication on queries

**Deliverables**:

-  q=config
-  q=source with filtering
-  q=syndicate-to

---

### Phase 5: Update & Delete (Week 5)

**Goal**: Spec-compliant update/delete

**Tasks**:

1. Update action handler
2. Replace operations
3. Add operations
4. Delete operations (array OR object)
5. Deep equality for objects
6. Array vs scalar handling
7. Delete action (soft delete)
8. Undelete action
9. Strict scope checking
10.   Unit tests for update semantics

**Deliverables**:

-  action=update (spec-compliant)
-  action=delete/undelete
-  Comprehensive tests

---

### Phase 6: Media Endpoint (Week 6)

**Goal**: Secure media uploads

**Tasks**:

1. Media endpoint route
2. Streaming multipart parser
3. File type validation
4. Size limits
5. Hash-based filename generation
6. Filesystem media adapter
7. Optional S3/R2 adapter
8. Require "media" scope
9. Absolute URLs
10.   Update config query

**Deliverables**:

-  POST /micropub/media
-  Streaming uploads
-  Security hardening

---

### Phase 7: Micropub Extensions (Week 7)

**Goal**: Micropub-specific properties

**Tasks**:

1. mp-slug handling
2. post-status (draft/published)
3. visibility
4. mp-photo-alt
5. mp-syndicate-to
6. Preserve in frontmatter
7. Documentation

**Deliverables**:

-  Support for mp-\* properties
-  Examples

---

### Phase 8: Discovery (Week 8)

**Goal**: Endpoint discovery

**Tasks**:

1. MicropubDiscovery component
2. Link rel tags
3. HTTP Link headers
4. Absolute URLs
5. Test with clients
6. Documentation

**Deliverables**:

-  Discovery component
-  HTTP headers
-  Client compatibility

---

### Phase 9: Testing & Compliance (Week 9)

**Goal**: Production readiness

**Tasks**:

1. micropub.rocks testing
2. Real client testing (Quill, Indigenous)
3. Unit tests
4. Integration tests
5. Update/delete edge cases
6. Multi-adapter testing
7. CORS testing
8. Deployment docs

**Deliverables**:

-  Pass micropub.rocks
-  Working with clients
-  Test suite
-  Deployment guides

---

### Phase 10: Polish & Release (Week 10)

**Goal**: v1.0 release

**Tasks**:

1. Comprehensive error handling
2. Rate limiting
3. Logging
4. Documentation
5. Example projects
6. TypeScript docs
7. npm publish
8. Adapter templates
9. Migration guides

**Deliverables**:

-  Complete documentation
-  Example projects
-  npm package
-  v1.0 release

---

## File Structure

```
astro-micropub/
├── src/
│   ├── integration.ts                 # Main entry point
│   │
│   ├── routes/
│   │   ├── micropub.ts               # Micropub endpoint
│   │   └── media.ts                  # Media endpoint
│   │
│   ├── lib/
│   │   ├── token-verification.ts     # Token verification
│   │   ├── parsers.ts                # Request parsers
│   │   └── utils.ts                  # Utilities
│   │
│   ├── components/
│   │   └── MicropubDiscovery.astro   # Discovery component
│   │
│   ├── storage/
│   │   ├── adapter.ts                # Interfaces
│   │   ├── git-adapter.ts            # Git adapter (default)
│   │   ├── dev-fs-adapter.ts         # Dev adapter
│   │   ├── database-adapter.ts       # DB adapter
│   │   └── media/
│   │       ├── adapter.ts
│   │       ├── filesystem.ts
│   │       └── s3.ts
│   │
│   ├── validators/
│   │   ├── micropub.ts
│   │   └── scopes.ts
│   │
│   └── types/
│       ├── micropub.ts
│       └── config.ts
│
├── examples/
│   ├── basic/
│   ├── git-netlify/
│   └── database-ssr/
│
├── test/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── docs/
│   ├── getting-started.md
│   ├── configuration.md
│   ├── storage-adapters.md
│   ├── deployment.md
│   └── api-reference.md
│
└── package.json
```

---

## Testing Strategy

### Unit Tests

**Coverage**:

-  Parsers (form-encoded with brackets, JSON, multipart)
-  Update operation semantics (replace/add/delete)
-  Slug generation and collision handling
-  Token verification and caching
-  CORS headers
-  Error response formatting

---

### Integration Tests

**Coverage**:

-  Full Micropub flow (create, query, update, delete)
-  Token verification with mock endpoint
-  Media upload
-  Storage adapters
-  Discovery

---

### Compliance Testing

**Tool**: micropub.rocks

**Coverage**:

-  All server tests
-  Update/delete semantics
-  Media endpoint
-  Query endpoints

---

### Manual Testing

**Clients**:

-  Quill (https://quill.p3k.io)
-  Indigenous (mobile)
-  Micropublish (https://micropublish.net)

---

## Security Considerations

### Authentication

-  RFC 6750 compliant WWW-Authenticate headers
-  Token verification against external endpoint
-  Verification caching (max 120s)
-  Never log tokens

### Scope Enforcement

-  Strict scope requirements (create, update, delete, media)
-  Scope checked per operation
-  Proper error responses with required scope

### File Uploads

-  Size limits (configurable)
-  MIME type whitelist
-  Streaming (no memory buffering)
-  Safe filename generation (hash-based)
-  Path traversal prevention

### Input Validation

-  Zod validation at boundaries
-  Sanitize HTML if configured
-  Validate absolute URLs
-  Prevent injection attacks

### Rate Limiting

-  Per-token and per-IP
-  Configurable windows and limits
-  Fail2ban compatible

### CORS

-  Configurable allowed origins
-  Proper preflight handling
-  Credentials support

---

## Documentation Requirements

### User Documentation

1. **Getting Started**

   -  Installation
   -  Basic configuration
   -  Using external IndieAuth (tokens.indieauth.com)
   -  First post with Quill

2. **Configuration Reference**

   -  All options explained
   -  Storage adapter configuration
   -  Security settings
   -  IndieAuth setup

3. **Storage Adapters**

   -  Git adapter (production default)
   -  Database adapter (SSR sites)
   -  Dev FS adapter (dev only)
   -  Custom adapter guide

4. **Deployment**
   -  Netlify + Git adapter
   -  Vercel + Git adapter
   -  SSR with database adapter
   -  Serverless considerations

---

## Required Dependencies

### Production Dependencies

| Package | Purpose |
|---------|---------|
| `astro-integration-kit` | Toolkit for building type-safe Astro integrations |
| `zod` | Schema validation for integration options and API inputs |
| `gray-matter` | Parsing and stringifying frontmatter in the GitAdapter |
| `slugify` | Generating URL-safe slugs from post titles |
| `busboy` (or similar) | Handling `multipart/form-data` for the media endpoint (streaming uploads) |

### Development & Peer Dependencies

| Package | Purpose |
|---------|---------|
| `astro` | The core framework (Peer Dependency) |
| `typescript` | Language support |
| `vitest` | Unit testing framework |
| `playwright` | End-to-end testing for Micropub flows |
| `@types/node` | Type definitions for Node.js built-ins (needed for `child_process` in GitAdapter) |

### System Requirements (for GitAdapter)

- **Node.js Runtime**: The `GitAdapter` relies on `child_process.execSync` and file system access, requiring a Node.js environment (or compatible runtime like Bun/Deno if supported later).
- **Git**: The `git` binary must be available in the system PATH for the `GitAdapter` to commit and push changes.

---

## Reference Materials

### Specifications

1. Micropub: https://www.w3.org/TR/micropub/
2. IndieAuth: https://indieauth.spec.indieweb.org/
3. Microformats2: http://microformats.org/wiki/microformats2
4. OAuth 2.0: https://tools.ietf.org/html/rfc6749
5. RFC 6750 (Bearer Token): https://tools.ietf.org/html/rfc6750

### Testing

1. micropub.rocks: https://micropub.rocks/
2. indieauth.rocks: https://indieauth.rocks/

### IndieWeb

1. Micropub: https://indieweb.org/Micropub
2. IndieAuth: https://indieweb.org/IndieAuth

### Astro

1. Integration API: https://docs.astro.build/en/reference/integrations-reference/
2. Middleware: https://docs.astro.build/en/guides/middleware/

---

## Success Criteria

### v1.0 Requirements

-  ✅ Create posts via Micropub
-  ✅ Update and delete posts
-  ✅ Media endpoint
-  ✅ Token verification (external)
-  ✅ Git adapter with deploy hooks
-  ✅ Pass micropub.rocks tests
-  ✅ Works with Quill and Indigenous
-  ✅ CORS support
-  ✅ RFC 6750 compliance
-  ✅ Production-ready documentation

### Future (v2.0+)

-  Built-in IndieAuth server (optional)
-  Syndication (POSSE)
-  Multi-user support
-  Admin UI
-  Webmention integration

---

_Last Updated: 2025-01-18_
_Version: 1.0 (Revised with Oracle feedback)_
