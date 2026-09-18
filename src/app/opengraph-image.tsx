import { ImageResponse } from "next/og";
import { mn } from "@/lib/i18n/mn";

export const alt = mn.app.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const POINTS = [
  "Албан ёсны асуултын сан",
  "Хариултын дараалал бүр удаа холилдоно",
  "Ахиц дэвшлийн хяналт",
];

/**
 * No `fonts` option on purpose: ImageResponse falls back to the Geist face bundled with
 * Next, which covers Mongolian Cyrillic including Ө and Ү. Loading a webfont here would
 * make the build depend on the network. Only the regular weight exists in that fallback,
 * so the hierarchy is built from size and colour rather than from bold.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#fafafa",
                display: "flex",
              }}
            />
            <div style={{ fontSize: 34, color: "#a1a1a1" }}>{mn.app.name}</div>
          </div>
          <div style={{ fontSize: 68, lineHeight: 1.25, maxWidth: 900 }}>{mn.app.title}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {POINTS.map((point) => (
            <div key={point} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{ width: 12, height: 12, borderRadius: 6, background: "#7c86ff", display: "flex" }}
              />
              <div style={{ fontSize: 32, color: "#d4d4d4" }}>{point}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
