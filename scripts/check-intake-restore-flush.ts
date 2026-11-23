/**
 * Reload der Speicherzeile: gleicher Inhalt bleibt gespeichert, ein neuerer
 * lokaler Stand wird sofort geschrieben und die Zeile erst danach gezeigt.
 * Kein Viewport-Zweig, kein Ausblenden nach einer Frist.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { draftSavedLineVisible } from "../lib/fetch-retry";
import {
  preferIntakeSnapshot,
  restoreSavePlan,
  revisionForRestoreFlush,
  serverSaveCoversRestore,
  type IntakeDraftSnapshot,
} from "../lib/intake-draft-shared";
import { emptyAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function snap(
  revision: number,
  savedAt: string,
  answers: IntakeDraftSnapshot["answers"] = emptyAnswers(),
): IntakeDraftSnapshot {
  return { answers, step: 4, revision, savedAt };
}

const server = snap(4, "2026-11-23T12:00:02.000Z");
const localSameBody = snap(5, "2026-11-23T12:00:09.000Z", server.answers);
const covered = restoreSavePlan(server, preferIntakeSnapshot(server, localSameBody));
ok(covered.flush === false, "gleiche Angaben: kein zweites Speichern");
ok(covered.savedAt === server.savedAt, "gleiche Angaben behalten den Server-Zeitpunkt");
ok(
  draftSavedLineVisible({ confirmed: covered.savedAt !== "", failures: 0, finalSaveFailed: false }),
  "gleiche Angaben zeigen die Speicherzeile",
);

const unsavedAnswers = { ...emptyAnswers(), gf: "noch nicht auf dem Server" };
const localAhead = snap(5, "2026-11-23T12:00:09.000Z", unsavedAnswers);
const beforeDebounce = restoreSavePlan(server, preferIntakeSnapshot(server, localAhead));
ok(beforeDebounce.savedAt === "", "Reload vor Autosave-Ende behauptet kein Speichern");
ok(beforeDebounce.flush === true, "Reload vor Autosave-Ende schreibt den lokalen Stand sofort");
ok(
  !draftSavedLineVisible({ confirmed: false, failures: 0, finalSaveFailed: false }),
  "vor der Bestätigung bleibt die Speicherzeile aus",
);
ok(revisionForRestoreFlush(localAhead.revision ?? 0) === 5, "eine positive Revision wird unverändert geschrieben");

const serverCaughtUp = snap(5, "2026-11-23T12:00:10.000Z", unsavedAnswers);
const afterFlush = restoreSavePlan(serverCaughtUp, preferIntakeSnapshot(serverCaughtUp, localAhead));
ok(afterFlush.flush === false && afterFlush.savedAt === serverCaughtUp.savedAt, "nach dem sofortigen Speichern gilt der Server-Stand");
ok(
  draftSavedLineVisible({ confirmed: afterFlush.savedAt !== "", failures: 0, finalSaveFailed: false }),
  "nach dem sofortigen Speichern erscheint die Speicherzeile",
);

const swapped = Object.fromEntries(
  Object.entries(server.answers).reverse(),
) as IntakeDraftSnapshot["answers"];
ok(JSON.stringify(swapped) !== JSON.stringify(server.answers), "Schlüsselreihenfolge ändert die Rohzeichenfolge");
const sameRevision = snap(4, "2026-11-23T12:00:05.000Z", swapped);
ok(
  serverSaveCoversRestore(server, sameRevision) === server.savedAt,
  "dieselbe Revision bleibt gespeichert, auch wenn die Schlüssel anders herum stehen",
);
const aheadAndReordered = snap(5, "2026-11-23T12:00:09.000Z", swapped);
ok(
  restoreSavePlan(server, aheadAndReordered).flush === true,
  "höhere Revision mit anderer Schlüsselreihenfolge wird nachgeschrieben, nicht als gespeichert gezeigt",
);

ok(restoreSavePlan(null, localAhead).flush === true, "ohne Server-Stand wird der lokale Entwurf nachgeschrieben");
ok(revisionForRestoreFlush(0) === 1, "ohne Revision bekommt der Flush eine positive Nummer");
ok(
  !draftSavedLineVisible({ confirmed: true, failures: 1, finalSaveFailed: false }),
  "ein fehlgeschlagenes Nachschreiben zeigt die Zeile nicht",
);

const form = readFileSync("app/intake/intake-form.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
const planAt = form.indexOf("restoreSavePlan(server, chosen)");
const flushAt = form.indexOf("if (plan.flush)");
const debounceAt = form.indexOf("autosave.request(), 1500");
ok(planAt > 0 && flushAt > planAt && debounceAt > flushAt, "der Reload-Flush steht vor dem 1,5-s-Debounce");
const between = form.slice(flushAt, debounceAt);
ok(between.includes("postServerDraft(revision)"), "der Reload schreibt sofort");
ok(!between.includes("1500"), "der Reload-Flush wartet nicht auf den Debounce");
ok(form.includes('addEventListener("pagehide"'), "der Seitenwechsel schreibt auf jedem Viewport");
ok(!form.includes("matchMedia") && !form.includes("innerWidth"), "die Speicherzeile hat keinen Desktop-Pfad");
ok(!/setTimeout\([\s\S]{0,160}setServerSaved\(false\)/.test(form), "die Zeile blendet sich nicht nach einer Frist aus");
ok(css.includes(".save-stand") && !css.includes(".save-stand {\n  display: none"), "die Speicherzeile wird nicht per Layout ausgeblendet");

console.log("check-intake-restore-flush: green");
