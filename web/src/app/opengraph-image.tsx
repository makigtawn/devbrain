import { ImageResponse } from "next/og";

export const alt = "devbrain - Never solve the same problem twice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 20,
              background: "#6366f1",
              fontSize: 52,
            }}
          >
            🧠
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700 }}>
            devbrain
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 32,
            color: "#94a3b8",
          }}
        >
          Your AI-powered developer second brain
        </div>
      </div>
    ),
    { ...size },
  );
}
