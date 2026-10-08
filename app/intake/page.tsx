import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCheckoutGrant, getSessionEmail, loginPath } from "@/lib/auth";
import { groupDocumentFamilies, nextVersionNumber } from "@/lib/documents";
import { authorizeDeliveredWrite, LOGIN_TO_CHANGE_COPY } from "@/lib/session-write";
import { entityById, entityChoices, type Entity } from "@/lib/entities";
import type { FirmFacts } from "@/lib/intake-catalog";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { isStripeConfigured } from "@/lib/env";
import { answersForNewBereich } from "@/lib/intake-catalog";
import { BELEGFLUSS, bereichIdOf, isBereichId } from "@/lib/bereiche";
import { firstQueryValue } from "@/lib/query";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  findLatestPaidCheckoutByEmail,
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
  emailsEqual,
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
    body: "Die Zahlung ist noch nicht als abgeschlossen markiert. Wenn Sie gerade bezahlt haben, warten Sie kurz und prüfen Sie erneut.",
  },
  lookup_failed: {
    title: "Session konnte nicht geladen werden",
    body: "Die Zahlung konnte gerade nicht geprüft werden. Das ist oft vorübergehend. Bitte erneut versuchen.",
  },
  invalid: {
    title: "Checkout-Session ungültig",
    body: "Die Zahlungssitzung ist unbekannt oder abgelaufen. Bitte starten Sie den Checkout erneut.",
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
          ? "Dieses Dokument gehört nicht zu Ihrem Konto."
          : "Dieses Dokument wurde nicht gefunden."}
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn" href={loggedIn ? "/account" : loginPath("/intake")}>
          {loggedIn ? "Zum Konto" : "Anmelden"}
        </Link>
      </div>
    </div>
  );
}

function intakeReturnPath(params: {
  session_id?: string | string[];
  document_id?: string | string[];
  entity_id?: string | string[];
  bereich?: string | string[];
  basis?: string | string[];
  modus?: string | string[];
  schritt?: string | string[];
  modul?: string | string[];
}): string {
  const query = new URLSearchParams();
  for (const key of [
    "session_id",
    "document_id",
    "entity_id",
    "bereich",
    "basis",
    "modus",
    "schritt",
    "modul",
  ] as const) {
    const value = firstQueryValue(params[key]);
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `/intake?${text}` : "/intake";
}

function LoginToChange({ nextPath }: { nextPath: string }) {
  return (
    <div className="card">
      <h1>Angaben ändern</h1>
      <p className="prose">{LOGIN_TO_CHANGE_COPY}</p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn" href={loginPath(nextPath)}>
          Anmelden
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
    grant?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const sessionIdQuery = firstQueryValue(params.session_id);
  const grantFlag = firstQueryValue(params.grant) ?? "";
  const checkoutGrant = await getCheckoutGrant();
  if (
    sessionIdQuery &&
    checkoutGrant?.sessionId !== sessionIdQuery &&
    grantFlag !== "skip" &&
    grantFlag !== "set"
  ) {
    const q = new URLSearchParams();
    for (const key of [
      "session_id",
      "email",
      "company",
      "document_id",
      "entity_id",
      "bereich",
      "basis",
      "modus",
      "schritt",
      "modul",
    ] as const) {
      const value = firstQueryValue(params[key]);
      if (value) q.set(key, value);
    }
    redirect(`/api/checkout/grant?${q.toString()}`);
  }
  const sessionId = sessionIdQuery || checkoutGrant?.sessionId || "";
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

  const returnPath = intakeReturnPath(params);

  // Weiterer Bereich für eine Firma mit bestehender Dokumentation: kein neuer Checkout.
  if (basisId) {
    const basisRow = await findDocumentById(basisId);
    const family = basisRow ? await listDocumentFamily(basisRow.documentId) : [];
    const write = basisRow
      ? authorizeDeliveredWrite({ sessionEmail, rows: family.length > 0 ? family : [basisRow] })
      : null;
    const ownedBasis = write?.ok && write.kind === "owner" ? write : null;
    let existingBereiche: string[] = [];
    let base = ownedBasis?.row ?? null;
    let gesamtStart: IntakeAnswers | null = null;
    if (basisRow && ownedBasis) {
      base = ownedBasis.row;
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
          {!basisRow ? (
            <EditGate loggedIn={Boolean(sessionEmail)} />
          ) : write && !write.ok && write.status === 401 ? (
            <LoginToChange nextPath={returnPath} />
          ) : !ownedBasis || !base ? (
            <EditGate loggedIn={Boolean(sessionEmail)} />
          ) : (
            <IntakeForm
              key={`${base.documentId}-${gesamtStart ? "gesamt" : bereich}`}
              loginHref={loginPath(returnPath)}
              session={identityFromSheetRow(ownedBasis.row)}
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
    const write = authorizeDeliveredWrite({
      sessionEmail,
      rows: family.length > 0 ? family : [source],
    });
    const owned = write.ok && write.kind === "owner" ? write : null;
    const latest = owned?.row ?? null;
    const ownedFamily = family.filter((row) => emailsEqual(row.email, owned?.ownerEmail ?? ""));
    const sourceEntity =
      latest?.entityId && sessionEmail ? await getOwnedEntity(latest.entityId, sessionEmail) : null;

    return (
      <>
        <SiteHeader backHref="/" backLabel="← Zur Landing" />
        <main className="wrap page">
          {write.ok === false && write.status === 401 ? (
            <LoginToChange nextPath={returnPath} />
          ) : !latest ? (
            <EditGate loggedIn={Boolean(sessionEmail)} />
          ) : (
            <IntakeForm
              key={latest.documentId}
              loginHref={loginPath(returnPath)}
              session={identityFromSheetRow(latest)}
              initialAnswers={answersFromSheetRow(latest)}
              sourceDocumentId={latest.documentId}
              nextVersion={nextVersionNumber(ownedFamily.length > 0 ? ownedFamily : [source])}
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

  // Magic-Link aus der Onboarding-Mail trägt nur next=/intake (ohne session_id).
  // Nach der Anmeldung die letzte bezahlte Checkout-Session weiterführen,
  // sonst zeigt das Intake die Zahlungssperre.
  if (!sessionId && sessionEmail && isStripeConfigured()) {
    const paid = await findLatestPaidCheckoutByEmail(sessionEmail);
    const paidSessionId = paid?.stripeSessionId.trim() ?? "";
    if (paidSessionId) {
      redirect(`/intake?session_id=${encodeURIComponent(paidSessionId)}`);
    }
  }

  const session = sessionId
    ? await resolveCheckoutSession(sessionId)
    : isStripeConfigured() || !devCheckoutStubAllowed()
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

  // Firmenliste nur mit Login für diese Adresse. Der Checkout-Nachweis
  // öffnet keine bestehenden Firmen.
  const accountEmail = sessionEmail ?? "";
  const entities = accountEmail
    ? await listEntitiesByEmail(accountEmail)
    : [];
  const owned = accountEmail && requestedEntityId
    ? await getOwnedEntity(requestedEntityId, accountEmail)
    : entityById(entities, requestedEntityId);
  const initialEntityId = sessionEmail
    ? owned?.entityId ||
      (!("error" in session) ? session.entityId?.trim() ?? "" : "") ||
      (entities.length === 1 ? entities[0]?.entityId ?? "" : "")
    : "";
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
            loginHref={loginPath(returnPath)}
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
