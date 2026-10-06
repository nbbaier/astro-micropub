# Tombstone deletes are part of the storage adapter contract

The Micropub spec makes undeleting posts optional (servers "MAY support
undeleting"), which would let a storage adapter hard-delete content. We chose
the opposite: `MicropubStorageAdapter` requires `undeletePost`, so deleting a
Post means marking it deleted (a restorable tombstone), never erasing it.
Accidental deletion from a phone client is common enough that permanently
losing a post and its URL is the worse failure mode, and a uniform action
surface means Micropub clients get consistent behavior from every adapter.

## Consequences

- Storage adapters cannot garbage-collect deleted Posts; they must keep them
  restorable for as long as undelete remains in the contract.
- A truly append-only or headless external store cannot fully conform, since
  delete must leave a restorable trace.
