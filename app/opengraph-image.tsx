import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HOME_TITLE } from "@/lib/seo";

export const alt = HOME_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const logoData = await readFile(
    join(process.cwd(), "public/brand/logo-mark.png"),
    "base64",
  );
  const logoSrc = `data:image/png;base64,${logoData}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f4f5f2",
          color: "#24302b",
        }}
      >
        <div style={{ width: 18, height: "100%", background: "#1f6b4a" }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 72px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <img src={logoSrc} width={72} height={72} alt="" />
            <div
              style={{
                marginLeft: 18,
                fontSize: 28,
                color: "#1f6b4a",
                fontWeight: 700,
              }}
            >
              GoBD Verfahrensdoku
            </div>
          </div>
          <div
            style={{
              marginTop: 36,
              fontSize: 56,
              lineHeight: 1.15,
              fontWeight: 700,
              maxWidth: 980,
            }}
          >
            GoBD-Verfahrensdokumentation online erstellen
          </div>
          <div style={{ marginTop: 24, fontSize: 28, color: "#3d4742" }}>
            PDF plus offene Punkte
          </div>
          <div style={{ marginTop: 36, fontSize: 22, color: "#3d4742" }}>
            Kein Steuerberatungsersatz
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
