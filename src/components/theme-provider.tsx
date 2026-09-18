"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * next-themes writes the `dark` class onto <html> before paint, from a blocking inline
 * script. That means the server-rendered HTML never carries the class, which is why
 * <html> is marked suppressHydrationWarning in the root layout — without it React logs
 * a hydration warning for an attribute the browser is *supposed* to change first.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Colour tokens are on transition-all buttons and cards; without this the whole
      // page animates for 150ms on every theme change.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
