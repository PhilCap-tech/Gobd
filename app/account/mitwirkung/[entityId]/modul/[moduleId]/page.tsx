import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MitwirkungModulForm } from "@/app/account/mitwirkung/modul-form";
import { loginPath } from "@/lib/auth";
import { CATALOG_STEPS } from "@/lib/intake-catalog";
import { loadIntakeDraft } from "@/lib/intake-draft";
import { draftRevision, normalizeDraftKey } from "@/lib/intake-draft-shared";
import { MEMBER_PDF_HINT, MODULE_NOT_RELEASED } from "@/lib/membership-copy";
import { allowedModuleIds } from "@/lib/membership-draft";
import { loadMitwirkung } from "@/lib/membership-view";
import { modulById } from "@/lib/module/katalog";
import { ensureGesamt } from "@/lib/module/status";
import { SHEETS_RETRY_MESSAGE } from "@/lib/sheets-unavailable";
import { emptyAnswers } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modul ausfüllen",
  robots: { index: false, follow: false },
};

function stepIndex(moduleId: string): number {
  const modul = modulById(moduleId);
  if (!modul) return -1;
  const id = `step-M${String(modul.nr).padStart(2, "0")}`;
  return CATALOG_STEPS.findIndex((step) => step.id === id);
}

export default async function MitwirkungModulPage({
  params,
}: {
  params: Promise<{ entityId: string; moduleId: string }>;
}) {
  const { entityId, moduleId } = await params;
  const loaded = await loadMitwirkung(entityId);
  if (loaded.kind === "anon") {
    redirect(loginPath(`/account/mitwirkung/${entityId}/modul/${moduleId}`));
  }
  const back = `/account/mitwirkung/${entityId}`;
  if (loaded.kind !== "ok") {
    return (
      <>
        <SiteHeader backHref="/account" backLabel="← Zum Konto" />
        <main className="wrap page">
          <div className="card">
            <h1>{loaded.kind === "unavailable" ? "Modul nicht verfügbar" : "Kein Zugriff"}</h1>
            <p className="prose">
              {loaded.kind === "unavailable"
                ? SHEETS_RETRY_MESSAGE
                : "Diese Firma gehört nicht zu Ihrer Mitwirkung."}
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/account">
                Zum Konto
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { membership, firm } = loaded;
  const modul = modulById(moduleId);
  const draftKey = normalizeDraftKey({
    email: membership.ownerEmail,
    entityId: firm.entityId,
    modus: "gesamt",
  });
  let answers = ensureGesamt(emptyAnswers());
  let revision = 0;
  let updatedAt = "";
  try {
    const draft = await loadIntakeDraft(draftKey);
    if (draft?.answers) {
      answers = draft.answers.module ? draft.answers : ensureGesamt(draft.answers);
      revision = draftRevision(draft);
      updatedAt = draft.updatedAt ?? "";
    }
  } catch (error) {
    console.error(
      "[account] Entwurf der Mitwirkung nicht geladen",
      error instanceof Error ? error.name : "error",
    );
  }
  const allowed = allowedModuleIds(membership.moduleIds, answers);
  const step = stepIndex(moduleId);
  const released = Boolean(modul) && allowed.includes(moduleId) && step >= 0;

  return (
    <>
      <SiteHeader backHref={back} backLabel="← Zur Mitwirkung" />
      <main className="wrap page">
        <p className="kicker">Mitwirkende</p>
        <h1>{modul ? `Modul ${modul.nr}: ${modul.titel}` : "Modul"}</h1>
        <p className="lead">{firm.name}</p>
        {released && modul ? (
          <>
            <p className="hint">{MEMBER_PDF_HINT}</p>
            <MitwirkungModulForm
              draftKey={draftKey}
              ownerEmail={membership.ownerEmail}
              entityId={firm.entityId}
              moduleId={modul.id}
              step={step}
              initialAnswers={answers}
              initialRevision={revision}
              initialUpdatedAt={updatedAt}
              firm={{
                name: firm.name,
                street: firm.street,
                zip: firm.zip,
                city: firm.city,
              }}
            />
          </>
        ) : (
          <div className="card">
            <p>{MODULE_NOT_RELEASED}</p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href={back}>
                Zurück zur Übersicht
              </Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
