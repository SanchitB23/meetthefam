# Pages / routes

Six routes. Mobile-first design — modals and bottom-sheets handle most secondary flows so we don't fragment into many pages.

| Route | Auth | Purpose |
|---|---|---|
| `/` | Public | Landing — what the product is, sign-up CTA |
| `/login` | Public | Email magic-link, Google OAuth |
| `/signup` | Public | Same form as `/login`, "create account" mode |
| `/auth/callback` | Public | Supabase OAuth callback handler |
| `/dashboard` | Logged in | List of trees the user owns or is a member of, plus "+ New tree" |
| `/tree/[id]` | Member or owner | The core experience — family-chart canvas, "+" FAB, bottom-sheet person detail, "..." menu opens settings / members / share modals |
| `/share/[token]` | Public, token-gated | Read-only tree view; banner: "Sign up to create your own" |

## Modals (not separate routes)

- Person add / edit
- Tree rename / settings
- Member management (invite, list, remove, change role)
- Share-link toggle (enable / disable / regenerate / copy URL)

These open over `/tree/[id]` or `/dashboard`. URL doesn't change. Closing the modal returns to the underlying page.

## Mobile vs desktop

- **Mobile**: bottom sheets for person detail, full-screen modals for forms.
- **Desktop**: same patterns; bottom sheets become side panels for person detail (tree stays visible).

Both use the same components — Tailwind breakpoints control whether a `<Sheet>` slides from bottom or right.

## Deep linking with the focus person

`/tree/[id]#p=<person-id>` re-centers the family-chart on a specific person. Supports:

- Bookmarking a specific viewpoint of the tree
- Sharing a link like "look at Aunt Mary's branch"
- Browser back/forward through hash changes triggers re-center, not full reload

Implementation: a `useEffect` in the `<FamilyTree>` Client Component watches `window.location.hash` and calls `chart.setMainId(personId)` when it changes.

## Layout shell

The app uses three logical layouts:

1. **Public** — `/`, `/login`, `/signup`. Marketing-shaped header, simple footer.
2. **App** — `/dashboard`, `/tree/[id]`. Top bar with user menu, no footer (mobile-app feel).
3. **Share** — `/share/[token]`. Top bar with the signup CTA banner; no user menu (no auth).

These map to Next.js layout files:

```
app/
├── layout.tsx                  # Root (theme, fonts)
├── (public)/layout.tsx         # Public marketing layout
├── (app)/layout.tsx            # Authenticated app layout
└── (share)/layout.tsx          # Read-only share layout
```

Route groups (parens) keep URLs flat (`/dashboard`, not `/app/dashboard`).
