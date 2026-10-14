import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// Telugu letters are not in Inter; this keeps them crisp instead of falling back to a system font.
const telugu = Noto_Sans_Telugu({ variable: "--font-telugu", subsets: ["telugu"], display: "swap" });

export const metadata: Metadata = {
  title: { default: `${BRAND.NAME} — ${BRAND.TAGLINE}`, template: `%s · ${BRAND.NAME}` },
  description: BRAND.ABOUT,
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#4f46e5", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${telugu.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
