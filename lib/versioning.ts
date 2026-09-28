/**
 * Validity intervals for a Verfahrensdokumentation version family.
 *
 * Stored columns (all optional on old rows):
 * - valid_from / valid_to: ISO dates `YYYY-MM-DD`
 * - change_summary, changed_by
 *
 * Gültig-bis is not written back onto older Sheet rows. When valid_to is
 * empty, the UI treats the version as ending the day before the next
 * Gültig-ab (“bis vor nächster”), or as open if there is no later start.
 *
 * Aktuell:
 * 1. Prefer the version whose interval includes today (Europe/Berlin).
 *    Interval = valid_from (inclusive) through effective valid_to (inclusive).
 *    A legacy row with no valid_from is in force until a later version number
 *    declares a Gültig-ab, so an untouched document is still current.
 * 2. If several intervals include today, the latest valid_from wins; a tie
 *    goes to the higher version number. Empty valid_from sorts as oldest.
 * 3. If none include today, Aktuell is the latest by valid_from, then version
 *    number (badge: “Aktuell · letzte Fassung”).
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type VersionIntervalRow = {
  documentId: string;
  version: string;
  validFrom: string;
  validTo: string;
};

export type VersionChange = {
  validFrom: string;
  validTo: string;
  changeSummary: string;
  changedBy: string;
};

export type VersionPdfMeta = {
  /** `dd.mm.yyyy` or empty. */
  validFrom: string;
  validTo: string;
  changeSummary: string;
  changedBy: string;
};

export type CurrentVersionPick<T extends VersionIntervalRow> = {
  row: T;
  /** No interval includes today; the latest-by-date fallback was used. */
  fallback: boolean;
};

const MAX_SUMMARY = 500;
const MAX_WHO = 200;

export const CURRENT_VERSION_RULE =
  "Aktuell ist die Fassung, deren Gültigkeit den heutigen Tag einschließt. Leeres Gültig-bis endet am Tag vor dem nächsten Gültig-ab, sonst bleibt die Fassung offen. Liegt keine solche Fassung vor, gilt die letzte nach Gültig-ab, dann Versionsnummer.";

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function berlinTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dayBeforeIso(iso: string): string {
  const match = ISO_DATE.exec(iso.trim());
  if (!match) return "";
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function formatIsoDateDe(iso: string): string {
  if (!isIsoDate(iso)) return "";
  const [year, month, day] = iso.trim().split("-");
  return `${day}.${month}.${year}`;
}

export function versionNumber(row: { version: string }): number {
  const n = Number.parseInt(String(row.version || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function versionLabelFromRow(row: { version: string }): string {
  return `${versionNumber(row)}.0`;
}

function dated(row: VersionIntervalRow): boolean {
  return isIsoDate(row.validFrom);
}

/**
 * The next Gültig-ab that closes this version.
 * Dated rows close at the earliest later start date (version number does not
 * matter — a backdated start can sit before a higher version).
 * Undated legacy rows close at the earliest Gültig-ab of a higher version number.
 */
export function nextValidFrom(
  row: VersionIntervalRow,
  family: VersionIntervalRow[],
): string {
  const others = family.filter(
    (item) => item.documentId !== row.documentId && dated(item),
  );
  if (dated(row)) {
    const later = others
      .filter((item) => item.validFrom > row.validFrom)
      .sort(
        (a, b) =>
          a.validFrom.localeCompare(b.validFrom) ||
          versionNumber(a) - versionNumber(b),
      );
    return later[0]?.validFrom ?? "";
  }
  const mine = versionNumber(row);
  const laterNumber = others
    .filter((item) => versionNumber(item) > mine)
    .sort(
      (a, b) =>
        a.validFrom.localeCompare(b.validFrom) ||
        versionNumber(a) - versionNumber(b),
    );
  return laterNumber[0]?.validFrom ?? "";
}

/** Stored valid_to, otherwise the day before the next Gültig-ab, otherwise open. */
export function effectiveValidTo(
  row: VersionIntervalRow,
  family: VersionIntervalRow[],
): string {
  if (isIsoDate(row.validTo)) return row.validTo.trim();
  const next = nextValidFrom(row, family);
  return next ? dayBeforeIso(next) : "";
}

export function intervalCoversDate(
  row: VersionIntervalRow,
  family: VersionIntervalRow[],
  day: string,
): boolean {
  if (!isIsoDate(day)) return false;
  const until = effectiveValidTo(row, family);
  if (dated(row)) {
    if (row.validFrom > day) return false;
    if (!until) return true;
    return until >= day;
  }
  if (!until) return true;
  return until >= day;
}

export function selectCurrentVersion<T extends VersionIntervalRow>(
  versions: T[],
  today = berlinTodayIso(),
): CurrentVersionPick<T> | null {
  if (versions.length === 0) return null;
  const covering = versions.filter((row) =>
    intervalCoversDate(row, versions, today),
  );
  const fallback = covering.length === 0;
  const pool = fallback ? versions : covering;
  const ranked = [...pool].sort((a, b) => {
    const aFrom = dated(a) ? a.validFrom : "";
    const bFrom = dated(b) ? b.validFrom : "";
    if (aFrom !== bFrom) {
      if (!aFrom) return 1;
      if (!bFrom) return -1;
      return aFrom < bFrom ? 1 : -1;
    }
    return versionNumber(b) - versionNumber(a);
  });
  const row = ranked[0];
  if (!row) return null;
  return { row, fallback };
}

export function currentVersionBadge(fallback: boolean): string {
  return fallback ? "Aktuell · letzte Fassung" : "Aktuell";
}

export function formatValidityRange(
  row: VersionIntervalRow,
  family: VersionIntervalRow[],
): string {
  const from = dated(row) ? formatIsoDateDe(row.validFrom) : "—";
  const until = effectiveValidTo(row, family);
  const untilLabel = until ? formatIsoDateDe(until) : "offen";
  return `von ${from} bis ${untilLabel}`;
}

function plainText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeVersionChange(
  input: {
    validFrom?: unknown;
    validTo?: unknown;
    changeSummary?: unknown;
    changedBy?: unknown;
  },
  options: { version: number; defaultChangedBy?: string },
): VersionChange | { error: string } {
  const requireMeta = options.version > 1;
  let validFrom = typeof input.validFrom === "string" ? input.validFrom.trim() : "";
  const validTo = typeof input.validTo === "string" ? input.validTo.trim() : "";
  let changeSummary =
    typeof input.changeSummary === "string" ? input.changeSummary : "";
  let changedBy = typeof input.changedBy === "string" ? input.changedBy : "";

  if (!validFrom) {
    if (requireMeta) return { error: "Gültig ab fehlt." };
    validFrom = berlinTodayIso();
  }
  if (!isIsoDate(validFrom)) {
    return { error: "Gültig ab ist kein Datum (JJJJ-MM-TT)." };
  }

  if (validTo) {
    if (!isIsoDate(validTo)) {
      return { error: "Gültig bis ist kein Datum (JJJJ-MM-TT)." };
    }
    if (validTo < validFrom) {
      return { error: "Gültig bis liegt vor Gültig ab." };
    }
  }

  changeSummary = plainText(changeSummary, MAX_SUMMARY + 1);
  if (changeSummary.length > MAX_SUMMARY) {
    return { error: "Kurz-Changelog ist zu lang." };
  }
  if (!changeSummary) {
    if (requireMeta) return { error: "Kurz-Changelog fehlt." };
    changeSummary = "Erstfassung";
  }

  changedBy = plainText(changedBy, MAX_WHO + 1);
  if (!changedBy) changedBy = plainText(options.defaultChangedBy ?? "", MAX_WHO + 1);
  if (changedBy.length > MAX_WHO) return { error: "Wer ist zu lang." };
  if (!changedBy && requireMeta) return { error: "Wer fehlt." };

  return { validFrom, validTo, changeSummary, changedBy };
}

export function versionChangeDraftError(
  draft: {
    validFrom: string;
    validTo: string;
    changeSummary: string;
    changedBy: string;
  },
  options: { requireSummary: boolean },
): string {
  if (!draft.validFrom.trim()) return "Gültig ab fehlt.";
  const result = normalizeVersionChange(draft, {
    version: options.requireSummary ? 2 : 1,
    defaultChangedBy: draft.changedBy,
  });
  return "error" in result ? result.error : "";
}

function pdfPlain(value: string): string {
  return value.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

export function toVersionPdfMeta(change: VersionChange): VersionPdfMeta {
  return {
    validFrom: formatIsoDateDe(change.validFrom),
    validTo: formatIsoDateDe(change.validTo),
    changeSummary: pdfPlain(change.changeSummary),
    changedBy: pdfPlain(change.changedBy),
  };
}

export function versionMetaSentence(meta: VersionPdfMeta | undefined): string {
  if (!meta) return "";
  const parts: string[] = [];
  if (meta.validFrom) {
    parts.push(
      meta.validTo
        ? `Gültig ab ${meta.validFrom} bis ${meta.validTo}`
        : `Gültig ab ${meta.validFrom}`,
    );
  }
  if (meta.changeSummary) parts.push(`Änderung: ${meta.changeSummary}`);
  if (meta.changedBy) parts.push(`Geändert durch ${meta.changedBy}`);
  if (parts.length === 0) return "";
  return `${parts.join(". ")}.`;
}
