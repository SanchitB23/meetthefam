# Photo upload

One photo per person — used as their avatar on the tree card and on the person detail bottom sheet.

## End-to-end flow

```
User picks an image
       │
       ▼
  Client-side resize    (createImageBitmap → canvas → JPEG)
       │   max 1024×1024, quality 0.85, ~150 KB out
       ▼
  Server Action (upload action)
       │
       ▼
  Supabase Storage      bucket "photos"
       │   path: trees/<tree_id>/people/<person_id>/avatar.jpg
       ▼
  Server Action updates people.photo_url
       │
       ▼
  refresh()   (Next.js 16, Server Actions only)
       │   refreshes the uncached avatar without touching cached tree shells
       ▼
  client re-renders with new avatar
```

> **Why `refresh()` and not `revalidatePath()`:** in Next.js 16, `refresh()` (new, Server-Actions-only) refreshes uncached dynamic data without invalidating the page's cached shell. For a single-avatar mutation we don't need to re-render the whole tree page. If the avatar's `<img src>` *is* cached (e.g. the URL is tag-keyed), pair `refresh()` with `updateTag('person:<id>')` for read-your-writes semantics. See [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md).

## Client-side resize

Phone cameras produce 5–15 MB photos. We resize before upload to keep storage under 1 GB free tier.

- Max dimensions: **1024 × 1024**, preserving aspect ratio.
- Format: **JPEG**, quality **0.85**.
- Typical output: **~150 KB**.
- Implemented with `createImageBitmap` + an offscreen `<canvas>` + `canvas.toBlob('image/jpeg', 0.85)`.
- HEIC photos from iPhone — `createImageBitmap` decodes them on Safari; on Chrome we fall back to a `<img>` element first then read into the canvas.

## Storage path schema

```
photos/
└── trees/
    └── <tree_id>/
        └── people/
            └── <person_id>/
                └── avatar.jpg
```

This embedding lets the storage RLS policy parse `tree_id` from the path and verify membership. See [`auth-and-rls.md`](auth-and-rls.md) → "Storage."

**Why one fixed filename (`avatar.jpg`):** uploading a new photo overwrites the old one. No orphan cleanup needed for replacements. Cleanup is only required when the person row itself is deleted.

## Cleanup on delete

The Server Action that deletes a person also calls `supabase.storage.from('photos').remove([path])`. If this remove fails (e.g. file already gone), log a warning but don't fail the whole delete — the DB row deletion is the primary action.

When a tree is deleted, the cascade removes all `people` rows. A separate Server Action then iterates `trees/<tree_id>/...` and deletes the prefix with `remove([...])`. Best-effort — orphaned files would be cleaned up by a cron later if it became a real problem (it won't).

## Capacity math

Supabase Free: **1 GB** storage. At ~150 KB per photo:

> **~6,500 photos** before hitting the limit.

For 100 active trees averaging 50 people with photos = 5,000 photos. Comfortably under.

## Public reads

The `photos` bucket is public-read. A photo URL is `https://<project>.supabase.co/storage/v1/object/public/photos/trees/<tree_id>/people/<person_id>/avatar.jpg`.

The path itself is unguessable (UUIDs both for tree and person), so we accept that anyone with the URL can view the photo — same security model as Slack's image links.

## `next/image` config (Next.js 16)

Photo `<img>` tags use `next/image` for automatic resizing + WebP. Next.js 16 changed several `images.*` defaults — set them explicitly in `next.config.ts` so behavior is predictable across upgrades:

```ts
// next.config.ts (Phase 5)
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/photos/**' },
    ],
    qualities: [75],            // explicit (default is now [75], not [1..100])
    minimumCacheTTL: 14400,     // 4h — matches the v16 default but pinned for clarity
  },
}
```

We do **not** need `images.localPatterns` — all photos live on Supabase, never in `/public`.
