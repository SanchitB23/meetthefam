# Tree view

The defining surface of the app. Built on [donatso/family-chart](https://github.com/donatso/family-chart) — D3-based, framework-agnostic, MIT-licensed.

## Layout

```
┌──────────────────────────────────┐
│  ← Mom's family       [...]     │  ← Header: tree name, "..." menu (settings, members, share)
├──────────────────────────────────┤
│                                  │
│       [Grandpa] [Grandma]        │
│              │                   │
│     [Aunt][Mom][Dad][Uncle]      │  ← family-chart canvas: pan + zoom + tap to recenter
│              │                   │
│           [YOU]                  │
│                                  │
│                                  │
│                          [ + ]   │  ← FAB: add person (anchors to focus person if set)
└──────────────────────────────────┘
```

Pan + pinch-zoom handled by family-chart's built-in support. The tree paradigm is **horizontal focus-person**: pick a "focus person" (you, by default), tree spreads out around them — parents up, descendants down, spouse adjacent. Tap any other person to re-center.

## Component shape

```tsx
// app/(app)/tree/[id]/page.tsx        — Server Component
async function TreePage({ params }) {
  const supabase = createServerClient(...)
  const tree = await supabase.from('trees').select('*').eq('id', params.id).single()
  const people = await supabase.from('people').select('*').eq('tree_id', params.id)
  const initialData = transformToFamilyChartShape(people)
  return <FamilyTree treeId={tree.id} initialData={initialData} />
}

// components/family-tree.tsx          — Client Component
'use client'
export function FamilyTree({ treeId, initialData }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const chart = f3.createChart(ref.current, initialData)
      .setTransitionTime(800)
      .setCardXSpacing(250)
      .setCardYSpacing(150)

    chart.setCard(/* custom card component, see below */)
    chart.updateTree({ initial: true })

    // Sync URL hash <-> focus person
    const focusFromHash = () => {
      const id = window.location.hash.replace('#p=', '')
      if (id) chart.setMainId(id)
    }
    window.addEventListener('hashchange', focusFromHash)
    focusFromHash()
    return () => window.removeEventListener('hashchange', focusFromHash)
  }, [initialData])

  return <div ref={ref} className="family-chart-container" />
}
```

The `f3.createChart` API and full options list — pull via Context7 MCP at build time, since family-chart's API can shift between releases.

## Data transform (server-side)

Performed once per page load in the Server Component.

```ts
function transformToFamilyChartShape(rows: Person[]) {
  return rows.map(p => ({
    id: p.id,
    data: {
      first_name: p.full_name.split(' ')[0],
      last_name: p.full_name.split(' ').slice(1).join(' '),
      img: p.photo_url,
      birthday: p.birth_year?.toString(),
      gender: p.gender,
      bio: p.bio,
      // ... etc
    },
    rels: {
      father: p.father_id,
      mother: p.mother_id,
      spouses: p.spouse_id ? [p.spouse_id] : [],
      children: rows
        .filter(c => c.father_id === p.id || c.mother_id === p.id)
        .map(c => c.id),
    },
  }))
}
```

The `children` array is **derived** from `father_id` / `mother_id`, never stored. See [`../architecture/data-model.md`](../architecture/data-model.md).

## Custom person card

family-chart accepts a custom card renderer. Ours shows:

- Photo (avatar from `photo_url`, fallback to gendered initials placeholder)
- Full name on top
- Nickname / birth year / location below
- Visual deceased indicator (subtle border or icon)
- Gender hint (border color or background tint per inclusive palette)

Card design itself is **deliberately deferred to Phase 8** (visual polish), driven by the `frontend-design` skill. v1 starts with a default card; Phase 8 replaces it with a designed one. See [`../adrs/0006-frontend-design-skill-for-visual-polish-only.md`](../adrs/0006-frontend-design-skill-for-visual-polish-only.md).

## Cross-references

- Tap, long-press, pan, zoom specifics → [`mobile-gestures.md`](mobile-gestures.md)
- Add / edit / link person flow → [`add-edit-person.md`](add-edit-person.md)
- Read-only mode (used by `/share/[token]`) → [`../architecture/share-link.md`](../architecture/share-link.md)
