import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
