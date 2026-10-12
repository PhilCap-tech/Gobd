import { NextResponse } from "next/server";
import {
  isSheetsOutage,
  SHEETS_RETRY_AFTER_SECONDS,
  SHEETS_RETRY_MESSAGE,
} from "@/lib/sheets-outage";

/** 503 with Retry-After. Callers must use this instead of 403, 404, or 409. */
export function sheetsOutageResponse(error: unknown): NextResponse | null {
  if (!isSheetsOutage(error)) return null;
  return NextResponse.json(
    { error: SHEETS_RETRY_MESSAGE },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": SHEETS_RETRY_AFTER_SECONDS,
      },
    },
  );
}
