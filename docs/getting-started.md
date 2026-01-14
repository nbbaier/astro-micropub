# Getting Started with astro-micropub

This guide will help you set up `astro-micropub` in your Astro project and create your first post via Micropub.

## Prerequisites

- An Astro project (v4 or v5)
- Node.js 18 or higher
- A deployed website with a domain name (for IndieAuth)

## Installation

Install the package:

```bash
bun add astro-micropub
```

## Basic Setup

### Step 1: Configure the Integration

Edit your `astro.config.mjs`:

```typescript
import { defineConfig } from 'astro/config';
import micropub from 'astro-micropub';
import { DevFSAdapter } from 'astro-micropub/storage';

export default defineConfig({
  site: 'https://yourdomain.com', // REQUIRED: Your actual domain

  integrations: [
    micropub({
      // IndieAuth endpoints (using tokens.indieauth.com)
      indieauth: {
        authorizationEndpoint: 'https://indieauth.com/auth',
        tokenEndpoint: 'https://tokens.indieauth.com/token',
      },

      // Storage adapter (using DevFSAdapter for development)
      storage: {
        adapter: new DevFSAdapter({
          contentDir: 'src/content/posts',
          siteUrl: 'https://yourdomain.com',
        }),
      },

      // Site information
      site: {
        me: 'https://yourdomain.com/',
      },
    }),
  ],
});
```

**⚠️ Important:** Replace `https://yourdomain.com` with your actual domain.

### Step 2: Add Discovery Links

Add IndieAuth discovery links to your site's `<head>` section. Create or edit your base layout:

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

  <!-- Micropub endpoint (auto-discovered) -->
  <link rel="micropub" href="https://yourdomain.com/micropub">
  <link rel="micropub_media" href="https://yourdomain.com/micropub/media">
</head>
<body>
  <slot />
</body>
</html>
```

### Step 3: Create Content Collection (Optional)

If you're using Astro Content Collections, configure the posts collection:

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    type: z.string().default('h-entry'),
    published: z.string(),
    name: z.string().optional(),
    category: z.array(z.string()).optional(),
    photo: z.array(z.object({
      url: z.string(),
      alt: z.string().optional(),
    })).optional(),
  }),
});

export const collections = { posts };
```

### Step 4: Deploy Your Site

Deploy your site to your hosting platform. The site must be accessible at the domain you configured.

Popular options:
- [Netlify](https://netlify.com)
- [Vercel](https://vercel.com)
- [Cloudflare Pages](https://pages.cloudflare.com)

## Creating Your First Post

### Using Quill (Web Client)

1. Visit [quill.p3k.io](https://quill.p3k.io)
2. Enter your domain in the "Web Sign-In" field
3. Click "Sign In"
4. You'll be redirected to IndieAuth - approve the authorization
5. Once authenticated, you'll see the Quill editor
6. Write your post and click "Post"

Your post will be created as a markdown file in `src/content/posts/`!

### Using cURL (API)

First, get an access token from IndieAuth, then:

```bash
curl -X POST https://yourdomain.com/micropub \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": ["h-entry"],
    "properties": {
      "content": ["Hello from Micropub!"],
      "category": ["test", "micropub"]
    }
  }'
```

## Verifying It Works

### Check Your Content Directory

After creating a post, check your `src/content/posts/` directory. You should see a new markdown file:

```bash
ls src/content/posts/
# hello-from-micropub.md
```

View the file:

```markdown
---
type: h-entry
published: '2024-01-18T12:00:00Z'
category:
  - test
  - micropub
---

Hello from Micropub!
```

### Test with Micropub Query

Query your Micropub config endpoint:

```bash
curl -X GET https://yourdomain.com/micropub?q=config \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected response:

```json
{
  "media-endpoint": "https://yourdomain.com/micropub/media",
  "syndicate-to": [],
  "queries": ["config", "source", "syndicate-to"]
}
```

## Common Use Cases

### Creating Different Post Types

#### Note (short post without title)

```json
{
  "type": ["h-entry"],
  "properties": {
    "content": ["Just a quick note"]
  }
}
```

#### Article (with title)

```json
{
  "type": ["h-entry"],
  "properties": {
    "name": ["My Blog Post Title"],
    "content": ["Full article content goes here..."]
  }
}
```

#### Photo Post

```json
{
  "type": ["h-entry"],
  "properties": {
    "content": ["Check out this photo!"],
    "photo": ["https://yourdomain.com/media/photo.jpg"],
    "mp-photo-alt": ["Description of the photo"]
  }
}
```

### Uploading Media

Upload an image to the media endpoint:

```bash
curl -X POST https://yourdomain.com/micropub/media \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@photo.jpg"
```

Returns the uploaded file URL in the `Location` header.

### Updating a Post

```bash
curl -X POST https://yourdomain.com/micropub \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "url": "https://yourdomain.com/posts/my-post",
    "replace": {
      "content": ["Updated content"]
    }
  }'
```

### Deleting a Post

```bash
curl -X POST https://yourdomain.com/micropub \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete",
    "url": "https://yourdomain.com/posts/my-post"
  }'
```

## Next Steps

- **[IndieAuth Setup](./indieauth-setup.md)** - Detailed guide on authentication
- **[Configuration](./configuration.md)** - All configuration options
- **[Storage Adapters](./storage-adapters.md)** - Learn about different storage options
- **[Deployment](./deployment.md)** - Deploy your Micropub-enabled site

## Troubleshooting

### "Site URL not configured" error

Make sure you've set `site` in your `astro.config.mjs`:

```typescript
export default defineConfig({
  site: 'https://yourdomain.com', // Don't forget this!
  // ...
});
```

### "Invalid token" error

- Verify your IndieAuth endpoints are correct
- Make sure the discovery links are in your HTML
- Check that your site is deployed and accessible

### Posts not appearing

- Check the `contentDir` path is correct
- Verify the storage adapter is configured properly
- Look for errors in the server logs

### DevFSAdapter warnings in production

DevFSAdapter is not suitable for serverless deployments. For production:
- Use GitAdapter for static sites with CI/CD
- Use DatabaseAdapter for SSR sites
- See [Storage Adapters](./storage-adapters.md) for details

## Get Help

- **Issues**: [GitHub Issues](https://github.com/yourusername/astro-micropub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/astro-micropub/discussions)
- **IndieWeb**: [IndieWeb Chat](https://chat.indieweb.org/)
