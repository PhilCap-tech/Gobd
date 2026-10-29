/**
 * Kontoansicht Preismodell v2: alles, was die Karte braucht, als Text.
 * Liest den Plan nur bei PLAN_ACCESS_ENABLED (Default: PRICING_MODEL=v2).
 */
import { formatBerlinDate } from "@/lib/kuendigung";
import {
  deletionDueAt,
  memberCancelPlan,
  memberCancelPreviewLine,
  refundStatus,
  refundStatusLine,
  type PlanAccess,
  type PlanRow,
  type RefundStatus,
} from "@/lib/plan";
import { loadPlanAccess } from "@/lib/plan-access";
import {
  PLAN_PACKAGE_ENTRY_TITLE,
  PLAN_REACTIVATE_PRICE_LINE,
  PLAN_REACTIVATE_SMALL,
  PLAN_REACTIVATE_TEXT_2,
  PLAN_REACTIVATE_TITLE,
  planReactivateText,
} from "@/lib/plan-copy";
import { planLifecycleEnabled } from "@/lib/pricing-model";

export type AccountPlanView = {
  state: PlanAccess["state"];
  title: string;
  lines: string[];
  canBuyChange: boolean;
  canBecomeMember: boolean;
  /** Mitglied ohne geplante Kündigung: Kündigen-Formular zeigen. */
  canCancel: boolean;
  canWithdrawCancel: boolean;
  cancelPreview: string;
  changeCredits: number;
  refund: RefundStatus;
  refundLine: string;
  /**
   * PLAN_LIFECYCLE_ENABLED aus (Default, CoS 27.10.): nur ein schlichter
   * Hinweis (Paket), keine Fristen, Käufe oder eigener Kündigungsstichtag.
   */
  simple?: boolean;
  /** Schlichter Hinweis, Mitglied mit Abo: Knopf zum Stripe-Kundenportal. */
  portalCancel?: boolean;
  /** Neues Modell: Zugangsende (Option 1) als Datum, leer bei Jahrespaket. */
  accessUntil?: string;
  /** Neues Modell: Jahrespaket nachbuchen (innerhalb der 30 Tage). */
  canAddon?: boolean;
  /** Neues Modell: Konto deaktiviert (nach Tag 30), Reaktivierung anbieten. */
  deactivated?: boolean;
};

const TITLES: Record<PlanAccess["state"], string> = {
  // Kündigungsweg laut AGB § 12 Abs. 3 / FAQ 10: „Jahresmitgliedschaft“ → „Mitgliedschaft kündigen“.
  member: "Jahresmitgliedschaft",
  window: "Ohne Mitgliedschaft · Frist läuft",
  expired: "Frist abgelaufen",
  refunded: "Kauf erstattet",
  deleted: "Dokumentation gelöscht",
};

