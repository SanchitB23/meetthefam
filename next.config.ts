import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // lucide-react ships per-icon entry points; this lets Next 16's compiler
    // tree-shake it reliably across the app (icons are imported app-wide).
    // Zero behaviour change. Perf #249.
    optimizePackageImports: ["lucide-react"],
  },
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
};

export default nextConfig;
