import Link from "next/link";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { VersionHistory } from "@/components/document-revision";
import {
  customerChangedBy,
  customerChangeSummary,
  customerHubTitle,
} from "@/lib/account-display";
import { BEREICHE, BELEGFLUSS, bereichIdOf, bereichLabel } from "@/lib/bereiche";
import {
  documentDownloadPath,
  documentEditPath,
  firmaEditPath,
  intakeEditPath,
  latestOwnedInFamily,
  newDocumentPath,
  type EntityDocumentGroup,
} from "@/lib/documents";
import type { IntakeDraft } from "@/lib/intake-draft-shared";
import {
  openDraftContinuePath,
  openDraftLabel,
} from "@/lib/open-drafts";
import { CHECKOUT_PREFILL_NOTE, FIRMA_EDIT_LABEL } from "@/lib/account-labels";
import { PAID_INTAKE_LABEL } from "@/lib/account-paid-intake";
import { formatEntityAddress, type Entity } from "@/lib/entities";
import { gesamtDocTitle } from "@/lib/gesamt-document";
import { MODUL_UEBERSICHT_STEP_ID } from "@/lib/intake-catalog";
import {
  isGesamt,
  STATUS_LABEL,
  STATUS_OPTION_LABEL,
  vollstaendigkeitsZeilen,
} from "@/lib/module/status";
import { answersFromSheetRow, emptyAnswers, type SheetRow } from "@/lib/types";

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function presentEntity(entity: Entity): Entity {
  return {
    ...entity,
    entityId: asText(entity.entityId),
    name: asText(entity.name),
    street: asText(entity.street),
    zip: asText(entity.zip),
    city: asText(entity.city),
    createdAt: asText(entity.createdAt),
    updatedAt: asText(entity.updatedAt),
  };
}

function presentRow(row: SheetRow): SheetRow {
  const next = { ...row };
  for (const key of [
    "documentId",
    "version",
    "validFrom",
    "validTo",
    "changeSummary",
    "changedBy",
    "company",
    "email",
    "entityId",
    "stripeSessionId",
    "parentDocumentId",
    "timestamp",
    "fragen",
    "branchen",
    "rechtsform",
    "mitarbeitende",
    "fibu",
    "weitereSysteme",
    "eingangsbelege",
    "ausgangsrechnungen",
    "archiv",
    "hosting",
    "backup",
    "zugriff",
    "gf",
    "buchhaltung",
    "it",
    "steuerberater",
    "status",
  ] as const) {
    if (typeof next[key] !== "string") next[key] = "";
  }
  return next;
}
import {
  currentVersionBadge,
  formatValidityRange,
  selectCurrentVersion,
  versionLabelFromRow,
} from "@/lib/versioning";

/** Continue an existing draft. A hub entry can reuse this label. */
export const ACCOUNT_CONTINUE_LABEL = "Weiter ausfüllen";

/** Intake of this draft, optionally on one module. Does not start a new document. */
export function accountModuleHref(documentId: string, modulId?: string): string {
  const params = new URLSearchParams({
    document_id: documentId,
    schritt: MODUL_UEBERSICHT_STEP_ID,
  });
  if (modulId) params.set("modul", modulId);
  return `/intake?${params.toString()}`;
}

function docTitle(row: Parameters<typeof answersFromSheetRow>[0]): string {
  const answers = answersFromSheetRow(row);
  return isGesamt(answers)
    ? gesamtDocTitle()
    : `Verfahrensdokumentation ${bereichLabel(bereichIdOf(answers))}`;
}

