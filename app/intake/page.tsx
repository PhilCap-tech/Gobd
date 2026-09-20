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
import { isStripeConfigured } from "@/lib/env";
import { firstQueryValue } from "@/lib/query";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  listDocumentFamily,
} from "@/lib/store";
import {
  resolveCheckoutSession,
  type CheckoutResolveError,
} from "@/lib/stripe";
import {
  answersFromSheetRow,
  identityFromSheetRow,
} from "@/lib/types";
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
    body: "Das Intake folgt nach dem Checkout. Ohne gültige Stripe-Session (bezahlt) geht es hier nicht weiter.",
  },
  not_paid: {
    title: "Zahlung noch nicht bestätigt",
    body: "Die Stripe-Session ist vorhanden, aber noch nicht als bezahlt oder abgeschlossen markiert. Wenn du gerade bezahlt hast, warte kurz und prüfe erneut — das hängt nicht vom Webhook ab.",
  },
  lookup_failed: {
    title: "Session konnte nicht geladen werden",
    body: "Die Checkout-Session konnte gerade nicht bei Stripe geprüft werden. Das ist oft vorübergehend. Bitte erneut versuchen.",
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
  }>;
}) {
  const params = await searchParams;
  const sessionId = firstQueryValue(params.session_id);
  const email = firstQueryValue(params.email);
  const company = firstQueryValue(params.company);
  const documentId = firstQueryValue(params.document_id);
  const sessionEmail = await getSessionEmail();

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

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        {"error" in session ? (
          <IntakeGate error={session.error} sessionId={sessionId} />
        ) : (
          <IntakeForm session={session} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
