# JivanOS Cloud — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Owner Isolation**: Every path under `/users/{userId}` is accessible ONLY when `request.auth != null && request.auth.token.email_verified == true && request.auth.uid == userId`.
2. **Server-Authoritative Subscription**: `/users/{userId}/jivanos/subscription` is readable by the owning user (`allow get`) and strictly **never writable** by any client (`allow create, update, delete: if false`).
3. **Tamper-Proof 14-Day Trial**: `/users/{userId}/jivanos/trial` can be created at most once per user (`!exists(...)`), must bind `trialStartedAt == request.time`, must constrain `trialEndsAt <= request.time + duration.value(14, 'd')`, and is immutable forever (`allow update, delete: if false`).
4. **No Self-Upgrade on Backup**: Writing `/users/{userId}/jivanos/backup` with `subscriptionStatus == 'active'` is **rejected** unless `/users/{userId}/jivanos/subscription` exists with `status == 'active'` and `expiresAt > request.time`. Writing with `subscriptionStatus == 'trial'` is **rejected** unless `/users/{userId}/jivanos/trial` exists with `trialEndsAt > request.time`.
5. **Expired Backup Readability**: When a user's subscription and trial have expired, writes to `/users/{userId}/jivanos/backup` and `syncHistory` are denied, while `allow get` on `/users/{userId}/jivanos/backup` remains permitted so the owner can export their last backup safely.
6. **Temporal Integrity**: `updatedAt` on `backup` and `timestamp` on `syncHistory` MUST equal `request.time`.

## 2. The Dirty Dozen Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-User Read**: User B calls `getDoc(/users/userA/jivanos/backup)`.
2. **Cross-User Write**: User B calls `setDoc(/users/userA/jivanos/backup, ...)`.
3. **Self-Grant Paid Subscription**: User A calls `setDoc(/users/userA/jivanos/subscription, { status: 'active', expiresAt: future })`.
4. **Subscription Status Spoof in Backup**: Non-subscribed User A writes `subscriptionStatus: 'active'` to `/users/userA/jivanos/backup`.
5. **Trial Reset/Extension**: User A updates or deletes `/users/userA/jivanos/trial` to extend `trialEndsAt`.
6. **Trial Duration Forgery**: User A creates `/users/userA/jivanos/trial` with `trialEndsAt = now + 365 days`.
7. **Expired User Sync Write**: User A with expired trial and no active subscription attempts to update `/users/userA/jivanos/backup`.
8. **Shadow Ghost Field Injection**: User A includes an unlisted key `{ isAdmin: true }` in `/users/userA/jivanos/backup`.
9. **Client Timestamp Spoofing**: User A sets `updatedAt` to a backdated/future client timestamp instead of `serverTimestamp()`.
10. **Unverified Email Bypass**: Email/password account with `email_verified == false` attempts to write `/users/userA/jivanos/backup`.
11. **Path ID Poisoning**: User A writes a `syncHistory` entry with a 1KB or invalid-character document ID.
12. **Unfiltered List Scraping**: User B attempts to list `/users/userA/jivanos/backup/syncHistory` without matching `resource.data.userId == request.auth.uid`.
