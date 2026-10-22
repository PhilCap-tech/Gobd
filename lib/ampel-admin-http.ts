import { adminTokensMatch, bearerTokenFromHeader } from "@/lib/admin-wipe";
import { adminStatsToken } from "@/lib/ampel-admin";
import { AMPEL_ADMIN_CACHE_CONTROL, AMPEL_ADMIN_ROBOTS_TAG } from "@/lib/ampel-admin-headers";
import { AMPEL_STATS_TIMEZONE, buildAmpelStats, type AmpelStatsReport } from "@/lib/ampel-stats";
import {
  AMPEL_STEP_WINDOW_DAYS,
  buildAmpelStepReport,
  type AmpelStepReport,
  type AmpelStepRow,
} from "@/lib/ampel-step-event";
import { readAmpelStepRows } from "@/lib/ampel-step-store";
import {
  HOME_CTA_WINDOW_DAYS,
  buildHomeCtaReport,
  type HomeCtaReport,
  type HomeCtaRow,
} from "@/lib/home-cta-event";
import { readHomeCtaRows } from "@/lib/home-cta-store";
import type { ReadinessLead } from "@/lib/readiness";
import { listAmpelLeads } from "@/lib/store";
import {
  isSheetsOutage,
  SHEETS_RETRY_AFTER_SECONDS,
  SHEETS_RETRY_MESSAGE,
  sheetsStatusCode,
} from "@/lib/sheets-outage";

const BASE_HEADERS = {
  "Cache-Control": AMPEL_ADMIN_CACHE_CONTROL,
  "X-Robots-Tag": AMPEL_ADMIN_ROBOTS_TAG,
  "X-Content-Type-Options": "nosniff",
} as const;

export type AmpelStatsHttpResult = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
};

export type AmpelStatsHttpDeps = {
  /** Pass the key, including `undefined`, to avoid reading the process env. */
  token?: string | undefined;
  load?: () => Promise<ReadinessLead[]>;
  now?: () => Date;
};

function headers(extra?: Record<string, string>): Record<string, string> {
  return extra ? { ...BASE_HEADERS, ...extra } : { ...BASE_HEADERS };
}

export function ampelStatsError(error: unknown): { status: 503 | 500; message: string } {
  const status = isSheetsOutage(error) ? error.sheetsStatus : sheetsStatusCode(error);
  if (isSheetsOutage(error) || status === 429 || status >= 500) {
    console.error("[ampel-admin] sheets", status || 503);
    return { status: 503, message: SHEETS_RETRY_MESSAGE };
  }
  console.error("[ampel-admin] fehlgeschlagen", error instanceof Error ? error.name : "error");
  return { status: 500, message: "Die Auswertung ist fehlgeschlagen." };
}

function includeTests(url: string): boolean {
  const params = new URL(url).searchParams;
  return params.get("includeTests") === "1" || params.get("tests") === "1";
}

/**
 * Step counts for the last 14 Berlin days. `all` is the unfiltered
 * "Schritte (letzte 14 Tage)" table. `a` and `default` are that same
 * aggregation with the admin variant filter applied.
 */
export type AmpelStatsSteps =
  | { configured: false }
  | { error: true }
  | {
      configured: true;
      timezone: typeof AMPEL_STATS_TIMEZONE;
      windowDays: typeof AMPEL_STEP_WINDOW_DAYS;
      byVariant: {
        all: AmpelStepReport;
        a: AmpelStepReport;
        default: AmpelStepReport;
      };
    };

function stepsFromRows(rows: AmpelStepRow[], now: Date): Extract<AmpelStatsSteps, { configured: true }> {
  return {
    configured: true,
    timezone: AMPEL_STATS_TIMEZONE,
    windowDays: AMPEL_STEP_WINDOW_DAYS,
    byVariant: {
      all: buildAmpelStepReport(rows, { now }),
      a: buildAmpelStepReport(rows, { now, variant: "a" }),
      default: buildAmpelStepReport(rows, { now, variant: "default" }),
    },
  };
}

/**
 * Homepage CTA counts for the last 14 Berlin days, split by CTA and device.
 * `home_view` rows before `HOME_VIEW_COUNTING_FROM` stay in the sheet and
 * are left out of the view count and the click rate. A read failure is
 * `{ error: true }` and does not replace the lead report.
 */
export type HomeCtaStats =
  | { configured: false }
  | { error: true }
  | {
      configured: true;
      timezone: typeof AMPEL_STATS_TIMEZONE;
      windowDays: typeof HOME_CTA_WINDOW_DAYS;
      report: HomeCtaReport;
    };

function homeCtaFromRows(rows: HomeCtaRow[], now: Date): Extract<HomeCtaStats, { configured: true }> {
  return {
    configured: true,
    timezone: AMPEL_STATS_TIMEZONE,
    windowDays: HOME_CTA_WINDOW_DAYS,
    report: buildHomeCtaReport(rows, { now }),
  };
}

/** Sheet failures stay inside `homeCta`. The lead report still returns. */
async function loadHomeCtaStats(now: Date): Promise<HomeCtaStats> {
  try {
    const loaded = await readHomeCtaRows();
    if (!loaded.configured) return { configured: false };
    return homeCtaFromRows(loaded.rows, now);
  } catch {
    return { error: true };
  }
}

/** Sheet failures stay inside `steps`. The lead report still returns. */
async function loadAmpelStatsSteps(now: Date): Promise<AmpelStatsSteps> {
  try {
    const loaded = await readAmpelStepRows();
    if (!loaded.configured) return { configured: false };
    return stepsFromRows(loaded.rows, now);
  } catch {
    return { error: true };
  }
}

export async function handleAmpelStatsRequest(
  request: Request,
  deps: AmpelStatsHttpDeps = {},
): Promise<AmpelStatsHttpResult> {
  const expected = adminStatsToken("token" in deps ? deps.token : process.env.ADMIN_TOKEN);
  if (!expected) {
    return { status: 404, body: { error: "Not found" }, headers: headers() };
  }
  const provided = bearerTokenFromHeader(request.headers.get("authorization"));
  if (!provided || !adminTokensMatch(provided, expected)) {
    return { status: 401, body: { error: "Unauthorized" }, headers: headers() };
  }
  if (request.method !== "GET") {
    return { status: 405, body: { error: "Method not allowed" }, headers: headers() };
  }

  const load = deps.load ?? listAmpelLeads;
  const now = deps.now?.() ?? new Date();
  try {
    const rows = await load();
    const report: AmpelStatsReport = buildAmpelStats(rows, {
      now,
      includeTests: includeTests(request.url),
    });
    const steps = await loadAmpelStatsSteps(now);
    const homeCta = await loadHomeCtaStats(now);
    return { status: 200, body: { ...report, steps, homeCta }, headers: headers() };
  } catch (error) {
    const failure = ampelStatsError(error);
    const retry = failure.status === 503 ? { "Retry-After": SHEETS_RETRY_AFTER_SECONDS } : undefined;
    return { status: failure.status, body: { error: failure.message }, headers: headers(retry) };
  }
}
