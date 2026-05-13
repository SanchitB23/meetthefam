# Fonts — meetTheFam

Two families, **only the weights listed below** are used in the prototype.
Load these explicitly via `next/font`, `<link>`, or self-host — do not ship the full family.

## Cormorant Garamond — display

| Weight | Style    | Used for |
| ------ | -------- | -------- |
| 500    | regular  | Hero h1, page titles, profile names |
| 600    | regular  | Card titles, person names on nodes, section headers |
| 400    | italic   | Pull quotes, kickers, memory bodies |
| 500    | italic   | Hero "kicker" (e.g. *"family story"*) |

**Italic legibility floor: 16px.** Below that, italic Cormorant fails WCAG AA at body sizes.
Don't use italic for any UI label, badge, or button.

## Manrope — body / UI

| Weight | Used for |
| ------ | -------- |
| 400    | body copy, paragraph text |
| 500    | secondary buttons, pills, helper text |
| 600    | primary labels, nav items, stat labels, role kickers |
| 700    | (reserved — currently unused, do not load unless adding) |

## Loading recipe (Next.js)

```ts
import { Cormorant_Garamond, Manrope } from 'next/font/google';

export const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

export const body = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-body',
});
```

## What we deliberately do NOT use

- Cormorant **bold (700)** — too heavy for our cream palette
- Manrope **italic** — never; if italic is needed, use Cormorant
- System fallbacks for display — Cormorant has no good system equivalent;
  prefer FOUT to a system serif swap
