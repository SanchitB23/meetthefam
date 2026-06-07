import type { NextConfig } from "next";
import path from "path";

// SPIKE #215 — turbopack.root is a valid runtime config but not yet typed in
// NextConfig; intersect it to silence tsc. Remove with the probe.
type SpikeConfig = NextConfig & { turbopack?: { root?: string } };

const nextConfig: SpikeConfig = {
  // Phase 5 photo-upload: people avatars live in the public Supabase
  // `photos` bucket. The Avatar component is plain <img> for v0.1
  // (locked decision 4 — coordinated swap to next/image is Phase 8
  // polish), but the config is set now so a Phase 8 <Image> swap is
  // a one-component change.
  //
  // Path shape: https://<project>.supabase.co/storage/v1/object/public/photos/...
  // `qualities` and `minimumCacheTTL` pinned per ADR 0007's Next.js 16
  // baseline (defaults changed in v16; explicit values are stable).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/photos/**",
      },
    ],
    qualities: [75],
    minimumCacheTTL: 14400, // 4 h, matches the v16 default
  },
  // SPIKE #215 — fix Turbopack workspace-root confusion in git worktrees.
  // Without this, Next.js infers the root from the parent pnpm-workspace.yaml
  // and won't find routes that exist only in this worktree. Remove with the probe.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
