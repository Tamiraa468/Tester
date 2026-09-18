"use client";

import { useEffect } from "react";

/**
 * The last resort: this replaces the root layout, so it renders its own <html> and
 * cannot use the app's fonts, theme or components. Everything it needs is inline.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="mn">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#171717",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>Алдаа гарлаа</h1>
          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.6, color: "#525252" }}>
            Түр зуурын алдаа гарлаа. Дахин оролдоно уу.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              border: 0,
              borderRadius: "0.625rem",
              background: "#171717",
              color: "#fafafa",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Дахин оролдох
          </button>
        </main>
      </body>
    </html>
  );
}