export function AccountCompanyCard({
  group,
  email,
  empty,
  writesOpen = true,
  downloadsOpen = true,
  paidIntakeHref = "",
}: {
  group: EntityDocumentGroup & { continueDrafts?: IntakeDraft[] };
  email: string;
  /** True only when the firm has neither an open draft nor a document. */
  empty?: boolean;
  /** Nach Vertragsende keine neuen Versionen und keine Stammdatenänderung. */
  writesOpen?: boolean;
  /** Nach der 30-Tage-Frist kein Download. */
  downloadsOpen?: boolean;
  /** Bezahlter Intake ohne Dokument. Leer, wenn keiner offen ist. */
  paidIntakeHref?: string;
}) {
  const entity = group.entity ? presentEntity(group.entity) : null;
  const families = (group.families ?? []).map((family) => {
    const versions = (family?.versions ?? []).filter(Boolean).map(presentRow);
    const latest = family?.latest ? presentRow(family.latest) : versions[0];
    return {
      ...family,
      latest: latest ?? presentRow({} as SheetRow),
      versions: versions.length > 0 ? versions : latest ? [latest] : [],
    };
  });
  const continueDrafts = (group.continueDrafts ?? []).map((draft) => ({
    ...draft,
    draftKey: asText(draft?.draftKey),
    documentId: asText(draft?.documentId),
    stripeSessionId: asText(draft?.stripeSessionId),
    entityId: asText(draft?.entityId),
    answers: draft?.answers && typeof draft.answers === "object" ? draft.answers : emptyAnswers(),
  }));
  const showEmpty = empty ?? (families.length === 0 && continueDrafts.length === 0);
  const title = entity ? customerHubTitle(entity.name, "Firma") : "Ohne Firma";
  const address = entity ? formatEntityAddress(entity) : "";
  const selectId = `bereich-${entity?.entityId ?? "unbound"}`;
  const present = new Set(
    families.map((family) => bereichIdOf(answersFromSheetRow(family.latest))),
  );
  const firstMissing = BEREICHE.find((item) => !present.has(item.id))?.id ?? BELEGFLUSS;
  const basisId = families[0]?.latest.documentId ?? "";

  return (
    <article className="card entity-card">
      <h2>{title}</h2>
      {address ? (
        <p className="doc-meta">{address}</p>
      ) : entity ? (
        <p className="doc-meta">Keine Adresse hinterlegt.</p>
      ) : (
        <p className="doc-meta">
          Dokumente ohne Firmenzuordnung — bis zur Zuordnung ungebunden.
        </p>
      )}
      {entity?.checkoutPrefill === "review" && (
        <p className="hint checkout-note" role="status">
          {CHECKOUT_PREFILL_NOTE}
        </p>
      )}

      {entity && writesOpen && (
        <div className="actions entity-actions">
          <Link className="btn ghost" href={firmaEditPath(entity.entityId)}>
            {FIRMA_EDIT_LABEL}
          </Link>
          {families.length === 0 && paidIntakeHref ? (
            <Link className="btn" href={paidIntakeHref}>
              {PAID_INTAKE_LABEL}
            </Link>
          ) : families.length === 0 ? (
            <Link className="btn" href={newDocumentPath(entity.entityId)}>
              Neues Dokument
            </Link>
          ) : null}
        </div>
      )}
      {entity && !writesOpen && (
        <p className="hint">Neue Versionen sind nach dem Vertragsende nicht mehr möglich.</p>
      )}

      {continueDrafts.length > 0 && (
        <div className="entity-docs">
          <p className="prose">
            Ihre Angaben sind gespeichert. Sie können den Entwurf weiter ausfüllen.
          </p>
          {continueDrafts.map((draft) => (
            <div className="actions" key={draft.draftKey} style={{ marginTop: 12 }}>
              <span className="doc-meta">{openDraftLabel(draft)}</span>
              {writesOpen ? (
                <Link className="btn" href={openDraftContinuePath(draft)}>
                  {ACCOUNT_CONTINUE_LABEL}
                </Link>
              ) : (
                <span className="hint">Neue Versionen sind nach dem Vertragsende nicht mehr möglich.</span>
              )}
            </div>
          ))}
        </div>
      )}

      {showEmpty ? (
        <div className="entity-docs">
          <p className="prose">Für diese Firma liegt noch kein Entwurf vor.</p>
        </div>
      ) : families.length === 0 ? null : (
        <div className="entity-docs">
          {families.map((family) => {
            const editRow = latestOwnedInFamily(family.versions, email) ?? family.latest;
            const pick = selectCurrentVersion(family.versions);
            const current = pick?.row ?? editRow;
            const answers = answersFromSheetRow(editRow);
            const gesamt = isGesamt(answers);
            const rows = gesamt ? vollstaendigkeitsZeilen(answers) : [];
            const offenRows = rows.filter((row) => row.status === "offen");
            const settled = rows.length - offenRows.length;
            const percent = rows.length === 0 ? 0 : Math.round((settled / rows.length) * 100);
            const extern = rows.filter((row) => row.status === "extern").length;
            const uploads = rows.filter((row) => {
              const eintrag = answers.module?.status?.[row.modul];
              return eintrag?.status === "extern" && Boolean(eintrag.uploadName || eintrag.uploadUrl);
            });
            const tool = rows.filter((row) => row.status === "tool").length;
            const parts = [
              `${tool} Module „${STATUS_LABEL.tool}“`,
              `${offenRows.length} ${STATUS_LABEL.offen}`,
              `${extern} ${STATUS_OPTION_LABEL.extern}`,
            ];
            if (uploads.length) parts.push(`${uploads.length} Datei(en) verknüpft`);
            const meterLabel = `Vollständigkeit ${settled} von ${rows.length} Modulen geklärt`;
            const summary = customerChangeSummary(current.changeSummary);
            const who = customerChangedBy(current.changedBy);

            return (
              <section className="entity-doc" key={family.familyId}>
                <h3>{docTitle(editRow)}</h3>
                {gesamt && (
                  <>
                    <div className="completeness">
                      <div className="completeness-head">
                        <span>Vollständigkeit</span>
                        <span>
                          {settled} von {rows.length}
                        </span>
                      </div>
                      <div
                        className="completeness-track"
                        role="meter"
                        aria-label={meterLabel}
                        aria-valuemin={0}
                        aria-valuemax={rows.length}
                        aria-valuenow={settled}
                        aria-valuetext={meterLabel}
                      >
                        <div className="completeness-fill" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="doc-meta">
                        {parts.join(" · ")}
                        {" · "}
                        {writesOpen ? (
                          <Link href={accountModuleHref(editRow.documentId)}>Module bearbeiten</Link>
                        ) : (
                          <span>Pflege beendet</span>
                        )}
                      </p>
                    </div>
                    {offenRows.length > 0 ? (
                      <div className="open-modules">
                        <h4>Offene Module</h4>
                        <p className="hint">
                          Noch auszufüllen. Der Zwischenstand wird gespeichert. Im Intake setzen
                          Sie den Status auf „{STATUS_OPTION_LABEL.tool}“, „{STATUS_OPTION_LABEL.extern}“ oder „{STATUS_OPTION_LABEL.nicht_vorhanden}“.
                        </p>
                        <ul className="open-module-list">
                          {offenRows.map((row) => (
                            <li key={row.modul}>
                              <span>
                                {row.nr}. {row.titel}
                              </span>
                              {writesOpen ? (
                                <Link href={accountModuleHref(editRow.documentId, row.modul)}>
                                  {ACCOUNT_CONTINUE_LABEL}
                                </Link>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="hint">Keine offenen Module.</p>
                    )}
                  </>
                )}
                {!entity && editRow.company ? (
                  <p className="doc-meta">
                    {customerHubTitle(editRow.company, "Verfahrensdokumentation")}
                  </p>
                ) : null}
                <p className="doc-meta">
                  {currentVersionBadge(Boolean(pick?.fallback))}: Version{" "}
                  {versionLabelFromRow(current)} · Gültig{" "}
                  {formatValidityRange(current, family.versions)} · {summary} · {who}
                </p>
                <div className="actions doc-actions">
                  {downloadsOpen && (
                    <PdfDownloadLink className="btn" href={documentDownloadPath(editRow)}>
                      PDF herunterladen
                    </PdfDownloadLink>
                  )}
                  {writesOpen && (
                    <>
                      <Link className="btn" href={intakeEditPath(editRow)}>
                        Überarbeiten
                      </Link>
                      <Link className="btn ghost" href={documentEditPath(editRow)}>
                        Dokument bearbeiten
                      </Link>
                    </>
                  )}
                </div>
                <p className="hint revision-hint">
                  {writesOpen
                    ? "„Überarbeiten“ ändert die Angaben in diesem Entwurf. „Dokument bearbeiten“ ändert den Kapiteltext. Beides erzeugt die nächste PDF-Version — bisherige Downloads bleiben."
                    : "Online-Pflege und neue Versionen sind mit dem Vertragsende entfallen. Bereits erzeugte PDFs können Sie in der Frist herunterladen."}
                </p>
                <VersionHistory
                  headingId={`versionshistorie-${family.familyId}`}
                  versions={family.versions}
                  downloadsOpen={downloadsOpen}
                />
              </section>
            );
          })}
        </div>
      )}

      {writesOpen && families.length > 0 && (
        <details className="account-more">
          <summary>Weitere Optionen</summary>
          <div className="account-more-body">
            <form className="bereich-add" method="get" action="/intake">
              <input type="hidden" name="basis" value={basisId} />
              <label htmlFor={selectId}>Weiteren Bereich dokumentieren</label>
              <div className="actions">
                <select id={selectId} name="bereich" defaultValue={firstMissing}>
                  {BEREICHE.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                      {present.has(item.id) ? " (bereits vorhanden)" : ""}
                    </option>
                  ))}
                </select>
                <button className="btn" type="submit">
                  Bereich anlegen
                </button>
              </div>
              <p className="hint">
                24 Module, alle inklusive – ein Preis für die komplette
                GoBD-Verfahrensdokumentation. Bisherige Bereiche bleiben lesbar; neue Dokumente
                starten als Gesamtdokument.
              </p>
              <p className="actions">
                <Link
                  className="btn ghost"
                  href={`/intake?basis=${encodeURIComponent(basisId)}&modus=gesamt`}
                >
                  Gesamtdokument anlegen
                </Link>
              </p>
            </form>
          </div>
        </details>
      )}
    </article>
  );
}
