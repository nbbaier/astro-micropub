# Astro Micropub Integration - Detailed Implementation Plan

## Project Overview

**Name**: `astro-micropub`

**Purpose**: A complete Micropub implementation for Astro projects, enabling third-party clients to create, update, and delete content on Astro sites.

**Compliance**: Full W3C Micropub specification compliance + IndieAuth integration for authentication.

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
10. [Reference Materials](#reference-materials)

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      Third-Party Clients                         │
│              (Quill, Indigenous, Micropublish, etc.)             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Endpoint Discovery                          │
│         <link rel="micropub" href="/micropub">                  │
│         <link rel="authorization_endpoint" ...>                 │
│         <link rel="token_endpoint" ...>                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Authentication Middleware                      │
│          - Bearer token validation                              │
│          - Scope verification (create, update, delete)          │
│          - Token introspection support                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┬──────────────┐
         ▼             ▼             ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐
│   Micropub   │ │  Media   │ │  Token   │ │ Authorization  │
│   Endpoint   │ │ Endpoint │ │ Endpoint │ │   Endpoint     │
│  /micropub   │ │ /media   │ │ /token   │ │    /auth       │
└──────┬───────┘ └────┬─────┘ └────┬─────┘ └────────┬────────┘
       │              │            │                 │
       ▼              ▼            ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Storage Adapter Layer                        │
│                    (Pluggable Interface)                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┬──────────────┐
         ▼             ▼             ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│   Content    │ │ Database │ │   CMS    │ │    Custom    │
│ Collections  │ │ Adapter  │ │ Adapter  │ │   Adapter    │
│  (Default)   │ │          │ │          │ │              │
└──────────────┘ └──────────┘ └──────────┘ └──────────────┘
```

### Core Principles

1. **Spec Compliance**: Full W3C Micropub + IndieAuth compliance
2. **Pluggable Storage**: Abstract storage layer for maximum flexibility
3. **Type Safety**: Full TypeScript support with Zod validation
4. **Developer Experience**: Simple configuration with sane defaults
5. **Security First**: Proper token validation, scope enforcement, CSRF protection
6. **Production Ready**: Error handling, logging, rate limiting

---

## Components Breakdown

### 1. Integration Entry Point

**File**: `src/integration.ts`

**Responsibilities**:
- Define integration using `astro-integration-kit`
- Parse and validate user configuration
- Inject routes and middleware
- Add discovery `<link>` tags to HTML head
- Configure Vite for runtime config access

**Key Hooks**:
- `astro:config:setup` - Primary setup hook
  - `injectRoute()` - Add Micropub, media, token, auth endpoints
  - `addMiddleware()` - Add authentication middleware
  - `updateConfig()` - Inject configuration via Vite defines
  - `injectScript()` - Add discovery meta tags to pages

**Configuration Interface**:
```typescript
{
  micropub: {
    endpoint: string;           // Default: "/micropub"
    mediaEndpoint: string;      // Default: "/micropub/media"
    enableUpdates: boolean;     // Default: true
    enableDeletes: boolean;     // Default: true
  },
  indieauth: {
    authEndpoint: string;       // Default: "/indieauth/auth"
    tokenEndpoint: string;      // Default: "/indieauth/token"
    clientId: string;           // Site URL
    secret: string;             // JWT signing secret
  },
  storage: {
    adapter: StorageAdapter;    // Default: ContentCollectionAdapter
    options: object;            // Adapter-specific config
  },
  discovery: {
    enabled: boolean;           // Default: true
    includeOnPages: string[];   // Default: ["*"]
  },
  security: {
    requireScope: boolean;      // Default: true
    allowedOrigins: string[];   // CORS configuration
    rateLimit?: {
      windowMs: number;
      maxRequests: number;
    }
  }
}
```

---

### 2. Micropub Endpoint

**File**: `src/routes/micropub.ts`

**Route**: Configured via `options.micropub.endpoint` (default `/micropub`)

**Supported Methods**: GET, POST

**Responsibilities**:

#### GET Requests (Query Endpoint)
1. **Configuration Query** (`q=config`)
   - Return media endpoint URL
   - Return syndication targets (if configured)
   - Return supported queries

2. **Source Query** (`q=source&url=...`)
   - Retrieve post content by URL
   - Support property filtering (`properties[]=name&properties[]=content`)
   - Return Microformats2 JSON representation

3. **Syndicate-to Query** (`q=syndicate-to`)
   - Return list of syndication targets (Twitter, Mastodon, etc.)

#### POST Requests (Create/Update/Delete)

1. **Create Posts**
   - Accept `application/x-www-form-urlencoded`
   - Accept `application/json`
   - Accept `multipart/form-data` (if no separate media endpoint)
   - Validate h-entry vocabulary
   - Generate slug from title or create date-based slug
   - Save via storage adapter
   - Return `201 Created` with `Location` header

2. **Update Posts** (if enabled)
   - Require JSON format
   - Support `replace`, `add`, `delete` operations
   - Validate `url` parameter
   - Apply updates via storage adapter
   - Return `200 OK` or `204 No Content`

3. **Delete Posts** (if enabled)
   - Support both form-encoded and JSON
   - Require `action=delete` and `url`
   - Soft delete via storage adapter
   - Return `200 OK` or `204 No Content`

4. **Undelete Posts** (if enabled)
   - Support `action=undelete` and `url`
   - Restore via storage adapter

**Request Flow**:
```typescript
export const prerender = false;

export const GET: APIRoute = async ({ request, url, locals }) => {
  // 1. Validate authentication (from middleware)
  if (!locals.isAuthorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse query parameter
  const query = url.searchParams.get("q");

  // 3. Route to appropriate handler
  switch (query) {
    case "config":
      return handleConfigQuery(locals);
    case "source":
      return handleSourceQuery(url, locals);
    case "syndicate-to":
      return handleSyndicateToQuery(locals);
    default:
      return new Response("Invalid query", { status: 400 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Validate authentication
  if (!locals.isAuthorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Check scopes
  if (!locals.scopes.includes("create")) {
    return new Response("Insufficient scope", { status: 403 });
  }

  // 3. Parse content type
  const contentType = request.headers.get("content-type");

  // 4. Parse request body
  const data = await parseRequestBody(request, contentType);

  // 5. Determine action
  if (data.action) {
    return handleAction(data, locals);
  }

  // 6. Create new post
  return handleCreatePost(data, locals);
};
```

**Error Responses**:
- 400 Bad Request - Invalid request format
- 401 Unauthorized - Missing or invalid token
- 403 Forbidden - Insufficient scope
- 404 Not Found - Post not found (for updates/deletes)
- 500 Internal Server Error - Storage adapter failure

---

### 3. Media Endpoint

**File**: `src/routes/media.ts`

**Route**: Configured via `options.micropub.mediaEndpoint` (default `/micropub/media`)

**Supported Methods**: POST

**Responsibilities**:
- Accept `multipart/form-data` uploads
- Validate file types (images, audio, video)
- Process and optimize media (optional)
- Store files via media storage adapter
- Return `201 Created` with `Location` header containing file URL

**Request Flow**:
```typescript
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Validate authentication
  if (!locals.isAuthorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Check media scope
  if (!locals.scopes.includes("media") && !locals.scopes.includes("create")) {
    return new Response("Insufficient scope", { status: 403 });
  }

  // 3. Parse multipart form data
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return new Response("No file provided", { status: 400 });
  }

  // 4. Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return new Response("Invalid file type", { status: 400 });
  }

  // 5. Generate unique filename
  const filename = await generateMediaFilename(file);

  // 6. Save via media storage adapter
  const url = await locals.mediaStorage.saveFile(file, filename);

  // 7. Return success
  return new Response(null, {
    status: 201,
    headers: {
      "Location": url,
    },
  });
};
```

**Storage Options**:
- Local filesystem (`public/media/`)
- Cloud storage (S3, Cloudflare R2, etc.)
- CDN integration

---

### 4. IndieAuth Token Endpoint

**File**: `src/routes/indieauth/token.ts`

**Route**: Configured via `options.indieauth.tokenEndpoint` (default `/indieauth/token`)

**Supported Methods**: POST

**Responsibilities**:

#### Token Issuance
1. Receive authorization code from authorization endpoint
2. Validate code hasn't expired (10 min max lifetime)
3. Verify `client_id`, `redirect_uri`, `code_verifier` (PKCE)
4. Generate access token (JWT or opaque token)
5. Store token with metadata (user, scopes, expiration)
6. Return token response

**Response Format**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "scope": "create update delete media",
  "me": "https://example.com/",
  "expires_in": 3600
}
```

#### Token Introspection
1. Accept token introspection requests (POST with token parameter)
2. Validate token signature and expiration
3. Return token metadata

**Introspection Response**:
```json
{
  "active": true,
  "me": "https://example.com/",
  "client_id": "https://quill.p3k.io/",
  "scope": "create update delete",
  "exp": 1234567890
}
```

**Implementation**:
```typescript
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const formData = await request.formData();
  
  // Check if this is token introspection or token request
  const token = formData.get("token");
  if (token) {
    return handleIntrospection(token, locals);
  }

  // Token request
  const grantType = formData.get("grant_type");
  if (grantType !== "authorization_code") {
    return new Response(JSON.stringify({
      error: "unsupported_grant_type"
    }), { status: 400 });
  }

  const code = formData.get("code");
  const clientId = formData.get("client_id");
  const redirectUri = formData.get("redirect_uri");
  const codeVerifier = formData.get("code_verifier");

  // Validate authorization code
  const authData = await locals.tokenStorage.getAuthCode(code);
  if (!authData || authData.expiresAt < Date.now()) {
    return new Response(JSON.stringify({
      error: "invalid_grant"
    }), { status: 400 });
  }

  // Verify PKCE
  if (!verifyPKCE(codeVerifier, authData.codeChallenge)) {
    return new Response(JSON.stringify({
      error: "invalid_grant"
    }), { status: 400 });
  }

  // Generate access token
  const accessToken = await generateAccessToken({
    me: authData.me,
    clientId: authData.clientId,
    scope: authData.scope,
  });

  return new Response(JSON.stringify({
    access_token: accessToken,
    token_type: "Bearer",
    scope: authData.scope,
    me: authData.me,
  }), {
    headers: { "Content-Type": "application/json" }
  });
};
```

---

### 5. IndieAuth Authorization Endpoint

**File**: `src/routes/indieauth/auth.ts`

**Route**: Configured via `options.indieauth.authEndpoint` (default `/indieauth/auth`)

**Supported Methods**: GET, POST

**Responsibilities**:

#### GET - Authorization Request
1. Parse OAuth parameters (`response_type`, `client_id`, `redirect_uri`, `state`, `scope`, `code_challenge`)
2. Fetch and validate `client_id` URL
3. Extract client information (name, icon, redirect URLs)
4. Display authorization UI to user
5. Show requested scopes and client details

#### POST - Authorization Response
1. Authenticate user (session-based or password)
2. Get user consent for requested scopes
3. Generate authorization code
4. Store code with metadata (expires in 10 min)
5. Redirect to `redirect_uri` with code and state

**UI Template**: `src/components/AuthorizationPrompt.astro`

```astro
---
const { clientId, clientInfo, scopes, redirectUri, state, codeChallenge } = Astro.props;
---
<html>
  <head>
    <title>Authorize Application</title>
  </head>
  <body>
    <h1>Authorization Request</h1>
    
    <div class="client-info">
      <img src={clientInfo.icon} alt={clientInfo.name} />
      <h2>{clientInfo.name}</h2>
      <p>{clientInfo.url}</p>
    </div>

    <p>This application is requesting permission to:</p>
    <ul>
      {scopes.map(scope => (
        <li>{scope === 'create' ? 'Create posts' : scope}</li>
      ))}
    </ul>

    <form method="POST">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="code_challenge" value={codeChallenge} />
      <input type="hidden" name="scope" value={scopes.join(' ')} />
      
      <button type="submit" name="action" value="approve">Approve</button>
      <button type="submit" name="action" value="deny">Deny</button>
    </form>
  </body>
</html>
```

**Implementation**:
```typescript
export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "plain";

  // Validate required parameters
  if (!responseType || !clientId || !redirectUri) {
    return new Response("Missing required parameters", { status: 400 });
  }

  if (responseType !== "code") {
    return new Response("Invalid response_type", { status: 400 });
  }

  // Fetch client information
  const clientInfo = await fetchClientInfo(clientId);

  // Validate redirect_uri
  if (!validateRedirectUri(redirectUri, clientId, clientInfo)) {
    return new Response("Invalid redirect_uri", { status: 400 });
  }

  // Render authorization prompt
  return renderAuthPrompt({
    clientId,
    clientInfo,
    redirectUri,
    state,
    scope: scope?.split(" ") || [],
    codeChallenge,
    codeChallengeMethod,
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "deny") {
    const redirectUri = formData.get("redirect_uri");
    const state = formData.get("state");
    return Response.redirect(
      `${redirectUri}?error=access_denied&state=${state}`
    );
  }

  // User approved - generate authorization code
  const code = await generateAuthCode({
    clientId: formData.get("client_id"),
    redirectUri: formData.get("redirect_uri"),
    scope: formData.get("scope"),
    codeChallenge: formData.get("code_challenge"),
    me: locals.user.url, // From session
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  // Redirect back to client
  const redirectUri = formData.get("redirect_uri");
  const state = formData.get("state");
  return Response.redirect(`${redirectUri}?code=${code}&state=${state}`);
};
```

---

### 6. Authentication Middleware

**File**: `src/middleware/auth.ts`

**Responsibilities**:
- Extract Bearer token from Authorization header or form body
- Validate token signature and expiration
- Load token metadata (user, scopes, client)
- Add authentication info to `locals`
- Handle token introspection for external verification

**Implementation**:
```typescript
import { defineMiddleware } from "astro/middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  // Skip authentication for non-Micropub routes
  if (!context.url.pathname.startsWith("/micropub") && 
      !context.url.pathname.startsWith("/indieauth")) {
    return next();
  }

  // Extract token
  let token: string | null = null;
  
  // Check Authorization header
  const authHeader = context.request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  
  // Check form body for form-encoded requests
  if (!token && context.request.method === "POST") {
    const contentType = context.request.headers.get("content-type");
    if (contentType?.includes("application/x-www-form-urlencoded")) {
      const formData = await context.request.clone().formData();
      token = formData.get("access_token") as string;
    }
  }

  // No token provided
  if (!token) {
    context.locals.isAuthorized = false;
    context.locals.scopes = [];
    return next();
  }

  // Validate token
  try {
    const tokenData = await validateToken(token);
    
    context.locals.isAuthorized = true;
    context.locals.me = tokenData.me;
    context.locals.clientId = tokenData.clientId;
    context.locals.scopes = tokenData.scope.split(" ");
    context.locals.tokenExpiry = tokenData.exp;
  } catch (error) {
    context.locals.isAuthorized = false;
    context.locals.scopes = [];
  }

  return next();
});
```

---

### 7. Discovery Component

**File**: `src/components/MicropubDiscovery.astro`

**Purpose**: Add discovery `<link>` tags to site pages

**Injection**: Via `injectScript` in integration setup

**Output**:
```html
<link rel="micropub" href="/micropub">
<link rel="micropub_media" href="/micropub/media">
<link rel="authorization_endpoint" href="/indieauth/auth">
<link rel="token_endpoint" href="/indieauth/token">
```

**Implementation**:
```astro
---
const config = import.meta.env.MICROPUB_CONFIG;
const { micropub, indieauth } = config;
---

<link rel="micropub" href={micropub.endpoint} />
{micropub.mediaEndpoint && (
  <link rel="micropub_media" href={micropub.mediaEndpoint} />
)}
<link rel="authorization_endpoint" href={indieauth.authEndpoint} />
<link rel="token_endpoint" href={indieauth.tokenEndpoint} />
```

---

## Storage Architecture

### Storage Adapter Interface

**File**: `src/storage/adapter.ts`

```typescript
import type { z } from "astro/zod";

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
 * Update operation types
 */
export type UpdateOperation = 
  | { action: "replace"; property: string; value: any[] }
  | { action: "add"; property: string; value: any[] }
  | { action: "delete"; property: string; value?: any[] };

/**
 * Post metadata returned by storage
 */
export interface PostMetadata {
  url: string;
  published: Date;
  modified?: Date;
  deleted?: boolean;
}

/**
 * Core storage adapter interface
 */
export interface MicropubStorageAdapter {
  /**
   * Create a new post
   * @param entry - Microformats2 entry data
   * @returns Post metadata including final URL
   */
  createPost(entry: MicroformatsEntry): Promise<PostMetadata>;

  /**
   * Get a post by URL
   * @param url - Post URL
   * @param properties - Optional array of properties to retrieve
   * @returns Microformats2 entry or null if not found
   */
  getPost(url: string, properties?: string[]): Promise<MicroformatsEntry | null>;

  /**
   * Update a post
   * @param url - Post URL
   * @param operations - Array of update operations
   * @returns Updated post metadata
   */
  updatePost(url: string, operations: UpdateOperation[]): Promise<PostMetadata>;

  /**
   * Delete a post (soft delete)
   * @param url - Post URL
   */
  deletePost(url: string): Promise<void>;

  /**
   * Undelete a post
   * @param url - Post URL
   */
  undeletePost(url: string): Promise<void>;
}

/**
 * Media storage adapter interface
 */
export interface MediaStorageAdapter {
  /**
   * Save uploaded file
   * @param file - File object
   * @param filename - Target filename
   * @returns Public URL of saved file
   */
  saveFile(file: File, filename: string): Promise<string>;

  /**
   * Delete a file
   * @param url - File URL
   */
  deleteFile(url: string): Promise<void>;
}

/**
 * Token storage adapter interface
 */
export interface TokenStorageAdapter {
  /**
   * Store authorization code
   */
  saveAuthCode(code: string, data: AuthCodeData): Promise<void>;

  /**
   * Get authorization code data
   */
  getAuthCode(code: string): Promise<AuthCodeData | null>;

  /**
   * Delete authorization code (after use)
   */
  deleteAuthCode(code: string): Promise<void>;

  /**
   * Store access token
   */
  saveAccessToken(token: string, data: TokenData): Promise<void>;

  /**
   * Get access token data
   */
  getAccessToken(token: string): Promise<TokenData | null>;

  /**
   * Revoke access token
   */
  revokeAccessToken(token: string): Promise<void>;
}
```

---

### Default Storage Adapter: Content Collections

**File**: `src/storage/content-collection-adapter.ts`

**Strategy**:
- Create markdown files in `src/content/posts/`
- Use frontmatter for Microformats properties
- Generate slugs from title or date
- Support YAML frontmatter format

**Post Format**:
```markdown
---
type: h-entry
name: "My First Post"
published: 2025-01-15T10:30:00Z
category:
  - indieweb
  - micropub
photo:
  - url: /media/photo.jpg
    alt: A beautiful sunset
---

This is the post content in markdown format.
```

**Implementation**:
```typescript
import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";

export class ContentCollectionAdapter implements MicropubStorageAdapter {
  private contentDir: string;

  constructor(options: { contentDir?: string } = {}) {
    this.contentDir = options.contentDir || "src/content/posts";
  }

  async createPost(entry: MicroformatsEntry): Promise<PostMetadata> {
    const slug = this.generateSlug(entry);
    const { frontmatter, content } = this.convertToMarkdown(entry);
    
    const fileContent = matter.stringify(content, frontmatter);
    const filePath = join(this.contentDir, `${slug}.md`);
    
    await writeFile(filePath, fileContent, "utf-8");

    return {
      url: `/posts/${slug}`,
      published: new Date(frontmatter.published),
    };
  }

  async getPost(url: string, properties?: string[]): Promise<MicroformatsEntry | null> {
    const slug = this.extractSlugFromUrl(url);
    const filePath = join(this.contentDir, `${slug}.md`);

    try {
      const fileContent = await readFile(filePath, "utf-8");
      const { data, content } = matter(fileContent);

      return this.convertToMicroformats(data, content, properties);
    } catch (error) {
      return null;
    }
  }

  async updatePost(url: string, operations: UpdateOperation[]): Promise<PostMetadata> {
    const slug = this.extractSlugFromUrl(url);
    const filePath = join(this.contentDir, `${slug}.md`);

    const fileContent = await readFile(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    // Apply update operations
    for (const op of operations) {
      this.applyOperation(data, op);
    }

    data.modified = new Date().toISOString();

    const updated = matter.stringify(content, data);
    await writeFile(filePath, updated, "utf-8");

    return {
      url,
      published: new Date(data.published),
      modified: new Date(data.modified),
    };
  }

  async deletePost(url: string): Promise<void> {
    const slug = this.extractSlugFromUrl(url);
    const filePath = join(this.contentDir, `${slug}.md`);

    const fileContent = await readFile(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    data.deleted = true;
    data.modified = new Date().toISOString();

    const updated = matter.stringify(content, data);
    await writeFile(filePath, updated, "utf-8");
  }

  async undeletePost(url: string): Promise<void> {
    const slug = this.extractSlugFromUrl(url);
    const filePath = join(this.contentDir, `${slug}.md`);

    const fileContent = await readFile(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    delete data.deleted;
    data.modified = new Date().toISOString();

    const updated = matter.stringify(content, data);
    await writeFile(filePath, updated, "utf-8");
  }

  private generateSlug(entry: MicroformatsEntry): string {
    // Try to use name/title first
    const name = entry.properties.name?.[0];
    if (name && typeof name === "string") {
      return slugify(name);
    }

    // Fall back to date-based slug
    const published = entry.properties.published?.[0] || new Date().toISOString();
    const date = new Date(published);
    const timestamp = date.getTime();
    return `entry-${timestamp}`;
  }

  private convertToMarkdown(entry: MicroformatsEntry): { frontmatter: any; content: string } {
    const frontmatter: any = {
      type: entry.type[0],
      published: entry.properties.published?.[0] || new Date().toISOString(),
    };

    let content = "";

    // Extract content
    if (entry.properties.content) {
      const contentValue = entry.properties.content[0];
      if (typeof contentValue === "string") {
        content = contentValue;
      } else if (contentValue.markdown) {
        content = contentValue.markdown;
      } else if (contentValue.html) {
        content = turndownService.turndown(contentValue.html);
      } else if (contentValue.value) {
        content = contentValue.value;
      }
    }

    // Map other properties
    const skipProperties = ["content", "published"];
    for (const [key, values] of Object.entries(entry.properties)) {
      if (!skipProperties.includes(key)) {
        frontmatter[key] = values.length === 1 ? values[0] : values;
      }
    }

    return { frontmatter, content };
  }

  private convertToMicroformats(data: any, content: string, properties?: string[]): MicroformatsEntry {
    const entry: MicroformatsEntry = {
      type: [data.type || "h-entry"],
      properties: {
        published: [data.published],
        content: [{ markdown: content, value: content }],
      },
    };

    // Add other properties
    for (const [key, value] of Object.entries(data)) {
      if (key !== "type" && key !== "published") {
        entry.properties[key] = Array.isArray(value) ? value : [value];
      }
    }

    // Filter properties if requested
    if (properties && properties.length > 0) {
      const filtered: any = {};
      for (const prop of properties) {
        if (entry.properties[prop]) {
          filtered[prop] = entry.properties[prop];
        }
      }
      entry.properties = filtered;
    }

    return entry;
  }

  private applyOperation(data: any, op: UpdateOperation): void {
    switch (op.action) {
      case "replace":
        data[op.property] = op.value;
        break;
      case "add":
        if (!data[op.property]) {
          data[op.property] = [];
        }
        if (!Array.isArray(data[op.property])) {
          data[op.property] = [data[op.property]];
        }
        data[op.property].push(...op.value);
        break;
      case "delete":
        if (op.value) {
          data[op.property] = data[op.property].filter(
            (v: any) => !op.value.includes(v)
          );
        } else {
          delete data[op.property];
        }
        break;
    }
  }

  private extractSlugFromUrl(url: string): string {
    const match = url.match(/\/posts\/(.+?)(?:\/|$)/);
    return match ? match[1] : url;
  }
}
```

---

### Alternative Adapters

#### Database Adapter Template

**File**: `src/storage/database-adapter.ts`

```typescript
export class DatabaseAdapter implements MicropubStorageAdapter {
  private db: Database; // Generic DB interface

  constructor(connectionString: string) {
    this.db = connectToDatabase(connectionString);
  }

  async createPost(entry: MicroformatsEntry): Promise<PostMetadata> {
    const id = generateId();
    const slug = this.generateSlug(entry);

    await this.db.posts.insert({
      id,
      slug,
      type: entry.type[0],
      properties: JSON.stringify(entry.properties),
      published: new Date(entry.properties.published?.[0]),
      deleted: false,
    });

    return {
      url: `/posts/${slug}`,
      published: new Date(entry.properties.published?.[0]),
    };
  }

  // ... implement other methods
}
```

---

## API Specifications

### Micropub Endpoint API

#### Create Post (form-encoded)

**Request**:
```http
POST /micropub HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
Content-Type: application/x-www-form-urlencoded

h=entry
&content=Hello+World
&category[]=indieweb
&category[]=test
```

**Response**:
```http
HTTP/1.1 201 Created
Location: https://example.com/posts/hello-world
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
    "name": ["My Post Title"],
    "content": ["This is the post content"],
    "category": ["indieweb", "micropub"],
    "published": ["2025-01-15T10:30:00Z"]
  }
}
```

**Response**:
```http
HTTP/1.1 201 Created
Location: https://example.com/posts/my-post-title
```

#### Update Post

**Request**:
```http
POST /micropub HTTP/1.1
Host: example.com
Authorization: Bearer xxxxx
Content-Type: application/json

{
  "action": "update",
  "url": "https://example.com/posts/my-post-title",
  "replace": {
    "content": ["Updated content"]
  },
  "add": {
    "category": ["updated"]
  },
  "delete": {
    "category": ["test"]
  }
}
```

**Response**:
```http
HTTP/1.1 200 OK
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
  "url": "https://example.com/posts/my-post-title"
}
```

**Response**:
```http
HTTP/1.1 200 OK
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
GET /micropub?q=source&url=https://example.com/posts/my-post HTTP/1.1
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
    "name": ["My Post Title"],
    "content": ["Post content"],
    "published": ["2025-01-15T10:30:00Z"]
  }
}
```

---

### Media Endpoint API

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
Location: https://example.com/media/2025/01/photo-abc123.jpg
```

---

### IndieAuth Token Endpoint API

#### Token Request

**Request**:
```http
POST /indieauth/token HTTP/1.1
Host: example.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=xxxx
&client_id=https://app.example.com/
&redirect_uri=https://app.example.com/callback
&code_verifier=xxxxx
```

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "scope": "create update delete",
  "me": "https://example.com/"
}
```

#### Token Introspection

**Request**:
```http
POST /indieauth/token HTTP/1.1
Host: example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Bearer xxxxx

token=xxxxx
```

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "active": true,
  "me": "https://example.com/",
  "client_id": "https://app.example.com/",
  "scope": "create update delete",
  "exp": 1234567890
}
```

---

## Configuration Schema

### Full Configuration Example

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import micropub from 'astro-micropub';

export default defineConfig({
  integrations: [
    micropub({
      // Micropub configuration
      micropub: {
        endpoint: "/micropub",              // Default
        mediaEndpoint: "/micropub/media",   // Default
        enableUpdates: true,                // Default
        enableDeletes: true,                // Default
        syndicationTargets: [
          {
            uid: "https://twitter.com/username",
            name: "Twitter",
          },
          {
            uid: "https://mastodon.social/@username",
            name: "Mastodon",
          },
        ],
      },

      // IndieAuth configuration
      indieauth: {
        authEndpoint: "/indieauth/auth",    // Default
        tokenEndpoint: "/indieauth/token",  // Default
        secret: process.env.INDIEAUTH_SECRET, // Required
        tokenExpiration: 3600,              // Seconds, default 1 hour
        codeExpiration: 600,                // Seconds, default 10 min
        allowedClients: [                   // Optional whitelist
          "https://quill.p3k.io/",
          "https://indigenous.realize.be/",
        ],
      },

      // Storage configuration
      storage: {
        // Use default content collection adapter
        adapter: "content-collection",  // or provide custom adapter
        options: {
          contentDir: "src/content/posts",
          mediaDir: "public/media",
        },
      },

      // Discovery configuration
      discovery: {
        enabled: true,                      // Default
        includeOnPages: ["*"],              // All pages
        // or specific pages: ["/", "/blog/**"]
      },

      // Security configuration
      security: {
        requireScope: true,                 // Default
        allowedOrigins: ["*"],              // CORS
        rateLimit: {
          windowMs: 15 * 60 * 1000,        // 15 minutes
          maxRequests: 100,                 // Max 100 requests per window
        },
      },

      // User authentication (for authorization endpoint)
      auth: {
        // Simple password authentication
        type: "password",
        credentials: {
          username: process.env.SITE_USERNAME,
          password: process.env.SITE_PASSWORD,
        },
        
        // Or session-based
        // type: "session",
        // sessionSecret: process.env.SESSION_SECRET,
      },

      // Site configuration
      site: {
        me: "https://example.com/",
        name: "My Awesome Blog",
        author: {
          name: "John Doe",
          photo: "/avatar.jpg",
          url: "https://example.com/",
        },
      },
    }),
  ],
});
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Basic integration structure and storage layer

**Tasks**:
1. ✅ Set up project structure
2. ✅ Define TypeScript interfaces
3. ✅ Implement storage adapter interface
4. ✅ Build content collection adapter
5. ✅ Create integration entry point
6. ✅ Add basic configuration schema

**Deliverables**:
- Storage adapter interface
- Content collection adapter implementation
- Integration skeleton
- Configuration validation with Zod

---

### Phase 2: Micropub Core (Week 2)

**Goal**: Basic Micropub endpoint with create support

**Tasks**:
1. ✅ Implement Micropub POST endpoint
2. ✅ Add form-encoded parser
3. ✅ Add JSON parser
4. ✅ Implement post creation
5. ✅ Add slug generation
6. ✅ Implement error handling
7. ✅ Add route injection in integration

**Deliverables**:
- Working POST /micropub for creating posts
- Support for both form-encoded and JSON
- Proper error responses

**Test Cases**:
```bash
# Create note (form-encoded)
curl -X POST https://example.com/micropub \
  -H "Authorization: Bearer test-token" \
  -d "h=entry" \
  -d "content=Hello World"

# Create article (JSON)
curl -X POST https://example.com/micropub \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "type": ["h-entry"],
    "properties": {
      "name": ["My Article"],
      "content": ["Article content"]
    }
  }'
```

---

### Phase 3: Micropub Queries (Week 3)

**Goal**: Implement query endpoints

**Tasks**:
1. ✅ Implement GET /micropub handler
2. ✅ Add config query (q=config)
3. ✅ Add source query (q=source)
4. ✅ Add syndicate-to query
5. ✅ Implement property filtering for source query

**Deliverables**:
- GET /micropub?q=config
- GET /micropub?q=source&url=...
- GET /micropub?q=syndicate-to

**Test Cases**:
```bash
# Query config
curl https://example.com/micropub?q=config \
  -H "Authorization: Bearer test-token"

# Query source
curl "https://example.com/micropub?q=source&url=https://example.com/posts/test" \
  -H "Authorization: Bearer test-token"

# Query with property filter
curl "https://example.com/micropub?q=source&url=...&properties[]=name&properties[]=content" \
  -H "Authorization: Bearer test-token"
```

---

### Phase 4: Update & Delete (Week 4)

**Goal**: Implement update and delete actions

**Tasks**:
1. ✅ Implement update action handler
2. ✅ Support replace operations
3. ✅ Support add operations
4. ✅ Support delete operations
5. ✅ Implement delete action
6. ✅ Implement undelete action
7. ✅ Add scope checking for updates/deletes

**Deliverables**:
- POST /micropub with action=update
- POST /micropub with action=delete
- POST /micropub with action=undelete

**Test Cases**:
```bash
# Update post
curl -X POST https://example.com/micropub \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "url": "https://example.com/posts/test",
    "replace": { "content": ["Updated content"] }
  }'

# Delete post
curl -X POST https://example.com/micropub \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete",
    "url": "https://example.com/posts/test"
  }'