export function accountPlanView(
  row: PlanRow,
  access: PlanAccess,
  documents: readonly { pdfUrl?: string; timestamp?: string }[],
  now: Date = new Date(),
): AccountPlanView {
  const lines: string[] = [];
  const due = deletionDueAt(row, now);
  if (access.state === "member") {
    lines.push("Alle Änderungen sind inklusive.");
    if (row.memberCancelAt) {
      lines.push(`Gekündigt zum ${formatBerlinDate(row.memberCancelAt)}.`);
      if (due) lines.push(`Danach löschen wir die Dokumentation bei uns (${formatBerlinDate(due)}). Ihr PDF behalten Sie.`);
    } else if (row.memberPeriodEnd) {
      lines.push(`Nächste Verlängerung am ${formatBerlinDate(row.memberPeriodEnd)}.`);
    }
  } else if (access.state === "window") {
    lines.push(`Ihre Dokumentation liegt bei uns bis ${formatBerlinDate(row.retentionUntil)}. Danach löschen wir sie; Ihr PDF behalten Sie.`);
    lines.push(
      row.changeCredits > 0
        ? `Bezahlte Änderung verfügbar: ${row.changeCredits} neue Version.`
        : "Eine Änderung (neue Version) kostet 49 € netto und verlängert die Frist um 12 Monate ab Zahlung.",
    );
  } else if (access.state === "expired") {
    lines.push(access.writeMessage);
  } else {
    lines.push(access.writeMessage);
  }
  const cancel =
    access.state === "member" && !row.memberCancelAt ? memberCancelPlan(row.memberPeriodEnd, now) : null;
  const refund = refundStatus(row, documents, now);
  return {
    state: access.state,
    title: TITLES[access.state],
    lines,
    canBuyChange: access.canBuyChange,
    canBecomeMember: access.canBecomeMember,
    canCancel: Boolean(cancel),
    // Rücknahme bis zum Ablauf (approvals 14:15, Punkt 3).
    canWithdrawCancel:
      access.state === "member" && Boolean(row.memberCancelAt) && Date.parse(row.memberCancelAt) > now.getTime(),
    cancelPreview: cancel ? memberCancelPreviewLine(cancel) : "",
    changeCredits: row.changeCredits,
    refund,
    refundLine: refundStatusLine(refund),
  };
}

/**
 * Schlichter Konto-Hinweis ohne Plan-Logik (T10 zurückgestellt): Paketname,
 * bei laufender Mitgliedschaft der Weg ins Stripe-Kundenportal. Keine Daten,
 * Fristen oder Kaufknöpfe; der Zugang hängt nicht vom Plan ab.
 */
export function simpleAccountPlanView(row: PlanRow, access: PlanAccess, company?: string): AccountPlanView {
  const member = row.plan === "member" || Boolean(row.memberSubscriptionId);
  // Neues Modell (28.10.): Zugangsende sichtbar, nach Ablauf „Konto deaktiviert“.
  const deactivated = access.canReactivate;
  const accessUntil = access.state === "window" && row.accessUntil ? row.accessUntil : "";
  const lines: string[] = [];
  if (accessUntil) lines.push(`Zugang bis ${formatBerlinDate(accessUntil)}.`);
  if (deactivated) {
    const ended = row.memberEndedAt || row.accessUntil || row.retentionUntil;
    lines.push(
      planReactivateText({ company: company ?? "", date: ended ? formatBerlinDate(ended) : "" }),
      PLAN_REACTIVATE_TEXT_2,
      PLAN_REACTIVATE_PRICE_LINE,
      PLAN_REACTIVATE_SMALL,
    );
  }
  else if (access.state === "refunded" || access.state === "deleted") lines.push(access.writeMessage);
  return {
    state: access.state,
    title: deactivated
      ? PLAN_REACTIVATE_TITLE
      : access.state === "member"
        ? "Jahrespaket"
        : member && access.state !== "window"
          ? TITLES[access.state]
          : `Paket „${PLAN_PACKAGE_ENTRY_TITLE}“`,
    lines,
    accessUntil,
    canAddon: access.canBecomeMember,
    deactivated,
    canBuyChange: false,
    canBecomeMember: false,
    canCancel: false,
    canWithdrawCancel: false,
    cancelPreview: "",
    changeCredits: 0,
    refund: { refundable: false, reason: "", deadline: "" },
    refundLine: "",
    simple: true,
    portalCancel: Boolean(row.memberSubscriptionId) && !row.memberEndedAt,
  };
}

export async function loadAccountPlanView(
  email: string,
  documents: readonly { pdfUrl?: string; timestamp?: string }[],
  company?: string,
): Promise<AccountPlanView | null> {
  try {
    const loaded = await loadPlanAccess(email);
    if (!loaded) return null;
    if (!planLifecycleEnabled()) return simpleAccountPlanView(loaded.row, loaded.access, company);
    return accountPlanView(loaded.row, loaded.access, documents);
  } catch (error) {
    console.error("[account] Plan nicht gelesen", error instanceof Error ? error.name : "error");
    return null;
  }
}
