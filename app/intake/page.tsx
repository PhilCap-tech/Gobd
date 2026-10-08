import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import {
  canAccessDocument,
  groupDocumentFamilies,
  nextVersionNumber,
} from "@/lib/documents";
import { entityById, entityChoices, type Entity } from "@/lib/entities";
import type { FirmFacts } from "@/lib/intake-catalog";
import { isStripeConfigured } from "@/lib/env";
import { answersForNewBereich } from "@/lib/intake-catalog";
import { BELEGFLUSS, bereichIdOf, isBereichId } from "@/lib/bereiche";
import { firstQueryValue } from "@/lib/query";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  getOwnedEntity,
  listDocumentFamily,
  listDocumentsByEmail,
  listEntitiesByEmail,
} from "@/lib/store";
import {
  resolveCheckoutSession,
  type CheckoutResolveError,
} from "@/lib/stripe";
import {
  answersFromSheetRow,
  emptyAnswers,
  identityFromSheetRow,
  type IntakeAnswers,
} from "@/lib/types";
import { answersForGesamt } from "@/lib/module/migration";
import { IntakeForm } from "./intake-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intake",
  robots: { index: false, follow: false },
};

const GATE_COPY: Record<
  CheckoutResolveError,
  { title: string; body: string }
> = {
  missing: {
    title: "Zuerst Dokumentation starten",
    body: "Das Intake folgt nach dem Checkout. Ohne abgeschlossene Zahlung geht es hier nicht weiter.",
  },
  not_paid: {
    title: "Zahlung noch nicht bestätigt",
    body: "Die Zahlung ist noch nicht als abgeschlossen markiert. Wenn du gerade bezahlt hast, warte kurz und prüfe erneut.",
  },
  lookup_failed: {
    title: "Session konnte nicht geladen werden",
    body: "Die Zahlung konnte gerade nicht geprüft werden. Das ist oft vorübergehend. Bitte erneut versuchen.",
  },
};

function IntakeGate({
  error,
  sessionId,
}: {
  error: CheckoutResolveError;
  sessionId?: string;
}) {
  const copy = GATE_COPY[error];
  const retryHref =
    sessionId && error !== "missing"
      ? `/intake?session_id=${encodeURIComponent(sessionId)}`
      : null;

  return (
    <div className="card">
      <h1>{copy.title}</h1>
      <p className="prose">{copy.body}</p>
      <div className="actions" style={{ marginTop: 16 }}>
        {retryHref && (
          <a className="btn" href={retryHref}>
            Erneut versuchen
          </a>
        )}
        <Link className={retryHref ? "btn ghost" : "btn"} href="/checkout">
          Dokumentation starten
        </Link>
      </div>
    </div>
  );
}

function firmFromEntity(entity: Entity | null | undefined, fallbackName: string): FirmFacts {
  if (!entity) return { name: fallbackName };
  return {
    name: entity.name || fallbackName,
    street: entity.street,
    zip: entity.zip,
    city: entity.city,
    stnr: entity.stnr,
    ustId: entity.ustId,
  };
}

