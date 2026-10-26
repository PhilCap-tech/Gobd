import { defaultDs24IpnDeps, ds24ParamMap, handleDs24Ipn } from "@/lib/digistore24-ipn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Digistore24 IPN. Digistore24 sendet die Felder form-kodiert per POST.
 * Ohne DIGISTORE24_IPN_PASSPHRASE 503, falsche Signatur 403, sonst `OK`.
 */
export async function POST(request: Request) {
  const deps = defaultDs24IpnDeps();
  if (!deps.passphrase) return text("", 503);
  let params: Map<string, string>;
  try {
    const form = await request.formData();
    const entries: [string, string][] = [];
    form.forEach((value, key) => {
      if (typeof value === "string") entries.push([key, value]);
    });
    params = ds24ParamMap(entries);
  } catch {
    return text("", 400);
  }
  try {
    const result = await handleDs24Ipn(params, deps);
    return text(result.body, result.status);
  } catch (error) {
    console.error("[ds24] IPN fehlgeschlagen", error instanceof Error ? error.name : "error");
    return text("ERROR", 500);
  }
}