```

---

### Phase 5: Media Endpoint (Week 5)

**Goal**: Implement media upload endpoint

**Tasks**:
1. ✅ Create media endpoint route
2. ✅ Implement multipart/form-data parser
3. ✅ Add file type validation
4. ✅ Implement filename generation
5. ✅ Create local filesystem media adapter
6. ✅ Add media endpoint to config query
7. ✅ Update discovery links

**Deliverables**:
- POST /micropub/media
- Media storage adapter
- File upload support

**Test Cases**:
```bash
# Upload image
curl -X POST https://example.com/micropub/media \
  -H "Authorization: Bearer test-token" \
  -F "file=@photo.jpg"

# Create post with uploaded photo
curl -X POST https://example.com/micropub \
  -H "Authorization: Bearer test-token" \
  -d "h=entry" \
  -d "content=Check out this photo" \
  -d "photo=https://example.com/media/2025/01/photo.jpg"
```

---

### Phase 6: IndieAuth Token Endpoint (Week 6)

**Goal**: Implement token issuance and verification

**Tasks**:
1. ✅ Create token endpoint route
2. ✅ Implement authorization code validation
3. ✅ Add PKCE verification
4. ✅ Implement JWT token generation
5. ✅ Create token storage adapter
6. ✅ Implement token introspection
7. ✅ Add token to locals in middleware

**Deliverables**:
- POST /indieauth/token (token request)
- POST /indieauth/token (introspection)
- JWT-based access tokens
- Token storage

**Test Cases**:
```bash
# Exchange code for token
curl -X POST https://example.com/indieauth/token \
  -d "grant_type=authorization_code" \
  -d "code=xxx" \
  -d "client_id=https://app.example.com/" \
  -d "redirect_uri=https://app.example.com/callback" \
  -d "code_verifier=xxx"

