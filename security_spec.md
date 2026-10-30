# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Identity & Ownership Isolation**: Every document in `/products/{productId}` and `/movements/{movementId}` MUST have an `ownerId` strictly matching `request.auth.uid` on creation, and `ownerId` is immutable on update.
2. **Email Verification Enforcement**: Every write operation (`create`, `update`, `delete`) across all collections requires `request.auth.token.email_verified == true`.
3. **Strict Schema & Key Whitelisting**: Documents in `/products` and `/movements` must contain all required keys and ONLY allowed keys (`hasAll` + `hasOnly`), preventing shadow field injection.
4. **String & ID Size Boundaries**: All document IDs (`{productId}`, `{movementId}`) and reference IDs must match `^[a-zA-Z0-9_\-]+$` with length 1..128. Every string field enforces strict `.size()` upper bounds.
5. **Relational Consistency**: Creating a `/movements/{movementId}` document requires that the referenced `/products/{productId}` document exists in Firestore and is owned by `request.auth.uid`.
6. **Temporal Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on creation and update.
7. **Query Enforcement**: `allow list` rules explicitly enforce `resource.data.ownerId == request.auth.uid` (or `isAdmin()`) without delegating filtering trust to the client.

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: Creating a product with `request.auth == null`.
2. **Unverified Email Spoof**: Creating a product with `email: "jorgevillero7@gmail.com"` and `email_verified: false`.
3. **Identity Spoofing on Create**: Authenticated user `uid_attacker` creating a product with `ownerId: "uid_victim"`.
4. **Shadow Field Injection on Create**: Creating a product with an extra unauthorized field `"isSuperAdmin": true`.
5. **ID Poisoning Attack**: Creating a product at `/products/invalid$id!with*spaces` or a 200-character ID.
6. **Resource Exhaustion (1MB String)**: Creating a product with `name` of 5,000 characters (exceeds 150 max).
7. **Negative Stock / Cost Injection**: Creating a product with `unitCost: -5000` or `quantity: -3`.
8. **Timestamp Forgery**: Creating a product with a client-forged past `createdAt` instead of `request.time`.
9. **Ownership Hijack on Update**: Updating an existing product's `ownerId` to another user's UID.
10. **Value Poisoning on Update**: Updating a whitelisted key (`quantity`) with a string `"three"` instead of a non-negative number.
11. **Orphaned Movement Creation**: Creating a `/movements/{movementId}` document pointing to a non-existent `productId` or a product owned by another user.
12. **Blanket List Scraping**: Executing an unfiltered `list` query on `/products` without `where('ownerId', '==', auth.uid)`.
