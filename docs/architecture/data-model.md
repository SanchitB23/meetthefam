# Data model

Four tables. Postgres on Supabase. All multi-tenancy enforced by Row-Level Security — see [`auth-and-rls.md`](auth-and-rls.md).

## `profiles` — extends `auth.users`

```sql
profiles (
  id            uuid pk references auth.users,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz default now()
)
```

A 1:1 extension of Supabase's built-in `auth.users` for fields you control (display name, avatar). Created automatically via a trigger on `auth.users` insert.

## `trees` — a family tree

```sql
trees (
  id           uuid pk default gen_random_uuid(),
  name         text not null,
  description  text,
  owner_id     uuid not null references auth.users,
  share_token  text unique,        -- null = sharing off; non-null = read-only link active
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
)
```

The owner can rename, delete, mint / revoke share tokens, and manage members.

## `tree_members` — collaborator membership

```sql
tree_members (
  tree_id      uuid references trees on delete cascade,
  user_id      uuid references auth.users on delete cascade,
  role         text check (role in ('owner','editor')),
  invited_by   uuid references auth.users,
  joined_at    timestamptz default now(),
  primary key (tree_id, user_id)
)
```

The tree's owner is **also** a row in `tree_members` (with `role = 'owner'`) so "who can edit this tree?" is a single uniform query.

## `people` — a person in a tree

```sql
people (
  id           uuid pk default gen_random_uuid(),
  tree_id      uuid not null references trees on delete cascade,
  full_name    text not null,
  nickname     text,
  gender       text check (gender in ('m','f','other','unknown')) default 'unknown',
  photo_url    text,           -- Supabase Storage public URL
  bio          text,
  birth_year   int,
  birth_date   date,           -- optional full date if known
  location     text,           -- current city / "where they live"
  occupation   text,
  deceased     boolean default false,
  death_year   int,
  father_id    uuid references people,
  mother_id    uuid references people,
  spouse_id    uuid references people,   -- bidirectionally synced in app code
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  created_by   uuid references auth.users
)
```

19 columns. `father_id` / `mother_id` / `spouse_id` are **self-FKs** to `people` — they point to other rows in the same table. Children are not stored explicitly; they're computed at query time as `WHERE father_id = X OR mother_id = X`.

## Why FKs on `people` instead of a join table

The spec scopes relationships to "simple only" — one spouse, one parent pair, no step / adoption / multiple marriages. Three nullable self-FKs are simpler than a `relationships(person_a, person_b, type)` join table and cover this scope cleanly. If the scope ever extends, migrate to a relationships table — see [`../adrs/0002-fks-on-people-not-relationships-table.md`](../adrs/0002-fks-on-people-not-relationships-table.md).

## Why a `gender` field

family-chart uses `gender` for visual styling (card color, icon). `'other'` and `'unknown'` are first-class values so the app stays inclusive — never required, never displayed as a gendered label, only used for the visual hint family-chart needs.

## Edge cases — handled in app code, not the DB

| Case | Handling |
|---|---|
| **Spouse symmetry** — A.spouse=B implies B.spouse=A | Single Server Action wraps both updates in a transaction; also clears any prior spouse on either side. |
| **Cycle prevention** — A is its own ancestor | Validated on insert/update of `father_id` / `mother_id` (recursive walk up to N generations or use a Postgres recursive CTE). |
| **Photo cleanup on person delete** | Same Server Action that deletes the person row also deletes the file at `trees/<tree_id>/people/<person_id>/avatar.jpg` in Supabase Storage. |
| **Tree delete cascade** | DB cascade handles people + members. Server Action then iterates the tree's storage prefix and deletes orphan files. |

## Family-chart input shape

The wire format expected by the family-chart library, computed server-side from the rows above:

```js
{
  id: 'P3',
  data: {
    first_name: 'Tom',
    last_name: '...',
    img: 'https://...',
    birthday: '1965',
    avatar: '...',
    gender: 'm',
  },
  rels: {
    father: 'P1',
    mother: 'P2',
    spouses: ['P4'],
    children: ['P5']    // ← computed: WHERE father_id = P3 OR mother_id = P3
  }
}
```

See [`../ux/tree-view.md`](../ux/tree-view.md) for how this shape gets rendered.
