# #228 People Order-By Tiebreak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make people fetch order fully deterministic by adding an `id` tiebreak to the existing `created_at` ordering on both tree-feeding queries.

**Architecture:** Per the approved spec ([2026-06-13-228-people-order-by-design.md](../specs/2026-06-13-228-people-order-by-design.md)): two one-line `.order('id', { ascending: true })` additions. No transform changes, no tests (issue marks them optional), no helper extraction.

**Tech Stack:** supabase-js query builder; Next.js Server Components.

**Branch / worktree:** `fix/228-people-order-by` at `/Users/sqb6461/Workspace/SelfProjects/mtf-wt-228`. All commands run from there.

---

### Task 1: Add the id tiebreak to both people fetches

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/TreeContent.tsx` (people fetch, ~line 136)
- Modify: `src/app/share/[token]/page.tsx` (people fetch, ~line 53)

- [ ] **Step 1: TreeContent.tsx** — in the people query, change

```ts
    .eq('tree_id', treeId)
    .order('created_at', { ascending: true })
    .returns<PersonRow[]>()
```

to

```ts
    .eq('tree_id', treeId)
    // id tiebreak (#228): created_at defaults to now(), which is fixed per
    // transaction — batch inserts tie, and order among ties is arbitrary.
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .returns<PersonRow[]>()
```

- [ ] **Step 2: share/[token]/page.tsx** — identical change to its people query:

```ts
    .eq('tree_id', tree.id)
    // id tiebreak (#228): created_at defaults to now(), which is fixed per
    // transaction — batch inserts tie, and order among ties is arbitrary.
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .returns<PersonRow[]>()
```

- [ ] **Step 3: Gate**

```bash
cd /Users/sqb6461/Workspace/SelfProjects/mtf-wt-228 && pnpm typecheck && pnpm lint && pnpm test
```

Expected: typecheck exit 0; lint 0 errors (1 pre-existing `PersonForm.tsx` warning); vitest — Supabase-backed suites may fail locally if the local stack is down (pre-existing; CI arbitrates), all non-Supabase suites pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/sqb6461/Workspace/SelfProjects/mtf-wt-228 && git add 'src/app/(app)/tree/[id]/_components/TreeContent.tsx' 'src/app/share/[token]/page.tsx' && git commit -m "fix(#228): add id tiebreak to people fetch ordering

created_at defaults to now(), which Postgres fixes per transaction —
batch-inserted people tie and their order (hence sibling layout in the
chart) stays arbitrary. The id tiebreak makes the order total.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: Push, draft PR, correct the issue record

- [ ] **Step 1: Push**: `git push -u origin fix/228-people-order-by`
- [ ] **Step 2: Draft PR** base `qa`, title `fix: add id tiebreak to people fetch ordering (#228)`, milestone *v1.2 — Export & archival*, body per `.github/pull_request_template.md` with bare `Closes #228`.
- [ ] **Step 3: Comment on #228** correcting the diagnosis: `ORDER BY created_at` has existed since `92bf861` (2026-05-15); only the `id` tiebreak was missing; link the spec.
- [ ] **Step 4: CI green** on the PR.
