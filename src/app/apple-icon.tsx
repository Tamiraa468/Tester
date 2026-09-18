import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The home-screen icon: the same mark as icon.svg, drawn as boxes because Apple only
 * accepts a raster icon. No text, so it needs no font.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
          padding: 45,
          background: "#171717",
        }}
      >
        <div style={{ width: 90, height: 17, borderRadius: 9, background: "#fafafa" }} />
        <div style={{ width: 62, height: 17, borderRadius: 9, background: "#fafafa" }} />
        <div style={{ display: "flex" }}>
          <svg width="90" height="48" viewBox="0 0 90 48" fill="none">
            <path
              d="M3 27 L21 45 L66 6"
              stroke="#fafafa"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