# Introspect token
curl -X POST https://example.com/indieauth/token \
  -H "Authorization: Bearer xxx" \
  -d "token=xxx"
```

---

### Phase 7: IndieAuth Authorization Endpoint (Week 7)

**Goal**: Implement authorization UI and flow

**Tasks**:
1. ✅ Create authorization endpoint route
2. ✅ Implement client discovery
3. ✅ Validate redirect URIs
4. ✅ Build authorization UI component
5. ✅ Implement user authentication
6. ✅ Generate authorization codes
7. ✅ Handle PKCE challenge
8. ✅ Add authorization code storage

**Deliverables**:
- GET /indieauth/auth (authorization UI)
- POST /indieauth/auth (approval handler)
- Authorization prompt component
- User session management

---

### Phase 8: Authentication Middleware (Week 8)

**Goal**: Complete authentication and authorization

**Tasks**:
1. ✅ Implement middleware
2. ✅ Add token extraction from headers
3. ✅ Add token extraction from form body
4. ✅ Implement token validation
5. ✅ Add scope parsing and checking
6. ✅ Populate context.locals
7. ✅ Add middleware injection in integration

**Deliverables**:
- Working authentication middleware
- Token validation
- Scope enforcement

---

### Phase 9: Discovery & Integration (Week 9)

**Goal**: Complete the integration setup

**Tasks**:
1. ✅ Create discovery component
2. ✅ Add link injection to pages
3. ✅ Implement endpoint discovery
4. ✅ Add indieauth-metadata support
5. ✅ Test with real Micropub clients
6. ✅ Add CORS headers if needed

**Deliverables**:
- Automatic discovery link injection
- Working with Quill, Indigenous, etc.
- Complete integration setup

---

### Phase 10: Polish & Documentation (Week 10)

**Goal**: Production-ready release

**Tasks**:
1. ✅ Add comprehensive error handling
2. ✅ Implement rate limiting
3. ✅ Add logging
4. ✅ Write user documentation
5. ✅ Create migration guide
6. ✅ Add example projects
7. ✅ Test with micropub.rocks
8. ✅ Create adapter templates
9. ✅ Add TypeScript documentation
10. ✅ Publish to npm

**Deliverables**:
- Complete documentation
- Example projects
- npm package
- Test suite results

---

## File Structure

```
astro-micropub/
├── src/
│   ├── integration.ts                 # Main integration entry point
│   │
│   ├── routes/
│   │   ├── micropub.ts               # Main Micropub endpoint
│   │   ├── media.ts                  # Media upload endpoint
│   │   └── indieauth/
│   │       ├── auth.ts               # Authorization endpoint
│   │       └── token.ts              # Token endpoint
│   │
│   ├── middleware/
│   │   └── auth.ts                   # Authentication middleware
│   │
│   ├── components/
│   │   ├── MicropubDiscovery.astro  # Discovery links component
│   │   └── AuthorizationPrompt.astro # Auth UI component
│   │
│   ├── storage/
│   │   ├── adapter.ts                # Storage interfaces
│   │   ├── content-collection.ts     # Default adapter
│   │   ├── database.ts               # Database adapter example
│   │   └── media/
│   │       ├── adapter.ts            # Media storage interface
│   │       ├── filesystem.ts         # Local filesystem storage
│   │       └── s3.ts                 # S3 storage example
│   │
│   ├── auth/
│   │   ├── tokens.ts                 # JWT generation/validation
│   │   ├── pkce.ts                   # PKCE helpers
│   │   └── storage.ts                # Token storage interface
│   │
│   ├── parsers/
│   │   ├── form-encoded.ts           # Form parser
│   │   ├── json.ts                   # JSON parser
│   │   ├── multipart.ts              # Multipart parser
│   │   └── microformats.ts           # Microformats helpers
│   │
│   ├── validators/
│   │   ├── micropub.ts               # Micropub request validation
│   │   ├── indieauth.ts              # IndieAuth validation
│   │   └── scopes.ts                 # Scope validation
│   │
│   ├── utils/
│   │   ├── slugify.ts                # Slug generation
│   │   ├── errors.ts                 # Error helpers
│   │   ├── urls.ts                   # URL utilities
│   │   └── client-discovery.ts       # Client ID fetching
│   │
│   └── types/
│       ├── micropub.ts               # Micropub types
│       ├── indieauth.ts              # IndieAuth types
│       └── config.ts                 # Configuration types
│
├── examples/
│   ├── basic/                        # Basic example
│   ├── custom-storage/               # Custom adapter example
│   └── advanced/                     # Advanced configuration
│
├── test/
│   ├── integration/                  # Integration tests
│   ├── unit/                         # Unit tests
│   └── fixtures/                     # Test fixtures
│
├── docs/
│   ├── getting-started.md
│   ├── configuration.md
│   ├── storage-adapters.md
│   ├── authentication.md
│   └── api-reference.md
│
├── package.json
├── tsconfig.json
├── README.md
└── PLAN.md                           # This file
```

---

## Testing Strategy

### Unit Tests

**Tools**: Vitest

**Coverage**:
- Parsers (form-encoded, JSON, multipart)
- Validators (Micropub requests, IndieAuth params)
- Utilities (slugify, PKCE, JWT)
- Storage adapters

**Example**:
```typescript
// test/unit/parsers/form-encoded.test.ts
import { describe, it, expect } from 'vitest';
import { parseFormEncoded } from '../src/parsers/form-encoded';

