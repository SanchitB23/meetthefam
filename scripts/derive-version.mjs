// Release-flow divergence fix — build-time version derivation.
//
// Runs as `prebuild`. Reads git state (with a GitHub API fallback for
// Vercel's tag-less shallow clone) and writes `src/lib/generated/version.ts`
// exporting an APP_VERSION constant.
//
// Format rules (locked decision #6 in
// docs/superpowers/specs/2026-05-15-release-flow-divergence-fix-design.md):
//
//   1. At a tagged commit (e.g., prod build of vX.Y.Z):  "X.Y.Z"
//   2. On a release/vX.Y.Z branch (preview rc build):    "X.Y.Z-rc.<short-sha>"
//   3. Anywhere else with a known latest tag:            "<latest-tag>-dev.<short-sha>"
//   4. No tags / shallow clone fallback:                 "0.0.0-dev.<short-sha>"
//
// Sources for "latest tag" (in order):
//   a. Local `git tag --list` — fastest; works locally + non-shallow CI.
//   b. GitHub API `/releases/latest` — fallback for Vercel's shallow clone
//      (Vercel doesn't persist git creds beyond the initial clone, so
//      `git fetch --tags origin` silently fails; the public REST API is
//      auth-free at 60 req/hr per IP, well within build-time budgets).
//
// See ADR 0009 Amendment 4 for full rationale.

import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUTPUT = 'src/lib/generated/version.ts'
const REPO_OWNER = process.env.VERCEL_GIT_REPO_OWNER || 'SanchitB23'
const REPO_NAME = process.env.VERCEL_GIT_REPO_SLUG || 'meetthefam'

function git(args) {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

async function latestTagFromGitHub() {
  // /releases/latest EXCLUDES prereleases. Pre-v1.0 all our releases are
  // flagged as prereleases per ADR 0009, so that endpoint 404s for us.
  // /releases (plural, with per_page=1) returns the most-recent release
  // regardless of prerelease flag.
  try {
    const r = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=1`,
      { headers: { 'User-Agent': 'meetthefam-derive-version' } },
    )
    if (!r.ok) return ''
    const data = await r.json()
    return Array.isArray(data) && data[0]?.tag_name ? data[0].tag_name : ''
  } catch {
    return ''
  }
}

// Checks whether the given tag points at the given commit SHA via the GitHub
// API. Handles annotated tags by dereferencing to the underlying commit.
// Returns false on any network or API error so callers always fall through
// safely.
async function tagPointsAtSha(tag, sha) {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/tags/${tag}`,
      { headers: { 'User-Agent': 'meetthefam-derive-version' } },
    )
    if (!r.ok) return false
    const data = await r.json()
    // Annotated tags: data.object.sha is the tag object, not the commit.
    // Dereference to get the underlying commit SHA.
    if (data.object?.type === 'tag') {
      const tagObj = await (
        await fetch(data.object.url, { headers: { 'User-Agent': 'meetthefam-derive-version' } })
      ).json()
      return tagObj.object?.sha === sha
    }
    return data.object?.sha === sha
  } catch {
    return false
  }
}

async function deriveVersion() {
  const shortSha =
    git('rev-parse --short HEAD') ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    ''

  // Case 1: HEAD is at a tagged commit (only detectable via local git).
  const exactTag = git('describe --tags --exact-match HEAD')
  if (exactTag) {
    console.log(`[derive-version] source=git-exact; APP_VERSION = ${exactTag.replace(/^v/, '')}`)
    return exactTag.replace(/^v/, '')
  }

  // Case 2: on a release/vX.Y.Z branch.
  const branch =
    process.env.VERCEL_GIT_COMMIT_REF ||
    git('symbolic-ref --short HEAD') ||
    ''
  const releaseBranchMatch = branch.match(/^release\/v(\d+\.\d+\.\d+)$/)
  if (releaseBranchMatch) {
    const v = `${releaseBranchMatch[1]}-rc.${shortSha || 'unknown'}`
    console.log(`[derive-version] source=release-branch; APP_VERSION = ${v}`)
    return v
  }

  // Case 3: dev build. Find the latest tag globally — local git first
  // (fast path), then GitHub API (fallback for Vercel's tag-less shallow
  // clone).
  let latestTag = git('tag --list --sort=-v:refname').split('\n').filter(Boolean)[0] || ''
  let source = 'git-local'
  if (!latestTag) {
    latestTag = await latestTagFromGitHub()
    if (latestTag) source = 'github-api'
  }

  if (latestTag) {
    // On Vercel's shallow clone, git tags are absent so Case 1 never fires.
    // Compare the latest tag's target commit against the current HEAD SHA via
    // the GitHub API; if equal, this IS a tagged-commit build → bare "X.Y.Z".
    const fullSha = git('rev-parse HEAD') || process.env.VERCEL_GIT_COMMIT_SHA || ''
    if (fullSha && (await tagPointsAtSha(latestTag, fullSha))) {
      const v = latestTag.replace(/^v/, '')
      console.log(`[derive-version] source=${source}-exact; latestTag=${latestTag}; APP_VERSION = ${v}`)
      return v
    }

    const v = `${latestTag.replace(/^v/, '')}-dev.${shortSha || 'unknown'}`
    console.log(`[derive-version] source=${source}; latestTag=${latestTag}; APP_VERSION = ${v}`)
    return v
  }

  // Case 4: no tag info available anywhere.
  const v = shortSha ? `0.0.0-dev.${shortSha}` : '0.0.0-dev'
  console.log(`[derive-version] source=fallback; APP_VERSION = ${v}`)
  return v
}

export { tagPointsAtSha, deriveVersion }

// Only write the generated file when run directly as a script, not when
// imported by the test suite.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = await deriveVersion()
  const content = `// Generated by scripts/derive-version.mjs at build time. Do not edit.
export const APP_VERSION = ${JSON.stringify(version)}
`

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, content)
}
