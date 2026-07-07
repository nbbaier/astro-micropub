# Manual testing: MicropubDiscovery component

End-to-end manual test plan for the discovery-component PR. It exercises the component, the `virtual:astro-micropub/config` wiring, absolute-URL resolution, the `discovery.enabled` flag, prop overrides, and the Astro `base`-path handling.

Most of these behaviors are covered by unit tests and automated build fixtures. The two checks automation **cannot** reach are [#3 (route reachability under `base`)](#3-advertised--reachable) and [#6 (consumer TypeScript experience)](#6-typescript--editor) — prioritize those if short on time.

## Setup

Build the package and create a throwaway consumer project.

```bash
# In the astro-micropub repo
bun run build && npm pack        # -> astro-micropub-0.1.0.tgz

# Scratch consumer
npm create astro@latest test-mp -- --template minimal
cd test-mp && npm i ../astro-micropub/astro-micropub-0.1.0.tgz

# Astro 6/7 require a server adapter to build at all, since the integration
# injects on-demand routes (prerender: false) for /micropub and /micropub/media
npm i -D @astrojs/node
```

`astro.config.mjs`:

```js
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';
import micropub from 'astro-micropub';

export default defineConfig({
  site: 'https://example.com',
  // base: '/blog',                      // toggle for the base test (#2, #3)
  adapter: node({ mode: 'standalone' }), // leave output at the default 'static'
                                          // so index.astro still prerenders to
                                          // dist/client/index.html for check #1
  integrations: [micropub({
    indieauth: {
      authorizationEndpoint: 'https://indieauth.com/auth',
      tokenEndpoint: 'https://tokens.indieauth.com/token',
    },
    storage: { adapter: { name: 'dummy' } },
    site: { me: 'https://example.com/' },
  })],
});
```

A layout that uses the component (`src/layouts/Base.astro`):

```astro
---
import MicropubDiscovery from 'astro-micropub/MicropubDiscovery.astro';
---
<html>
  <head>
    <title>test</title>
    <MicropubDiscovery />
  </head>
  <body><slot /></body>
</html>
```

Wrap a page in it (`src/pages/index.astro`):

```astro
---
import Base from '../layouts/Base.astro';
---
<Base><h1>hi</h1></Base>
```

## Checklist

### 1. Zero-config render

```bash
npm run build
grep -E 'rel="micropub|_endpoint' dist/**/*.html
```

Expect all four tags, each an absolute URL:

| rel | href |
| --- | --- |
| `authorization_endpoint` | `https://indieauth.com/auth` |
| `token_endpoint` | `https://tokens.indieauth.com/token` |
| `micropub` | `https://example.com/micropub` |
| `micropub_media` | `https://example.com/micropub/media` |

Proves the real `virtual:astro-micropub/config` Vite plugin wiring and the `./MicropubDiscovery.astro` package export resolve in an installed consumer.

### 2. Base path

Uncomment `base: '/blog'` in the config and rebuild. The two Micropub tags must become `https://example.com/blog/micropub` and `https://example.com/blog/micropub/media`. The two IndieAuth tags must stay unchanged (they are external absolute URLs).

### 3. Advertised == reachable

The point of the base fix: the advertised URL must match where the endpoint actually answers. With `base: '/blog'` set:

```bash
npm run dev
# route exists under the base prefix (non-404, e.g. 400/401 is fine):
curl -so /dev/null -w '%{http_code}\n' http://localhost:4321/blog/micropub
```

A non-404 at `/blog/micropub`, with the rendered `rel="micropub"` tag pointing at `/blog/micropub`, confirms the fix.

Don't assert that `/micropub` (un-prefixed) 404s — it won't. Astro core's own
request matching (`App.match()` → `removeBase()` in
`astro/dist/core/app/base.js`) strips the `base` prefix when present but falls
through unchanged when it's absent, so **every** route in an Astro 7 app,
injected or not, stays reachable at both the prefixed and un-prefixed path.
That's framework behavior, not something this package's routes control —
verified by hitting the un-prefixed path against a build with `base: '/blog'`
and seeing the same route match.

### 4. `discovery.enabled` flag

Add `discovery: { enabled: false }` to the config and rebuild. Expect **zero** discovery tags in the output.

### 5. Prop override

```astro
<MicropubDiscovery micropub="https://proxy.example/mp" />
```

Expect only the `rel="micropub"` tag to change; the other three fall back to the resolved config.

### 6. TypeScript / editor

Open the layout in your editor and confirm the `import ... from 'astro-micropub/MicropubDiscovery.astro'` does not error and the virtual-module types resolve. Run `npx astro check` if configured.

### 7. Real client discovery (optional)

Deploy or `npm run preview`, then point an IndieWeb tool at the page and confirm it discovers the endpoints:

- <https://indiewebify.me/>
- A Micropub client such as <https://quill.p3k.io/> or <https://micropublish.net/>

## Coverage summary

| Check | Also covered by automation? |
| --- | --- |
| 1. Zero-config render | Partially — automated e2e used a stubbed virtual module |
| 2. Base path | Yes — unit tests + `base: '/blog'` build fixture |
| 3. Advertised == reachable | **No — manual only** (only the prefixed-path reachability half; un-prefixed 404 is not a valid assertion under Astro 7) |
| 4. `enabled` flag | Yes — unit tests + build fixture |
| 5. Prop override | Yes — build fixture |
| 6. TypeScript / editor | **No — manual only** |
| 7. Real client discovery | No — manual only |
