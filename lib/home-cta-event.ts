/**
 * Cookieless homepage CTA counts. The browser may send only `cta`.
 * The Berlin day and the device class are added on the server.
 *
 * `HOME_VIEW_ENABLED` is a compile-time constant, not an environment
 * variable. Page views are on. Sheet rows dated before
 * `HOME_VIEW_COUNTING_FROM` stay stored and are left out of the view
 * count and the click rate. Nothing in the sheet is deleted.
 */
export const HOME_VIEW_ENABLED = true;

/**
 * First Berlin day whose `home_view` rows count. 22.10.2026 still holds
 * views from before the counter was switched off, so that day stays out.
 */
export const HOME_VIEW_COUNTING_FROM = "2026-10-23";

const HOME_VIEW_ID = "home_view" as const;

const HOME_CTA_BUTTON_IDS = [
  "hero_ampel",
  "hero_checkout",
  "hero_muster",
  "price_checkout",
  "unsure_ampel",
  "unsure_readiness",
  "final_checkout",
  "final_ampel",
  "sticky_checkout",
  "header_checkout",
] as const;

export type HomeCtaId = typeof HOME_VIEW_ID | (typeof HOME_CTA_BUTTON_IDS)[number];

const HOME_CTA_IDS_WITH_VIEW = [HOME_VIEW_ID, ...HOME_CTA_BUTTON_IDS] as const satisfies readonly HomeCtaId[];

/** Ids POST accepts and the admin table shows. */
export const HOME_CTA_IDS: readonly HomeCtaId[] = HOME_VIEW_ENABLED ? HOME_CTA_IDS_WITH_VIEW : HOME_CTA_BUTTON_IDS;

export type HomeCtaButtonId = (typeof HOME_CTA_BUTTON_IDS)[number];

export const HOME_CTA_LABELS: Record<HomeCtaId, string> = {
  home_view: "Seitenaufruf",
  hero_ampel: "Hero: Ampel-Check",
  hero_checkout: "Hero: Dokumentation erstellen",
  hero_muster: "Hero: Muster",
  price_checkout: "Preise: Dokumentation erstellen",
  unsure_ampel: "Unsicher: Ampel-Check",
  unsure_readiness: "Unsicher: 3-Minuten-Check",
  final_checkout: "Abschluss: Dokumentation erstellen",
  final_ampel: "Abschluss: Ampel-Check",
  sticky_checkout: "Fixierte Leiste: Dokumentation erstellen",
  header_checkout: "Kopfzeile: Dokumentation erstellen",
};

export const HOME_CTA_COLUMNS = ["date", "cta", "device"] as const;

export const HOME_CTA_BODY_MAX_BYTES = 512;

export const HOME_CTA_WINDOW_DAYS = 14;

export type HomeCtaDevice = "mobile" | "desktop";

export type HomeCtaFields = {
  cta: HomeCtaId;
};

export type HomeCtaRow = HomeCtaFields & {
  date: string;
  device: HomeCtaDevice;
};

export type HomeCtaCount = {
  cta: HomeCtaId;
  mobile: number;
  desktop: number;
  total: number;
};

export type HomeCtaDayStat = {
  date: string;
  counts: HomeCtaCount[];
};

export type HomeCtaClickRate = {
  from: typeof HOME_VIEW_COUNTING_FROM;
  /** `home_view` rows inside the window, on or after `from`. */
  homeView: number;
  /** Button clicks inside the window, on or after `from`. `home_view` is not a click. */
  clicks: number;
  /** `clicks / homeView`, or null when `homeView` is 0. */
  rate: number | null;
  byCta: Array<{
    cta: HomeCtaButtonId;
    clicks: number;
    rate: number | null;
  }>;
};

export type HomeCtaReport = {
  days: HomeCtaDayStat[];
  total: HomeCtaDayStat;
  hasRows: boolean;
  clickRate: HomeCtaClickRate;
};

/** Admin label for the day views and the click rate start, e.g. `ab 23.10.2026`. */
export function homeViewCountingLabel(from: string = HOME_VIEW_COUNTING_FROM): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  if (!match) return `ab ${from}`;
  return `ab ${match[3]}.${match[2]}.${match[1]}`;
}

/** Percent in the admin table. A missing denominator is an en dash. */
export function formatHomeCtaClickRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "\u2013";
  const text = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(rate * 100);
  return `${text} %`;
}

const CTA_SET = new Set<string>(HOME_CTA_IDS);
const MOBILE_UA = /Mobile|Android|iPhone|iPad|iPod|IEMobile|Opera Mini|BlackBerry|webOS/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const BERLIN_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((item) => item.type === type)?.value ?? "0");
}

