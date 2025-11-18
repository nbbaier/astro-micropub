# astro-micropub

A production-ready Micropub resource server integration for Astro.

## Status

🚧 **Work in Progress** - Currently in MVP development

## Features (Planned)

- ✅ Full W3C Micropub specification compliance
- ✅ Create, update, and delete posts via Micropub
- ✅ Media endpoint with streaming uploads
- ✅ Token verification with external IndieAuth providers
- ✅ Pluggable storage adapters (Git, Database, Filesystem)
- ✅ CORS support for browser-based clients
- ✅ RFC 6750 compliant authentication

## Installation

```bash
npm install astro-micropub
```

## Quick Start

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import micropub from 'astro-micropub';
import { DevFSAdapter } from 'astro-micropub/storage';

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    micropub({
      indieauth: {
        authorizationEndpoint: 'https://indieauth.com/auth',
        tokenEndpoint: 'https://tokens.indieauth.com/token',
      },
      storage: {
        adapter: new DevFSAdapter({
          contentDir: 'src/content/posts',
        }),
      },
      site: {
        me: 'https://example.com/',
      },
    }),
  ],
});
```

## Documentation

See the `/docs` folder for detailed documentation (coming soon).

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT
