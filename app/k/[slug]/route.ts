import { kanzleiEntryPath } from "@/lib/kanzlei-toolbox-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const { slug } = await context.params;
  const location = await kanzleiEntryPath(slug, request.headers.get("user-agent") ?? "", request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