/** Calendar day in Europe/Berlin, `YYYY-MM-DD`, with no time. */
export function homeCtaDate(now: Date): string {
  const parts = BERLIN_DAY.formatToParts(now);
  const year = part(parts, "year");
  const month = String(part(parts, "month")).padStart(2, "0");
  const day = String(part(parts, "day")).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isHomeCtaDate(value: string): boolean {
  return DATE_ONLY.test(value);
}

export function isHomeCtaId(value: unknown): value is HomeCtaId {
  return typeof value === "string" && CTA_SET.has(value);
}

export function homeCtaDevice(userAgent: string): HomeCtaDevice {
  return MOBILE_UA.test(userAgent) ? "mobile" : "desktop";
}

/** The only accepted body is `{ cta }` with a whitelisted id. */
export function parseHomeCtaBody(input: unknown): HomeCtaFields | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== "cta") return null;
  if (!isHomeCtaId(record.cta)) return null;
  return { cta: record.cta };
}

export function homeCtaCells(row: HomeCtaRow): string[] {
  return [row.date, row.cta, row.device];
}

function cell(raw: string[] | undefined, index: number): string {
  return (raw?.[index] ?? "").trim();
}

function parseStoredRow(raw: string[]): HomeCtaRow | null {
  const date = cell(raw, 0);
  const cta = cell(raw, 1);
  const device = cell(raw, 2);
  if (!isHomeCtaDate(date) || date.includes("T") || date.includes(":")) return null;
  if (!isHomeCtaId(cta)) return null;
  if (device !== "mobile" && device !== "desktop") return null;
  return { date, cta, device };
}

/** Data rows under an exact 3-column header. A wrong header yields nothing. */
export function homeCtaRowsFromValues(values: string[][]): HomeCtaRow[] {
  if (values.length === 0) return [];
  const header = values[0].map((item) => item.trim());
  const headerOk =
    HOME_CTA_COLUMNS.every((column, index) => header[index] === column) &&
    header.slice(HOME_CTA_COLUMNS.length).every((item) => item === "");
  if (!headerOk) return [];
  const rows: HomeCtaRow[] = [];
  for (const raw of values.slice(1)) {
    const row = parseStoredRow(raw);
    if (row) rows.push(row);
  }
  return rows;
}

function addCalendarDays(iso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function homeCtaWindowDates(now: Date): string[] {
  const today = homeCtaDate(now);
  const dates: string[] = [];
  for (let offset = HOME_CTA_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    dates.push(addCalendarDays(today, -offset));
  }
  return dates;
}

function emptyCount(cta: HomeCtaId): HomeCtaCount {
  return { cta, mobile: 0, desktop: 0, total: 0 };
}

function rateOf(clicks: number, homeView: number): number | null {
  if (homeView === 0) return null;
  return clicks / homeView;
}

export function buildHomeCtaReport(rows: HomeCtaRow[], options: { now: Date }): HomeCtaReport {
  const dates = homeCtaWindowDates(options.now);
  const inWindow = new Set(dates);
  const byKey = new Map<string, HomeCtaCount>();
  const rateClicksByCta = new Map<HomeCtaButtonId, number>();
  let hasRows = false;
  let rateViews = 0;
  let rateClicks = 0;
  for (const row of rows) {
    // Ids outside the active whitelist are ignored. `home_view` before the
    // reactivation day stays in the sheet and is left out of the counts.
    if (!inWindow.has(row.date) || !isHomeCtaId(row.cta)) continue;
    if (row.cta === "home_view" && row.date < HOME_VIEW_COUNTING_FROM) continue;
    hasRows = true;
    const key = `${row.date}|${row.cta}`;
    const count = byKey.get(key) ?? emptyCount(row.cta);
    if (row.device === "mobile") count.mobile += 1;
    else count.desktop += 1;
    count.total = count.mobile + count.desktop;
    byKey.set(key, count);
    if (row.date < HOME_VIEW_COUNTING_FROM) continue;
    if (row.cta === "home_view") {
      rateViews += 1;
      continue;
    }
    rateClicks += 1;
    rateClicksByCta.set(row.cta, (rateClicksByCta.get(row.cta) ?? 0) + 1);
  }
  const days = dates.map((date) => ({
    date,
    counts: HOME_CTA_IDS.map((cta) => byKey.get(`${date}|${cta}`) ?? emptyCount(cta)),
  }));
  const totalCounts = HOME_CTA_IDS.map((cta) => {
    let mobile = 0;
    let desktop = 0;
    for (const day of days) {
      const count = day.counts.find((item) => item.cta === cta);
      mobile += count?.mobile ?? 0;
      desktop += count?.desktop ?? 0;
    }
    return { cta, mobile, desktop, total: mobile + desktop };
  });
  const byCta = HOME_CTA_BUTTON_IDS.map((cta) => {
    const clicks = rateClicksByCta.get(cta) ?? 0;
    return { cta, clicks, rate: rateOf(clicks, rateViews) };
  });
  return {
    days,
    total: { date: "Summe", counts: totalCounts },
    hasRows,
    clickRate: {
      from: HOME_VIEW_COUNTING_FROM,
      homeView: rateViews,
      clicks: rateClicks,
      rate: rateOf(rateClicks, rateViews),
      byCta,
    },
  };
}
