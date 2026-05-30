// Email-safe hex (translated from the OKLCH tokens in src/app/globals.css).
// Mail clients don't support OKLCH or CSS variables — these are literal hex,
// inlined into every element by React Email at render time.
export const colors = {
  bg: '#F5EFE3', // cream page background
  paper: '#FFFCF5', // card surface
  ink: '#2E2A24', // body text (warm charcoal)
  green: '#2D4A3E', // forest — wordmark + CTA fill
  onDark: '#FFFCF5', // text on the green button
  terracotta: '#C77B5C', // footer rule accent
  muted: '#6B6358', // hints, fallback link, footer
  hairline: '#E3DBCB', // borders / soft divider
} as const

// Web fonts are unreliable in mail clients, so these stacks lead with the
// brand fonts but always fall back to a system serif / sans. We do NOT add a
// <Font> / Google Fonts <link> — the fallback is the real renderer.
export const fonts = {
  serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  sans: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
} as const

// Build-time placeholder. React Email can mangle hrefs containing `{{ }}` and
// spaces, so we render with this real-looking URL and string-replace it with
// the Supabase token in the build script (see scripts/build-emails.ts).
export const CONFIRMATION_URL_SENTINEL = 'https://confirmation-url.placeholder'