describe('Form-encoded parser', () => {
  it('should parse simple h-entry', () => {
    const body = 'h=entry&content=Hello+World';
    const result = parseFormEncoded(body);
    
    expect(result.type).toEqual(['h-entry']);
    expect(result.properties.content).toEqual(['Hello World']);
  });

  it('should parse array values', () => {
    const body = 'h=entry&category[]=test&category[]=demo';
    const result = parseFormEncoded(body);
    
    expect(result.properties.category).toEqual(['test', 'demo']);
  });
});
```

---

### Integration Tests

**Tools**: Playwright + Astro test utils

**Coverage**:
- Full Micropub flow (create, read, update, delete)
- IndieAuth flow (authorize, token exchange)
- Media upload
- Authentication middleware
- Discovery

**Example**:
```typescript
// test/integration/micropub-create.test.ts
import { describe, it, expect } from 'vitest';
import { testIntegration } from './helpers';

describe('Micropub create', () => {
  it('should create a post with form-encoded data', async () => {
    const { fetch } = await testIntegration();

    const response = await fetch('/micropub', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'h=entry&content=Hello+World',
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('Location')).toBeDefined();
  });

  it('should reject unauthorized requests', async () => {
    const { fetch } = await testIntegration();

    const response = await fetch('/micropub', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'h=entry&content=Hello+World',
    });

    expect(response.status).toBe(401);
  });
});
```

---

### Compliance Testing

**Tool**: [micropub.rocks](https://micropub.rocks/)

**Test Coverage**:
- ✅ Server endpoint discovery
- ✅ Create post (form-encoded)
- ✅ Create post (JSON)
- ✅ Create post with categories
- ✅ Create post with photo
- ✅ Create post with multiple photos
- ✅ Create post with HTML content
- ✅ Update post (replace)
- ✅ Update post (add)
- ✅ Update post (delete)
- ✅ Delete post
- ✅ Undelete post
- ✅ Media endpoint upload
- ✅ Query config
- ✅ Query source
- ✅ Query syndicate-to

---

### Manual Testing with Clients

**Clients to test**:
1. **Quill** - https://quill.p3k.io/
2. **Indigenous** (iOS/Android)
3. **Micropublish** - https://micropublish.net/
4. **Omnibear** (browser extension)

**Test scenarios**:
- Create various post types (note, article, photo, etc.)
- Update existing posts
- Delete posts
- Upload media
- Syndication

---

## Documentation Requirements

### User Documentation

#### Getting Started Guide

```markdown
# Getting Started with astro-micropub

