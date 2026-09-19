import { portalRedirectResponse } from "@/lib/portal";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return portalRedirectResponse(request, "/portal");
}

export async function POST(request: Request) {
  return portalRedirectResponse(request, "/portal");
}
