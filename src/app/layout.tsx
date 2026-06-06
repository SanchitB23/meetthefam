import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VersionFooter } from "@/components/ui/VersionFooter";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "meetthefam",
  description:
    "An heirloom-quality family-tree builder for the people who already know each other",
  // favicon.ico + apple-icon.png in src/app/ are picked up automatically by
  // Next.js App Router file-based metadata conventions. We only add explicit
  // entries for the SVG and larger PNGs that don't have a reserved filename.
  icons: {
    icon: [
      // ICO fallback — browsers that don't support SVG will use this
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      // SVG — crisp at any resolution for modern browsers
      { url: "/logo.svg", type: "image/svg+xml" },
      // PNG sizes used by Android Chrome and social crawlers
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // apple-icon.png in src/app/ generates the auto <link rel="apple-touch-icon">
    // but we add it explicitly here so the URL is predictable (served from public/)
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "meetthefam",
    description: "An heirloom-quality family-tree builder",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "meetthefam",
    description: "An heirloom-quality family-tree builder",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <VersionFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
