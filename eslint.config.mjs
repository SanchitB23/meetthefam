import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored design references — see docs/ux/inspiration/README.md.
    // Not maintained by us; not subject to repo lint rules.
    "docs/ux/inspiration/**",
    // Agent scratch space. `.claude/worktrees/` holds full src/ copies from
    // leftover git worktrees; linting them produces phantom errors (the dir is
    // gitignored, so CI never sees them). Ignore all .claude/ content, nested too.
    ".claude/**",
    "**/.claude/**",
    // Throwaway spike #214 harness — runs under `tsx`, not the app build; uses
    // `.ts` import extensions the repo tsc/eslint config rejects. Branch-local.
    "scripts/spike-214/**",
  ]),
]);

export default eslintConfig;
