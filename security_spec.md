# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Strict Owner Isolation (PII & Vault Protection)**: Every `/users/{userId}` document and subcollection (`/users/{userId}/data/state`, `/users/{userId}/reminders/{reminderId}`) belongs exclusively to the authenticated user whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. **Path Variable Hardening**: Every `{userId}` and `{reminderId}` path parameter must satisfy `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
3. **Validation Blueprints (Anti-Update-Gap)**: All `create` and `update` operations on `/users/{userId}`, `/users/{userId}/data/state`, and `/users/{userId}/reminders/{reminderId}` must pass `isValidUserSyncDoc`, `isValidUserData`, or `isValidQuoteReminder` with strict `.keys().hasOnly(...)` and `.size()` limits.
4. **No Unauthenticated or Cross-User Reads/Lists**: Unauthenticated requests and authenticated requests for another user's `userId` are strictly denied.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Read (`/users/user_123`)**: `auth = null` -> `PERMISSION_DENIED`.
2. **Cross-User PII Read (`/users/victim_uid` by `attacker_uid`)**: `auth.uid = 'attacker_uid'` -> `PERMISSION_DENIED`.
3. **Unverified Email Write (`/users/user_123` with `email_verified: false`)**: `PERMISSION_DENIED`.
4. **Shadow Field Injection (`/users/user_123` with `{ payload: '{}', updatedAt: '2026-11-17T00:00:00Z', isAdmin: true }`)**: Rejected by `hasOnly`.
5. **Oversized Payload DoS (`/users/user_123` with `payload.size() > 950000`)**: Rejected by `.size() <= 950000`.
6. **Invalid Type Poisoning (`/users/user_123` with `{ payload: 12345, updatedAt: '2026-11-17' }`)**: Rejected by `payload is string`.
7. **Missing Required Field (`/users/user_123` create without `payload`)**: Rejected by `keys().hasAll(['payload', 'updatedAt'])`.
8. **Malformed Path ID (`/users/bad$id!@#`)**: Rejected by `isValidId(userId)`.
9. **Subcollection Orphan Write (`/users/user_123/data/state` where `incoming().userId != userId`)**: Rejected by `data.userId == userId`.
10. **Subcollection Cross-User Update (`/users/victim/reminders/rem_1` by `attacker`)**: Rejected by `isOwner(userId)` + Master Gate `exists(/databases/$(database)/documents/users/$(userId))`.
11. **Update with Unauthorized Affected Key (`/users/user_123` updating `role: 'admin'`)**: Rejected by `affectedKeys().hasOnly(...)`.
12. **Blanket Collection List (`list /users`)**: Rejected (`allow list: if false` on `/users/{userId}`).
