import { schnellversionOffered } from "@/lib/schnellversion-flag";

/** Käufe legt nur die bezahlte Session an. Dieser Endpunkt schreibt nichts. */
function closed(): Response {
  if (!schnellversionOffered()) return new Response(null, { status: 404 });
  return new Response(null, { status: 405 });
}

export const POST = closed;
export const GET = closed;
export const PUT = closed;
export const PATCH = closed;
export const DELETE = closed;
