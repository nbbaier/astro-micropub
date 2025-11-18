# IndieAuth Setup Guide

This guide explains how to set up IndieAuth with `tokens.indieauth.com` for your Micropub integration.

## What is IndieAuth?

IndieAuth is a decentralized authentication protocol that allows you to use your own website as your identity. It's built on OAuth 2.0 and is the standard authentication method for Micropub.

## Overview

`astro-micropub` is a **Micropub resource server**, which means it handles creating, updating, and deleting content on your site. However, it doesn't handle authentication directly. Instead, it verifies access tokens with an external IndieAuth token endpoint.

This separation of concerns means:
- You can use existing, battle-tested IndieAuth services
- You can switch IndieAuth providers without changing your Micropub setup
- You avoid the complexity of implementing a secure OAuth server

## Using tokens.indieauth.com

[tokens.indieauth.com](https://tokens.indieauth.com/) is a free, hosted IndieAuth service provided by Aaron Parecki (editor of the Micropub spec). It's the easiest way to get started.

### Step 1: Add Discovery Links to Your Site

Add these `<link>` tags to your site's `<head>` section (typically in your base layout):

```html
<link rel="authorization_endpoint" href="https://indieauth.com/auth">
<link rel="token_endpoint" href="https://tokens.indieauth.com/token">
```

In Astro, this might look like:

```astro
---
// src/layouts/BaseLayout.astro
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Astro.props.title}</title>

  <!-- IndieAuth endpoints -->
  <link rel="authorization_endpoint" href="https://indieauth.com/auth">
  <link rel="token_endpoint" href="https://tokens.indieauth.com/token">

  <!-- Your other meta tags -->
</head>
<body>
  <slot />
</body>
</html>
```

### Step 2: Configure astro-micropub

In your `astro.config.mjs`, configure the integration with the same endpoints:

```typescript
import { defineConfig } from 'astro/config';
import micropub from 'astro-micropub';
import { DevFSAdapter } from 'astro-micropub/storage';

export default defineConfig({
  site: 'https://yourdomain.com', // Your actual domain

  integrations: [
    micropub({
      // IndieAuth configuration
      indieauth: {
        authorizationEndpoint: 'https://indieauth.com/auth',
        tokenEndpoint: 'https://tokens.indieauth.com/token',
      },

      // Storage configuration
      storage: {
        adapter: new DevFSAdapter({
          contentDir: 'src/content/posts',
          siteUrl: 'https://yourdomain.com',
        }),
      },

      // Site configuration
      site: {
        me: 'https://yourdomain.com/',
      },
    }),
  ],
});
```

### Step 3: Test with a Micropub Client

Now you can use any Micropub client to post to your site:

#### Option 1: Quill (Web-based)

1. Visit [quill.p3k.io](https://quill.p3k.io)
2. Sign in with your domain (e.g., `https://yourdomain.com`)
3. You'll be redirected to IndieAuth for authentication
4. Authorize Quill to post to your site
5. Start creating posts!

#### Option 2: Indigenous (Mobile)

- iOS: [Indigenous for iOS](https://indigenous.realize.be/)
- Android: [Indigenous for Android](https://indigenous.realize.be/)

Install the app, sign in with your domain, and you're ready to post from your phone.

## How Token Verification Works

When a Micropub client makes a request to your site:

1. The client sends a request with an `Authorization: Bearer <token>` header
2. Your Micropub endpoint extracts the token
3. Your endpoint verifies the token by making a GET request to `tokens.indieauth.com/token` with the same token
4. The token endpoint responds with the user's identity (`me`), scopes, and client ID
5. Your endpoint checks if the user matches your site and has the required scopes
6. If valid, the request is processed; otherwise, a `401 Unauthorized` or `403 Forbidden` response is returned

This process is cached for 120 seconds (configurable) to reduce latency.

## Security Considerations

### Token Caching

By default, token verifications are cached for 120 seconds. You can adjust this:

```typescript
indieauth: {
  authorizationEndpoint: 'https://indieauth.com/auth',
  tokenEndpoint: 'https://tokens.indieauth.com/token',
  tokenVerificationCache: 60, // Cache for 60 seconds
}
```

Shorter cache times mean more verification requests but fresher authorization checks. Longer times reduce latency but may delay revocation detection.

### Scope Enforcement

The integration enforces scopes by default:

- `create` - Required to create new posts
- `update` - Required to update existing posts
- `delete` - Required to delete posts
- `media` - Required to upload media files

You can disable strict scope enforcement (not recommended):

```typescript
security: {
  requireScope: false, // Not recommended for production
}
```

### CORS Configuration

By default, CORS is open to all origins (`*`). For production, you may want to restrict this:

```typescript
security: {
  allowedOrigins: [
    'https://quill.p3k.io',
    'https://indigenous.realize.be',
  ],
}
```

## Using a Custom IndieAuth Server

If you want to run your own IndieAuth server instead of using tokens.indieauth.com:

```typescript
indieauth: {
  authorizationEndpoint: 'https://auth.yourdomain.com/auth',
  tokenEndpoint: 'https://auth.yourdomain.com/token',
}
```

Your server must:
1. Implement the IndieAuth authorization endpoint
2. Implement the token endpoint
3. Support token verification via GET requests with Bearer tokens
4. Return `me`, `client_id`, `scope`, and optionally `exp` in the verification response

See the [IndieAuth spec](https://indieauth.spec.indieweb.org/) for full details.

## Troubleshooting

### "Invalid token" errors

- Verify your `tokenEndpoint` is correct in both the config and your HTML
- Check that your site URL matches exactly (including trailing slashes)
- Ensure the client has properly authorized with your IndieAuth endpoint

### "Insufficient scope" errors

- The client needs to request the appropriate scopes during authorization
- Common scopes: `create`, `update`, `delete`, `media`
- Some clients (like Quill) let you see and modify requested scopes

### Token verification is slow

- Increase the cache duration: `tokenVerificationCache: 300` (5 minutes)
- Check network latency to tokens.indieauth.com
- Consider running your own IndieAuth server for lower latency

## Next Steps

- Read the [Configuration Reference](./configuration.md) for all available options
- Learn about [Storage Adapters](./storage-adapters.md) for production deployments
- Check out the [Deployment Guide](./deployment.md) for hosting your site

## Resources

- [IndieAuth Specification](https://indieauth.spec.indieweb.org/)
- [tokens.indieauth.com](https://tokens.indieauth.com/)
- [IndieAuth.com](https://indieauth.com/)
- [IndieWeb Wiki - IndieAuth](https://indieweb.org/IndieAuth)
- [Micropub Specification](https://www.w3.org/TR/micropub/)
