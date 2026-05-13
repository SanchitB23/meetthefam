# Component handoff notes — integration recipes

These are the **non-visual contracts** for each component. Before adopting in a real app,
verify the layout-engine assumptions called out below.

## `<PersonNode person current onClick onAdd size>`
**Layout assumption:** absolutely positioned by parent (the prototype tree uses fixed-pixel
`TREE_LAYOUT` coords on a 1000×720 canvas).
**Before vendoring:** if you're rendering inside a D3 / family-chart layout engine, the
node's `position: relative` will break drag/zoom transforms. Wrap in a `<g>` or pass the
component a `coordsInjected` prop and let the layout engine own positioning.
**Hover affordance:** the "+" button is rendered conditionally based on parent's hover
state, not its own. Plan how this maps in a touch context (no hover) — usually a
long-press or a per-node action sheet.
**Size variants:** `s` (132px), `m` (158px), `l` (188px). Connector math (curves in
`Connectors`) assumes `m`. Mixing sizes in one tree will break line endpoints.

## `<Avatar person size ring glow>`
Pure visual, no layout dependency. Safe to drop in.
Initials are derived from `person.initials`, NOT computed — pre-compute upstream.

## `<Pill tone size icon onClick active>`
**Tones:** `neutral | accent | green | ghost`. **Sizes:** `s | m`. No layout assumptions.

## `<Button kind size icon iconRight>`
**Kinds:** `primary | accent | ghost | bare`. Stretches to `fullWidth` only when set.
Box-shadow uses fixed RGBs — won't tint correctly in dark mode without an override.

## `<Card padding style>`
Surface only. Doesn't manage focus, role, or aria. If using as a clickable, add
`role="button"` and a focus ring — the prototype omits both.

## `<TreeViewScreen view onViewChange onSelectPerson onAddRelative current>`
**Not a generic component.** This is a screen-level composition pinned to the demo
`FAMILY` global. To reuse, replace the `FAMILY.people` lookup with a prop and accept
a `layout` injection in place of the static `TREE_LAYOUT`.

## Responsive contract
Mobile screens (`screens-mobile.jsx`) are **separate compositions**, not breakpoint
variants of the desktop screens. Production should pick one path:
- (a) responsive components with `sm:` / `md:` breakpoint classes, OR
- (b) explicitly two routes (`/m/tree`, `/d/tree`) with a redirect.
The prototype models neither — treat the mobile screens as concept art, not a contract.

## Tweaks panel
**Not for production.** Keep it (and `tweaks-panel.jsx`) under `playground/` or behind a
`?dev=1` flag. The CSS-var-rewrite approach is fine for prototypes but bypasses
shadcn's `.dark`-class token system.
