/** Käufe legt nur die bezahlte Session an. Dieser Endpunkt schreibt nichts. */
export async function POST(): Promise<Response> {
  return new Response(null, { status: 405 });
}

export async function GET(): Promise<Response> {
  return new Response(null, { status: 405 });
}
