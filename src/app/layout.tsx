import type { Metadata, Viewport } from "next";
import { Inter, Literata } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { mn } from "@/lib/i18n/mn";
import "./globals.css";

// cyrillic-ext is required: Mongolian Ө ө Ү ү are not in the "cyrillic" subset.
// Both families are variable fonts, so every weight — including bold — comes from the
// same files and Ө / Ү never fall back to a system face.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

// Question text is set in a serif, the way it reads in the printed book.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

// Absolute URLs for og:image. Set NEXT_PUBLIC_SITE_URL in production.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: mn.app.title,
    // Page titles are short nouns ("Дадлага"); the suffix names the product.
    template: `%s · ${mn.app.name}`,
  },
  description: mn.app.description,
  applicationName: mn.app.name,
  openGraph: {
    type: "website",
    locale: "mn_MN",
    siteName: mn.app.name,
    title: mn.app.title,
    description: mn.app.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: mn.app.title,
    description: mn.app.description,
  },
  // The question bank is licensed material behind a login; keep it out of indexes.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Matches the page background in each theme, so the mobile browser chrome follows it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets the `dark` class on <html> from a
    // blocking script before React hydrates. It is scoped to this element's attributes.
    <html
      lang="mn"
      suppressHydrationWarning
      className={`${inter.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {/* Clerk lives in AuthProvider, mounted only under /(app) and the sign-in
              pages: the landing page and the 404 load no cross-origin auth script. */}
          <a
            href="#main"
            className="sr-only rounded-lg bg-primary px-4 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:h-11 focus:items-center"
          >
            {mn.nav.skipToContent}
          </a>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
