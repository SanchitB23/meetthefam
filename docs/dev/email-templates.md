# Email templates

Branded transactional emails for meetthefam, authored in **React Email** and exported to static HTML that Supabase Auth consumes.

## Where things live

- **Source** (`emails/`): `theme.ts` (palette + fonts + URL sentinel), `components/AuthEmailLayout.tsx` (shared layout), `magic-link.tsx`, `confirm-signup.tsx`.
- **Exported HTML** (`supabase/templates/`): `magic_link.html`, `confirm_signup.html` — generated, committed.
- **Wiring**: `supabase/config.toml` → `[auth.email.template.magic_link]` + `[auth.email.template.confirmation]`.
- **Guard**: `src/__tests__/emails/templates.test.ts` fails if the committed HTML drifts from the source.
- **Visual reference**: `docs/ux/auth-email-wireframe.html` (the approved design).

## Authoring recipe

1. Edit the JSX in `emails/`.
2. Regenerate the HTML: `pnpm emails:build`.
3. Verify locally: restart the stack (`pnpm exec supabase stop && pnpm exec supabase start`), trigger an email via `/login`, and inspect it in **Mailpit** at `http://localhost:54324`. Check **both** paths — the returning-user *Magic Link* and the new-user *Confirm signup* (toggle `enable_confirmations = true` in `config.toml` + restart to force the confirmation path locally).
4. Run the guard: `pnpm test -- src/__tests__/emails/templates.test.ts`.
5. **QA**: upload the HTML via Supabase Dashboard → Authentication → Email Templates (Magic Link + Confirm signup).
6. **Prod**: deferred to the v1.0 launch batch — see `prod-readiness.md` §3.

### Quick end-to-end check without the browser

```bash
ANON=$(pnpm exec supabase status -o json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).ANON_KEY))")
curl -s -X POST http://127.0.0.1:54321/auth/v1/otp -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"email":"verify@example.com","create_user":true}'
# then read the latest message from the Mailpit API:
curl -s http://localhost:54324/api/v1/messages
```

## Constraints (why it's built this way)

- The CTA href uses a URL **sentinel** (`emails/theme.ts`) that the build script swaps for Supabase's `{{ .ConfirmationURL }}` — avoids React mangling a brace/space href. Supabase substitutes the real link at send time.
- **No web fonts** — the serif/sans stacks fall back to Georgia / system sans (mail clients drop web fonts).
- **Dark mode is best-effort** — inline styles beat `<style>`, so we only signal `color-scheme` and rely on client auto-dark; we don't ship manual dark overrides.
- The future collaboration-invite (#25) and share-link emails should reuse `AuthEmailLayout`.