## Installation

```bash
npm install astro-micropub
```

## Basic Setup

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import micropub from 'astro-micropub';

export default defineConfig({
  integrations: [
    micropub({
      indieauth: {
        secret: process.env.INDIEAUTH_SECRET,
      },
      site: {
        me: 'https://example.com/',
      },
    }),
  ],
});
```

## Environment Variables

Create a `.env` file:

```
INDIEAUTH_SECRET=your-secret-key-here
SITE_USERNAME=admin
SITE_PASSWORD=your-password
```

## Using with Micropub Clients

1. Visit https://quill.p3k.io/
2. Sign in with your site URL
3. Authorize the application
4. Start posting!
```

---

#### Configuration Reference

- Full configuration options
- Storage adapter options
- Security settings
- Examples for common scenarios

---

#### Storage Adapter Guide

- How to create custom adapters
- Database adapter implementation
- CMS adapter examples
- Best practices

---

### API Documentation

- Full TypeScript API reference
- Interface documentation
- Hook documentation
- Helper function reference

---

## Reference Materials

### Specifications

1. **Micropub**: https://www.w3.org/TR/micropub/
2. **IndieAuth**: https://indieauth.spec.indieweb.org/
3. **Microformats2**: http://microformats.org/wiki/microformats2
4. **OAuth 2.0**: https://tools.ietf.org/html/rfc6749
5. **PKCE**: https://tools.ietf.org/html/rfc7636