function EditGate({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="card">
      <h1>Angaben nicht verfügbar</h1>
      <p className="prose">
        {loggedIn
          ? "Dieses Dokument gehört nicht zu deinem Konto."
          : "Bitte mit der Checkout-E-Mail anmelden oder den Link von der Success-Seite mit gültiger Session nutzen."}
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn" href={loggedIn ? "/account" : "/login"}>
          {loggedIn ? "Zum Konto" : "Anmelden"}
        </Link>
      </div>
    </div>
  );
}

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string | string[];
    email?: string | string[];
    company?: string | string[];
    document_id?: string | string[];
    entity_id?: string | string[];
    bereich?: string | string[];
    basis?: string | string[];
    modus?: string | string[];
    schritt?: string | string[];
    modul?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const sessionId = firstQueryValue(params.session_id);
  const requestedSchritt = firstQueryValue(params.schritt) ?? "";
  const requestedModul = firstQueryValue(params.modul) ?? "";
  const initialStepId = /^step-[A-Za-z0-9]+$/.test(requestedSchritt) ? requestedSchritt : "";
  const focusModulId = /^m\d{2}$/.test(requestedModul) ? requestedModul : "";
  const email = firstQueryValue(params.email);
  const company = firstQueryValue(params.company);
  const documentId = firstQueryValue(params.document_id);
  const requestedEntityId = firstQueryValue(params.entity_id) ?? "";
  const requestedBereich = firstQueryValue(params.bereich) ?? "";
  const bereich = isBereichId(requestedBereich) ? requestedBereich : "";
  const basisId = firstQueryValue(params.basis) ?? "";
  const modus = (firstQueryValue(params.modus) ?? "").toLowerCase();
  // Default for new intakes: Gesamtdokument. Opt out with ?modus=bereich.
  const gesamtMode = modus !== "bereich" && (modus === "gesamt" || !bereich);
  const sessionEmail = await getSessionEmail();

  // Weiterer Bereich für eine Firma mit bestehender Dokumentation: kein neuer Checkout.
  if (basisId) {
    const basisRow = await findDocumentById(basisId);
    const allowed =
      basisRow && canAccessDocument(basisRow, { sessionEmail, sessionId });
    let existingBereiche: string[] = [];
    let base = basisRow;
    let gesamtStart: IntakeAnswers | null = null;
    if (basisRow && allowed) {
      const family = await listDocumentFamily(basisRow.documentId);
      base = groupDocumentFamilies(family)[0]?.latest ?? basisRow;
      const owned = sessionEmail ? await listDocumentsByEmail(sessionEmail) : family;
      const sameFirm = owned.filter(
        (row) => (row.entityId || "") === (basisRow.entityId || ""),
      );
      const latestOfFirm = groupDocumentFamilies(sameFirm).map((item) => item.latest);
      existingBereiche = [
        ...new Set(latestOfFirm.map((item) => bereichIdOf(answersFromSheetRow(item)))),
      ];
      if (modus === "gesamt") {
        // Gesamtdokument aus allen bisherigen Bereichs-Dokumentationen der Firma.
        const ordered = [base, ...latestOfFirm.filter((item) => item.documentId !== base?.documentId)]
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((item) => answersFromSheetRow(item));
        gesamtStart = answersForGesamt(ordered, basisRow.company);
      }
    }
    const basisEntity =
      basisRow?.entityId && sessionEmail
        ? await getOwnedEntity(basisRow.entityId, sessionEmail)
        : null;
    return (
      <>
        <SiteHeader backHref="/account" backLabel="← Zum Konto" />
        <main className="wrap page">
          {!basisRow || !allowed || !base ? (
            <EditGate loggedIn={Boolean(sessionEmail)} />
          ) : (
            <IntakeForm
              key={`${base.documentId}-${gesamtStart ? "gesamt" : bereich}`}
              session={identityFromSheetRow(basisRow)}
              initialAnswers={
                gesamtStart ??
                answersForNewBereich(
                  answersFromSheetRow(base),
                  bereich || BELEGFLUSS,
                  basisRow.company,
                )
              }
              gesamtMode={Boolean(gesamtStart)}
              initialEntityId={basisRow.entityId}
              initialStepId={initialStepId}
              focusModulId={focusModulId}
              areaBaseDocumentId={basisRow.documentId}
              existingBereiche={existingBereiche}
              firm={firmFromEntity(basisEntity, basisRow.company)}
            />
          )}
        </main>
        <SiteFooter />
      </>
    );
  }

  let sourceRow = documentId ? await findDocumentById(documentId) : null;
  if (!sourceRow && sessionId) {
    sourceRow = await findLatestDocumentByStripeSessionId(sessionId);
  }

  if (sourceRow) {
    const resolvedRow = sourceRow;
    const family = await listDocumentFamily(resolvedRow.documentId);
    const source =
      family.find((row) => row.documentId === resolvedRow.documentId) ??
      family.at(-1) ??
      resolvedRow;
    const latest = groupDocumentFamilies(family)[0]?.latest ?? source;
    const allowed = canAccessDocument(source, { sessionEmail, sessionId });
    const sourceEntity =
      latest?.entityId && sessionEmail ? await getOwnedEntity(latest.entityId, sessionEmail) : null;

    return (
      <>
        <SiteHeader backHref="/" backLabel="← Zur Landing" />
        <main className="wrap page">
          {!allowed || !latest ? (
            <EditGate loggedIn={Boolean(sessionEmail)} />
          ) : (
            <IntakeForm
              key={latest.documentId}
              session={identityFromSheetRow(source)}
              initialAnswers={answersFromSheetRow(latest)}
              sourceDocumentId={latest.documentId}
              nextVersion={nextVersionNumber(family)}
              initialEntityId={latest.entityId}
              initialStepId={initialStepId}
              focusModulId={focusModulId}
              firm={firmFromEntity(sourceEntity, latest.company)}
            />
          )}
        </main>
        <SiteFooter />
      </>
    );
  }

  if (documentId) {
    return (
      <>
        <SiteHeader backHref="/" backLabel="← Zur Landing" />
        <main className="wrap page">
          <EditGate loggedIn={Boolean(sessionEmail)} />
        </main>
        <SiteFooter />
      </>
    );
  }

  const session = sessionId
    ? await resolveCheckoutSession(sessionId)
    : isStripeConfigured()
      ? ({ error: "missing" } as const)
      : {
          email: email || "",
          company: company || "",
          stripeSessionId: "mock_direct",
          stripeCustomerId: "",
          stub: true,
        };

  if (!("error" in session) && session.stub) {
    session.email = email || session.email;
    session.company = company || session.company;
  }

  const accountEmail =
    sessionEmail || (!("error" in session) ? session.email : "");
  const entities = accountEmail
    ? await listEntitiesByEmail(accountEmail)
    : [];
  const owned = accountEmail && requestedEntityId
    ? await getOwnedEntity(requestedEntityId, accountEmail)
    : entityById(entities, requestedEntityId);
  const initialEntityId =
    owned?.entityId ||
    (!("error" in session) ? session.entityId?.trim() ?? "" : "") ||
    (entities.length === 1 ? entities[0]?.entityId ?? "" : "");
  if (!("error" in session) && !session.company.trim()) {
    const firmName =
      owned?.name || entityById(entities, initialEntityId)?.name || "";
    if (firmName) session.company = firmName;
  }

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        {"error" in session ? (
          <IntakeGate error={session.error} sessionId={sessionId} />
        ) : (
          <IntakeForm
            session={session}
            entities={entityChoices(entities)}
            initialEntityId={initialEntityId}
            initialAnswers={bereich ? { ...emptyAnswers(), bereich } : undefined}
            gesamtMode={gesamtMode}
            initialStepId={initialStepId}
            focusModulId={focusModulId}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
