# Avatars and the 5-tone system

The avatar system covers two visual jobs:

1. **When a person has a photo** → display the photo in a circular crop, no tone tint.
2. **When a person has no photo** → display their initials on a tinted circle drawn from a fixed 5-color palette ("tones"). Every person row carries a `tone` field; the tone is *deterministic* per person so the avatar never flickers between renders.

This spec captures the tone palette, the CSS variables, the auto-assignment rule, and the `<Avatar>` component contract. Adopted per [ADR 0008](../adrs/0008-design-system.md). Source values come from [`inspiration/kintree/project/data.jsx`](inspiration/kintree/project/data.jsx) → `TONES`.

## The 5 tones

| Tone | `bg` (avatar fill) | `ring` (current-person highlight) | `ink` (initials text) |
|---|---|---|---|
| `sage` | `#E4ECDD` | `#A9BC92` | `#3D5340` |
| `rose` | `#F1DAD0` | `#D49A85` | `#7A3F2C` |
| `indigo` | `#DDE0EC` | `#8E96B8` | `#3B4068` |
| `amber` | `#F2E3C5` | `#C9A86A` | `#6E5224` |
| `green` | `#CFE0CD` | `#7DA078` | `#2D4A3E` (= `--primary`) |

These are warm, low-chroma hues chosen to read calmly against the cream/paper page background. They are NOT meant to encode demographic information — never use a particular tone to imply gender, generation, or family branch.

## CSS variables

Defined in [`src/app/globals.css`](../../src/app/globals.css) under `:root`. OKLCH values approximate the hex values above.

```css
/* sage */
--tone-sage-bg:   oklch(0.92 0.025 130);
--tone-sage-ring: oklch(0.74 0.045 135);
--tone-sage-ink:  oklch(0.36 0.030 150);

/* rose */
--tone-rose-bg:   oklch(0.89 0.025 55);
--tone-rose-ring: oklch(0.70 0.070 45);
--tone-rose-ink:  oklch(0.41 0.080 40);

/* indigo */
--tone-indigo-bg:   oklch(0.89 0.015 265);
--tone-indigo-ring: oklch(0.62 0.035 265);
--tone-indigo-ink:  oklch(0.32 0.060 275);

/* amber */
--tone-amber-bg:   oklch(0.91 0.040 85);
--tone-amber-ring: oklch(0.72 0.085 80);
--tone-amber-ink:  oklch(0.40 0.070 75);

/* green */
--tone-green-bg:   oklch(0.87 0.030 140);
--tone-green-ring: oklch(0.62 0.060 140);
--tone-green-ink:  oklch(0.36 0.040 155);
```

Naming convention: `--tone-<name>-<role>` where `<role>` is exactly one of `bg`, `ring`, `ink`. Don't introduce new roles without updating this doc.

## Default-tone assignment

When a person row is inserted, if `tone` is null, auto-assign **deterministically** based on the person's name:

```ts
const TONE_ORDER = ['sage', 'rose', 'indigo', 'amber', 'green'] as const;

function defaultTone(fullName: string): typeof TONE_ORDER[number] {
  // Cheap deterministic hash — sum of char codes.
  let h = 0;
  for (const ch of fullName) h = (h + ch.charCodeAt(0)) >>> 0;
  return TONE_ORDER[h % TONE_ORDER.length];
}
```

**Why deterministic**: photos can be added later, but until they are, the avatar tone shouldn't change between renders or sessions. Random-on-insert would mean two siblings with the same first name get different tones; hash-based gives the same input the same tone every time.

**Why hash-based and not round-robin**: round-robin (insertion-order modulo 5) couples the tone to creation timing. Hash decouples it from anything mutable — re-import the same tree and you get the same tones.

**Why not gender-based**: tones aren't a demographic label. See "What tones are NOT for" below.

The user can override the default via the person-edit form.

## `<Avatar>` component contract

Lives at `src/components/ui/avatar.tsx` (built in Phase 3). Roughly:

```tsx
type Tone = 'sage' | 'rose' | 'indigo' | 'amber' | 'green';

type AvatarProps = {
  fullName: string;
  initials?: string;        // computed from fullName if absent
  photoUrl?: string | null; // when present, photo replaces the tinted background
  tone: Tone;               // required; come from people.tone
  size?: 'sm' | 'md' | 'lg' | number; // default 'md' = 56px
  ring?: boolean;           // true = "current person" treatment with --tone-X-ring
};
```

Behavior:

- **Photo present**: render `<img>` in a circular mask. The `tone` is ignored visually but still drives the `ring` color when `ring={true}`.
- **No photo**: tinted circle (`bg` from tone) with the initials in the `ink` color. Initials use Cormorant Garamond (heading font) at ~`size * 0.34` font-size, weight 600, with `letter-spacing: 0.02em` — matching the prototype's `Avatar` in [`shared.jsx`](inspiration/kintree/project/shared.jsx).

## What tones are NOT for

- **Not a gender / sex indicator** — never assign tones based on `people.gender`.
- **Not a status badge** — don't repurpose tones to mean "owner" / "editor" / "viewer."
- **Not a pickable theme** — the palette is fixed at five. Don't expose UI to add new tones; that's a v2.0 conversation.

## family-chart integration

When a person renders inside the family-chart visualization (Phase 4 — see [ADR 0008](../adrs/0008-design-system.md) → PersonNode go/no-go gate), the same tone applies to the node's avatar tile. If the go/no-go spike concludes that custom HTML nodes don't fit family-chart's layout, the fallback is to apply the tone's `bg` color via CSS variables to family-chart's default rectangular nodes — preserving the system without needing a custom renderer.