### Testing Resources

1. **micropub.rocks**: https://micropub.rocks/
2. **indieauth.rocks**: https://indieauth.rocks/

### IndieWeb Resources

1. **Micropub**: https://indieweb.org/Micropub
2. **IndieAuth**: https://indieweb.org/IndieAuth
3. **Post Types**: https://indieweb.org/posts

### Example Implementations

1. **micropub-endpoint** (PHP): https://github.com/gRegorLove/micropub-endpoint
2. **micropub.rocks server** (Ruby): https://github.com/aaronpk/micropub.rocks
3. **Transformative** (Go): https://github.com/EdgeCases/Transformative

### Astro Resources

1. **Integration API**: https://docs.astro.build/en/reference/integrations-reference/
2. **Middleware**: https://docs.astro.build/en/guides/middleware/
3. **Content Collections**: https://docs.astro.build/en/guides/content-collections/

---

## Success Criteria

### Minimum Viable Product (MVP)

- ✅ Create posts via Micropub (form-encoded and JSON)
- ✅ Query config and source
- ✅ IndieAuth token endpoint
- ✅ Basic authentication
- ✅ Default content collection storage
- ✅ Discovery link injection
- ✅ Works with Quill

### Version 1.0 Requirements

- ✅ All MVP features
- ✅ Update and delete posts
- ✅ Media endpoint
- ✅ Full IndieAuth authorization flow
- ✅ Pluggable storage adapters
- ✅ Pass all micropub.rocks tests
- ✅ Comprehensive documentation
- ✅ Example projects

