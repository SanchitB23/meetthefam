# ADR 0001 — Supabase over Firebase

**Status:** Accepted
**Date:** 2026-05-10

## Context

The app needs DB + auth + object storage + multi-tenancy. The single-vendor candidates that hit a $0 free tier are Supabase and Firebase. We considered a best-of-breed split (Neon + Clerk + R2), too.

## Decision

**Use Supabase.** Postgres for the DB, Supabase Auth for sessions, Supabase Storage for photos, Row-Level Security for multi-tenancy enforcement.

## Consequences

- **Relational shape fits tree data.** Querying "all people in this tree where `father_id = X` or `mother_id = X`" is a single SQL statement. Modeling the same in Firestore would require either a join via two queries or denormalized children-arrays we'd have to keep in sync.
- **RLS handles multi-tenancy without writing custom auth checks in every route.** This is the biggest win — every multi-tenant SaaS that doesn't use RLS-or-equivalent eventually leaks data.
- **Vendor coupling is real but mitigated.** Postgres is portable; if we ever leave Supabase, we can move to Neon / RDS / Aurora with an export. Storage migration is the hard part.
- **Free tier covers our scope** — 500 MB DB, 1 GB Storage, 50K MAU per project. We use two projects (QA + prod), both free.

## Alternatives considered

- **Firebase / Firestore** — NoSQL fights the relational shape of tree data. Pricing is also harder to predict (read-count billing is sensitive to query patterns).
- **Best-of-breed: Next.js + Neon + Clerk + Cloudflare R2** — each component is best-in-class but four vendors instead of one. Worth revisiting if Supabase ever stops fitting.
- **Self-host Postgres + MinIO on a VPS** — cheapest in absolute dollars, most expensive in time. Doesn't match an AI-assisted side-project shape.
