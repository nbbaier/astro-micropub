# astro-micropub

A Micropub resource server for Astro sites. It lets third-party clients
create, update, and delete posts on a site via the W3C Micropub protocol,
verifying their tokens against an external IndieAuth provider.

## Language

### Endpoints & protocol

**Micropub**:
The W3C protocol for creating, updating, and deleting posts on one's own
domain using third-party clients.

**Micropub endpoint**:
The endpoint on the site that accepts create, update, delete, and query
requests from Clients.

**Media endpoint**:
The endpoint on the site that accepts file uploads and returns a URL for use
in a subsequent request. Its job is exclusively uploads; it never manages
posts.

**Resource server**:
The role astro-micropub plays: it hosts the Micropub and Media endpoints and
verifies tokens, but never issues them. Authorization is always some external
IndieAuth provider's job.
_Avoid_: auth server, token provider.

**Client**:
A third-party web or native app that sends Micropub requests on the site
owner's behalf (e.g. Quill, Indigenous, Micropublish). The same actor as the
IndieAuth client.
_Avoid_: app, user.

**Discovery**:
How Clients find the Micropub, Media, authorization, and token endpoints
advertised from the site's pages.

### Content

**Post**:
A piece of content on the site addressable by its own canonical URL — the
thing Clients create, update, and delete.
_Avoid_: entry (when the post itself is meant), article, item.

**Entry**:
The Microformats2 representation of a Post — its type and properties — used
in requests, responses, and storage. The default entry type is h-entry.
_Avoid_: post (when the representation is meant), MF2 object.

**Media**:
A file uploaded through the Media endpoint, addressable by URL. Media is not
a Post and carries no content properties.
_Avoid_: asset, attachment.

**Slug**:
The URL path segment chosen for a Post, taken from the client's suggestion or
derived from its name or content.

**Update operation**:
A single change applied to a Post's properties: replace, add, or remove.

**Delete**:
Marking a Post deleted. A deleted Post stays restorable; it does not vanish.
_Avoid_: erase, remove (when the whole Post is meant).

**Undelete**:
Restoring a deleted Post to its prior state.

**Syndication target**:
A named external destination a Post can be cross-posted to, offered to
Clients at publishing time.

### Identity & access

**Site owner**:
The person the site belongs to, identified by their Me URL. Every token is
issued to the site owner; every Post is created on their behalf.
_Avoid_: user, admin, author.

**Me**:
The site owner's canonical profile URL, per IndieAuth (the `me` value in
token verification responses). On a personal site, Me is also the canonical
site URL, and it bounds what the endpoints may act on.
_Avoid_: site URL (when identity is meant), profile.

**Token**:
The OAuth 2.0 Bearer credential a Client presents with each request, issued
by the external IndieAuth token endpoint.
_Avoid_: access key, API key.

**Scope**:
A space-separated permission carried by a Token (e.g. create, update,
delete, media) that gates what the requesting Client may do.

**URL ownership**:
The rule that update, delete, and undelete may only target Posts whose URL
is on the same origin as Me.
_Avoid_: URL check, site check.

### Persistence

**Storage adapter**:
The pluggable persistence strategy for Posts and Media, supplied by the site
operator. A storage adapter must keep deleted Posts restorable so undelete
works.
_Avoid_: backend, database.
