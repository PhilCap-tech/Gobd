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

export async function loadAccountPlanView(
  email: string,
  documents: readonly { pdfUrl?: string; timestamp?: string }[],
): Promise<AccountPlanView | null> {
  try {
    const loaded = await loadPlanAccess(email);
    if (!loaded) return null;
    return accountPlanView(loaded.row, loaded.access, documents);
  } catch (error) {
    console.error("[account] Plan nicht gelesen", error instanceof Error ? error.name : "error");
    return null;
  }
}