### Future Enhancements (v1.1+)

- Syndication support (POSSE)
- Webmention integration
- Multi-user support
- Admin UI for managing posts
- Post preview before publishing
- Scheduled posts
- Database adapter (PostgreSQL, MongoDB)
- Cloud storage adapters (S3, R2)
- Rich text editor component
- Mobile app integration examples

---

## Implementation Notes

### Security Considerations

1. **Token Storage**: Use secure storage (encrypted at rest)
2. **CSRF Protection**: Validate state parameter in OAuth flow
3. **Rate Limiting**: Prevent brute force attacks
4. **Input Validation**: Sanitize all user input
5. **HTTPS Only**: Require HTTPS in production
6. **Scope Enforcement**: Always check scopes before operations
7. **Token Expiration**: Implement reasonable token lifetimes

### Performance Considerations

1. **Caching**: Cache client discovery results
2. **Database Indexing**: Index frequently queried fields
3. **File Optimization**: Optimize uploaded images
4. **Rate Limiting**: Protect against DoS
5. **Async Operations**: Use async/await throughout

### Compatibility

1. **Astro Version**: Require Astro 4.0+
2. **Node Version**: Require Node 18+
3. **TypeScript**: Full TypeScript support
4. **ESM Only**: Pure ESM package

---

## Questions to Resolve

1. ✅ Should we use JWT or opaque tokens for access tokens?
   - **Decision**: JWT for simplicity, with option for custom token storage

2. ✅ How should we handle user authentication for the authorization endpoint?
   - **Decision**: Support multiple auth strategies (password, session, custom)

3. ✅ Should media files be stored in git or excluded?
   - **Decision**: Store in `public/media/` by default, excluded from content collections

4. ✅ How do we handle post URLs and routing?
   - **Decision**: Let storage adapter determine URLs, content collection uses `/posts/[slug]`

5. ✅ Should we support multiple users?
   - **Decision**: Single user for v1.0, multi-user in future version

6. ✅ How do we handle syndication?
   - **Decision**: Configuration-based syndication targets, actual syndication in v1.1+

---

## Next Steps

1. Set up project repository
2. Initialize npm package
3. Create basic project structure
4. Implement Phase 1 (Foundation)
5. Set up testing infrastructure
6. Begin Phase 2 (Micropub Core)

---

*Last Updated: 2025-01-15*
*Version: 1.0*
