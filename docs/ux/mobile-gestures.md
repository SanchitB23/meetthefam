# Mobile gestures

The tree-view canvas relies on intentional gesture differentiation: tap and long-press should *not* mean the same thing.

## On a person card

| Gesture | Action |
|---|---|
| **Tap** | Open the person detail bottom sheet (avatar, name, bio, fields). Edit button visible iff user has edit role. |
| **Long-press (~500 ms)** | Open the action menu — "Re-center here," "Edit," "Set spouse," "Set parents," "Add child," "Delete." |
| **Three-dot icon** | Same action menu as long-press — for users who don't know about long-press. |
| **Double-tap** | Re-center the tree on this person. (Stretch v1.x; not in v1.0.) |

## On the canvas (empty area)

| Gesture | Action |
|---|---|
| **One-finger drag** | Pan the canvas |
| **Two-finger pinch** | Zoom in / out |
| **Tap empty area** | Close any open bottom sheet |

Pan + zoom handled by family-chart's built-in D3 zoom behavior. We don't override.

## Differentiating tap from long-press

JavaScript's `pointerdown`/`pointerup` events with a `setTimeout` for the 500 ms threshold:

```ts
let timer: number | null = null
let didLongPress = false

card.addEventListener('pointerdown', (e) => {
  didLongPress = false
  timer = window.setTimeout(() => {
    didLongPress = true
    openActionMenu(personId, e)
  }, 500)
})

card.addEventListener('pointerup', () => {
  if (timer) clearTimeout(timer)
  if (!didLongPress) openBottomSheet(personId)
})

card.addEventListener('pointercancel', () => {
  if (timer) clearTimeout(timer)
})
```

(Wrapped in a hook — `usePressActions(personId)`.)

## Hit area

Person cards must have a minimum hit area of **44 × 44 px** (Apple HIG) on mobile. Cards smaller than this require padding on the wrapping `<div>`, not the card itself.

## Haptic feedback

When a long-press triggers the action menu, fire `navigator.vibrate?.(10)` for tactile feedback. Best-effort — Safari iOS does not support `navigator.vibrate` (no-op).

## Bottom sheet vs full-screen modal

- **Bottom sheet** for person detail (read-mostly).
- **Full-screen modal** for forms (add / edit person, member management).
- **Alert dialog** for destructive confirmations (delete person, regenerate share token).

Use the shadcn/ui `<Sheet>` primitive for bottom sheets — set `side="bottom"` on mobile, `side="right"` on desktop via Tailwind breakpoint.

## Accessibility

- Action menu is keyboard-reachable: focus a card with Tab, press Enter for tap, press Space + hold for long-press equivalent (or always show the three-dot icon).
- Bottom sheet uses focus-trap so screen readers don't escape.
- All gesture-only flows have a non-gesture fallback (the three-dot icon).
