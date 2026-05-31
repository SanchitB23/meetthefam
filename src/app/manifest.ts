import type { MetadataRoute } from "next";

/**
 * Web app manifest for PWA-style installs (Android Chrome, desktop Chrome).
 * Forest-green theme_color matches --primary from globals.css:
 *   oklch(0.36 0.04 155) ≈ #2D4A3E
 * Background cream matches --background:
 *   oklch(0.945 0.014 80) ≈ #F5EFE3
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "meetthefam",
    short_name: "meetthefam",
    description:
      "An heirloom-quality family-tree builder for the people who already know each other",
    start_url: "/",
    display: "standalone",
    background_color: "#F5EFE3",
    theme_color: "#2D4A3E",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
