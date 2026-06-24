import { ImageResponse } from "next/og";

// Apple touch / home-screen icon — light gray ground with a centered mountain.
// iOS applies its own rounded-corner mask, so the background is full-bleed.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#ecebe6",
        }}
      >
        <svg width="118" height="118" viewBox="0 0 64 64">
          <path d="M15 47 L39 16 L60 47 Z" fill="#1f1e1b" />
          <path d="M4 47 L24 25 L44 47 Z" fill="#cc785c" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
