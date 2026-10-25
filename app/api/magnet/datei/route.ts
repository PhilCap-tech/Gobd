import { downloadMagnet, magnetRenewPath } from "@/lib/vorlagen/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return text("Nicht gefunden", 404);
  const result = await downloadMagnet(token, { userAgent: request.headers.get("user-agent") ?? "" });
  if (!result.ok) {
    if (result.status === 410) {
      const next = magnetRenewPath(result.token);
      const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Link abgelaufen</title></head><body><p>Dieser Link ist abgelaufen. Fordern Sie einen neuen Link an.</p><p><a href="${next}">Neuen Link anfordern</a></p></body></html>`;
      return new Response(html, {
        status: 410,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return text("Nicht gefunden", 404);
  }
  return new Response(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
