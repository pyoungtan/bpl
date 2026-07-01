import { ImageResponse } from "next/og";

// Apple touch / home-screen icon — white compass star centered on #FE4900.
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
          background: "#FE4900",
        }}
      >
        <svg width="118" height="118" viewBox="0 0 512 512">
          <path
            fill="#ffffff"
            d="M 256 1.5273438 L 228.91211 207.77539 L 137.86719 137.86719 L 207.77539 228.91211 L 1.5273438 256 L 207.77539 283.08789 L 137.86719 374.13281 L 228.91211 304.22461 L 256 510.47266 L 283.08789 304.22461 L 374.13281 374.13281 L 304.22461 283.08789 L 510.47266 256 L 304.22461 228.91211 L 374.13281 137.86719 L 283.08789 207.77539 L 256 1.5273438 z"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
