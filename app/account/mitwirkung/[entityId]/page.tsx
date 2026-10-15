import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loginPath } from "@/lib/auth";
import { loadIntakeDraft } from "@/lib/intake-draft";
import { normalizeDraftKey } from "@/lib/intake-draft-shared";
import {
  MEMBER_PDF_HINT,
  NO_MODULES_RELEASED,
  OTHER_MODULES_HINT,
  lastSavedByYou,
} from "@/lib/membership-copy";
import {
  allowedModuleIds,
  firmActiveModuleIds,
  formatSavedAt,
  memberAddressLine,
  moduleProgressLabel,
} from "@/lib/membership-draft";
import { loadMitwirkung } from "@/lib/membership-view";
import { MODULE } from "@/lib/module/katalog";
import { ensureGesamt } from "@/lib/module/status";
import { SHEETS_RETRY_MESSAGE } from "@/lib/sheets-unavailable";
import { emailsEqual, emptyAnswers } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mitwirkung",
  robots: { index: false, follow: false },
};

function Gate({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <h1>{title}</h1>
      <p className="prose">{body}</p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn" href="/account">
          Zum Konto
        </Link>
      </div>
    </div>
  );
}

export default async function MitwirkungPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  const loaded = await loadMitwirkung(entityId);
  if (loaded.kind === "anon") redirect(loginPath(`/account/mitwirkung/${entityId}`));
  if (loaded.kind === "unavailable") {
    return (
      <>
        <SiteHeader backHref="/account" backLabel="← Zum Konto" />
        <main className="wrap page">
          <Gate title="Mitwirkung nicht verfügbar" body={SHEETS_RETRY_MESSAGE} />
        </main>
        <SiteFooter />
      </>
    );
  }
  if (loaded.kind === "denied") {
    return (
      <>
        <SiteHeader backHref="/account" backLabel="← Zum Konto" />
        <main className="wrap page">
          <Gate title="Kein Zugriff" body="Diese Firma gehört nicht zu Ihrer Mitwirkung." />
        </main>
        <SiteFooter />
      </>
    );
  }

  const { email, membership, firm } = loaded;
  const draftKey = normalizeDraftKey({
    email: membership.ownerEmail,
    entityId: firm.entityId,
    modus: "gesamt",
  });
  let answers = ensureGesamt(emptyAnswers());
  let updatedBy = "";
  let updatedAt = "";
  try {
    const draft = await loadIntakeDraft(draftKey);
    if (draft?.answers) {
      answers = draft.answers.module ? draft.answers : ensureGesamt(draft.answers);
      updatedBy = draft.updatedBy ?? "";
      updatedAt = draft.updatedAt ?? "";
    }
  } catch (error) {
    console.error(
      "[account] Entwurf der Mitwirkung nicht geladen",
      error instanceof Error ? error.name : "error",
    );
  }

  const allowed = new Set(allowedModuleIds(membership.moduleIds, answers));
  const activeCount = firmActiveModuleIds(answers).length;
  const modules = MODULE.filter((modul) => allowed.has(modul.id));
  const savedAt = formatSavedAt(updatedAt);
  const ownSave = Boolean(savedAt) && emailsEqual(updatedBy, email);

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <p className="kicker">Mitwirkende</p>
        <h1>Mitwirkung · {firm.name}</h1>
        <p className="lead">Angemeldet als {email}</p>
        <div className="card">
          <p>{memberAddressLine(firm)}</p>
          <p className="doc-meta">Eingeladen von {firm.invitedBy}</p>
          <p>{MEMBER_PDF_HINT}</p>
          {ownSave ? <p className="doc-meta">{lastSavedByYou(savedAt)}</p> : null}
        </div>
        {modules.length === 0 ? (
          <p className="prose">{NO_MODULES_RELEASED}</p>
        ) : (
          <div className="entity-list" style={{ marginTop: 16 }}>
            {modules.map((modul) => {
              const progress = moduleProgressLabel(answers, modul.id);
              const touched = progress !== "noch leer" && ownSave;
              return (
                <article className="card" key={modul.id}>
                  <h2>
                    Modul {modul.nr} {modul.titel}
                  </h2>
                  <p className="doc-meta">
                    {progress}
                    {touched ? ` · Sie, ${savedAt}` : " · —"}
                  </p>
                  <div className="actions">
                    <Link className="btn" href={`/account/mitwirkung/${firm.entityId}/modul/${modul.id}`}>
                      Modul {modul.nr} ausfüllen
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {modules.length > 0 && modules.length < activeCount ? (
          <p className="hint">{OTHER_MODULES_HINT}</p>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
