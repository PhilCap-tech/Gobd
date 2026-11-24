/**
 * P2-P: Das Abwählen eines Status nach dem ersten Speichern wird persistiert.
 * Der unveränderte Erstladezustand löst weiterhin keinen Autosave aus.
 *   npx tsx scripts/check-status-abwahl-speichern.ts
 */
import assert from "node:assert/strict";
import { intakeAutosaveDecision } from "@/lib/intake-draft-shared";

const load = JSON.stringify({ answers: { katalog: { UO02: { values: { kunden: ["B2C"] }, vorschlag: { kunden: ["B2C"] } } } }, step: 2, change: {} });
const withStatus = JSON.stringify({ answers: { katalog: { UO02: { status: "unbekannt", values: { kunden: ["B2C"] }, vorschlag: { kunden: ["B2C"] } } } }, step: 2, change: {} });

let baseline: string | false = "";

const first = intakeAutosaveDecision(load, baseline);
assert.equal(first.persist, false, "Erstladen speichert nicht");
baseline = first.nextBaseline;
assert.equal(baseline, load, "Erste Beobachtung wird zur Baseline");

const unchanged = intakeAutosaveDecision(load, baseline);
assert.equal(unchanged.persist, false, "unveränderter Erstladezustand speichert nicht");
assert.equal(unchanged.nextBaseline, load, "Baseline bleibt ohne Abweichung");

const setStatus = intakeAutosaveDecision(withStatus, baseline);
assert.equal(setStatus.persist, true, "Status setzen wird gespeichert");
baseline = setStatus.nextBaseline;

const deselected = intakeAutosaveDecision(load, baseline);
assert.equal(deselected.persist, true, "Abwählen zurück auf den Ladestand wird gespeichert");
assert.equal(baseline, false, "Baseline wird nach der ersten Abweichung verworfen");
assert.equal(deselected.nextBaseline, false, "verworfene Baseline wird nicht neu gesetzt");

const stillOpen = intakeAutosaveDecision(withStatus, false);
assert.equal(stillOpen.persist, true, "weitere Abweichungen bleiben speicherbar");

console.log("check-status-abwahl-speichern: ok");
