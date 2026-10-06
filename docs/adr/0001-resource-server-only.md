# Resource server only, no authorization or token endpoints

astro-micropub implements only the Micropub resource server role: it hosts
the Micropub and Media endpoints and verifies Bearer tokens against an
external IndieAuth token endpoint supplied in configuration. It deliberately
does not ship an authorization endpoint or token endpoint of its own, because
Astro sites can delegate identity to any IndieAuth provider, and shipping
those endpoints would pull session management and user login into a
publishing integration.

## Consequences

- Every token check is a round trip to the configured provider (cached
  briefly to keep this workable), so a slow or unreachable provider means
  rejected requests, not a local fallback.
- The package cannot revoke or introspect tokens locally; revocation lives
  with the provider.
