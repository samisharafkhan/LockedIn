# Firestore Setup and Schema (LockedIn)

This document describes the Firestore collections, document shapes, and setup steps required by the current app UI/features.

## Project

- Firebase project id: `lockedin-20e97`
- Firestore database: `(default)`

## Deploy rules and indexes

Run from repo root:

```powershell
firebase deploy --only firestore:rules,firestore:indexes --project lockedin-20e97
```

## Required collections

The app uses these top-level collections:

1. `userDirectory`
2. `userState`
3. `follows`
4. `publishedSchedules`
5. `blockShares`

Collections may not appear in Firestore Console until at least one document exists.

## Collection schemas

### 1) `userDirectory/{uid}`

Public profile + privacy lookup for search/discover/follows.

Required fields:

- `uid: string`
- `displayName: string`
- `displayNameLower: string`
- `handle: string`
- `handleLower: string`
- `isPrivate: boolean`
- `accountPublic: boolean` (inverse of `isPrivate`)
- `publishTodayToDiscover: boolean`
- `avatarEmoji: string` (optional)
- `bio: string` (optional)
- `updatedAt: timestamp` (recommended)

### 2) `userState/{uid}`

Primary schedule/profile state for a user.

Common fields used by app:

- `profile: map` (display/handle/privacy/bio/avatar)
- `blocksByDay: map<date, array>`
- `followingIds: array<string>` (legacy/backfill support)
- `locale: string`
- `languageOnboardingComplete: boolean`

### 3) `follows/{followerUid_followingUid}`

Follow graph + requests.

Document id format:

- `${followerUid}_${followingUid}`

Required fields:

- `followerUid: string`
- `followingUid: string`
- `status: "pending" | "accepted"`
- `createdAt: timestamp`
- `updatedAt: timestamp` (optional)

Rules behavior:

- private target => create with `status = "pending"`
- public target => create with `status = "accepted"`
- only target user can accept pending request by updating to accepted

### 4) `publishedSchedules/{ownerUid}`

Discover feed (today publish).

Common fields:

- `ownerUid: string`
- `dayKey: string` (`YYYY-MM-DD`)
- `displayName: string`
- `handle: string`
- `avatarEmoji: string` (optional)
- `bio: string` (optional)
- `blocks: array`
- `updatedAt: timestamp` (recommended)

### 5) `blockShares/{shareId}`

Shared block collaboration.

Common fields:

- `ownerUid: string`
- `recipientUid: string`
- `dayKey: string`
- `blockId: string`
- `block: map`
- `collabBlock: map`
- `permission: "view" | "comment" | "edit"`
- `updatedAt: timestamp`

Subcollection:

- `blockShares/{shareId}/comments/{commentId}`
  - `authorUid: string`
  - `text: string`
  - `createdAt: timestamp`

## Existing bootstrap docs created

The following visibility/bootstrap docs are safe and already created:

- `publishedSchedules/schema_meta`
- `blockShares/schema_meta`

They are ignored by app queries because app filters by owner/recipient/day fields for real data.

## Manual follow-request test (console)

Create document:

- Collection: `follows`
- Document ID: `<followerUid>_<followingUid>`
- Fields:
  - `followerUid` (string): `<followerUid>`
  - `followingUid` (string): `<followingUid>`
  - `status` (string): `pending` (or `accepted` for public target)
  - `createdAt` (timestamp): now

Then sign in as the target/private account and accept request in app (or set `status=accepted` manually for testing).

## Notes for reliable testing

- Use two isolated browser sessions (normal + incognito, or two browser profiles).
- Ensure both users exist in `userDirectory` and have consistent privacy flags.
- If requests/follows do not appear, check browser console for Firestore errors (permissions/index).
