/**
 * Draft round-trip: every intake field type survives save + restore,
 * and prefill only fills fields that are still empty afterwards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  catalogStepIssues,
  CATALOG_STEPS,
  clearCatalogStatus,
  prefillKnownFacts,
  prefillStammdatenInput,
  setCatalogMeta,
  setCatalogStatus,
  setCatalogValue,
} from "../lib/intake-catalog";
import { latestOwnedInFamily } from "../lib/documents";
import {
  draftRevision,
  incomingDraftWins,
  parseDraftVersionChange,
  preferIntakeSnapshot,
  resolveDraftAfterLoad,
  type IntakeDraftSnapshot,
} from "../lib/intake-draft-shared";
import {
  ensureGesamt,
  setCheckAntwort,
  setModulEintrag,
  SOFTWARE_PRESETS,
  toggleSoftwarePreset,
} from "../lib/module/status";
import { emptyAnswers, emptySheetRow, type IntakeAnswers, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

export function checkIntakeDraftRestore(): void {
  let answers = ensureGesamt(emptyAnswers());
  answers = setCatalogValue(answers, "A01", "company", "Eigene GmbH");
  answers = setCatalogValue(answers, "A01", "rechtsform", "GmbH");
  answers = setCatalogValue(answers, "A01", "gf", "Ada Beispiel");
  answers = setCatalogValue(answers, "A01", "branchen", ["Handel"]);
  answers = setCatalogStatus(answers, "A04", "bestaetigt");
  answers = setCatalogValue(answers, "A04", "gueltigAb", "2020-05-01");
  answers = setCatalogValue(answers, "A04", "keineRueckdatierungBestaetigt", true);
  answers = setCatalogStatus(answers, "B01", "geplant");
  answers = setCatalogMeta(answers, "B01", { responsible: "Kim Prüfer", date: "2026-11-01" });
  answers = setCatalogValue(answers, "B01", "it", "Intern");
  answers = setCheckAntwort(answers, "bargeld", "ja");
  answers = setCheckAntwort(answers, "lager", "nein");
  answers = setModulEintrag(answers, "m02", { status: "extern", ref: "Bestehende VD Verkauf" });

  const step = CATALOG_STEPS.findIndex((item) => item.id === "step-M01");
  ok(step >= 0, "module 1 step exists");

  const stored = JSON.parse(
    JSON.stringify({ answers, step, savedAt: "2026-10-08T10:00:00.000Z", revision: 4 }),
  ) as IntakeDraftSnapshot;

  ok(stored.answers.katalog?.A04?.values?.keineRueckdatierungBestaetigt === true, "checkbox boolean survives JSON");
  ok(stored.answers.katalog?.A04?.values?.gueltigAb === "2020-05-01", "date survives JSON");
  ok(stored.answers.katalog?.A04?.status === "bestaetigt", "status chip survives JSON");
  ok(stored.answers.katalog?.A01?.values?.rechtsform === "GmbH", "select survives JSON");
  ok(stored.answers.module?.check?.bargeld === "ja", "betriebs-check survives JSON");
  ok(stored.answers.module?.status?.m02?.status === "extern", "module status survives JSON");
  ok(stored.step === step, "position survives JSON");

  const staleServer: IntakeDraftSnapshot = {
    answers: prefillKnownFacts(ensureGesamt(emptyAnswers()), { name: "Nordlicht GmbH" }),
    step: 0,
    savedAt: "2026-10-08T10:05:00.000Z",
    revision: 1,
  };
  const chosen = preferIntakeSnapshot(staleServer, stored);
  ok(chosen === stored, "higher revision beats a newer incomplete server draft");
  ok(
    !incomingDraftWins({ revision: 1, clientUpdatedAt: "2026-10-08T10:05:00.000Z" }, { revision: 4, updatedAt: "2026-10-08T10:00:00.000Z" }),
    "older revision does not overwrite",
  );
  ok(
    incomingDraftWins({ revision: 4, clientUpdatedAt: "2026-10-08T09:00:00.000Z" }, { revision: 1, updatedAt: "2026-10-08T10:05:00.000Z" }),
    "newer revision wins despite an older timestamp",
  );
  ok(draftRevision({ revision: 0 }) === 0, "unset revision stays 0");

  const restored = prefillKnownFacts(chosen!.answers, {
    name: "Nordlicht GmbH",
    street: "Hafenweg 2",
    zip: "20457",
    city: "Hamburg",
  });
  const a01 = restored.katalog?.A01?.values ?? {};
  const a04 = restored.katalog?.A04;
  ok(a01.company === "Eigene GmbH", "prefill does not replace a restored company");
  ok(a01.rechtsform === "GmbH", "restored Rechtsform stays");
  ok(a01.gf === "Ada Beispiel", "restored Geschäftsleitung stays");
  ok(Array.isArray(a01.branchen) && (a01.branchen as string[]).includes("Handel"), "restored multi choice stays");
  ok(String(a01.standort).includes("Hamburg"), "prefill fills a still-empty standort");
  ok(a04?.values?.gueltigAb === "2020-05-01", "restored Gültig-ab stays");
  ok(a04?.values?.keineRueckdatierungBestaetigt === true, "restored confirmation stays checked");
  ok(a04?.status === "bestaetigt", "restored Stand stays");
  ok(restored.katalog?.B01?.status === "geplant", "restored geplant status stays");
  ok(restored.katalog?.B01?.responsible === "Kim Prüfer", "restored responsibility stays");
  ok(restored.katalog?.B01?.date === "2026-11-01", "restored status date stays");
  ok(restored.katalog?.B01?.values?.it === "Intern", "restored text field stays");
  ok(restored.module?.check?.bargeld === "ja" && restored.module?.check?.lager === "nein", "restored Betriebs-Check stays");
  ok(restored.module?.status?.m02?.ref === "Bestehende VD Verkauf", "restored module status stays");

  const cleared = clearCatalogStatus(restored, "A04");
  ok(!cleared.katalog?.A04?.status, "clicking the active Stand clears it");
  ok(cleared.katalog?.A04?.values?.gueltigAb === "2020-05-01", "clearing Stand keeps the date");
  ok(cleared.katalog?.A04?.values?.keineRueckdatierungBestaetigt === true, "clearing Stand keeps the checkbox");
  ok(
    catalogStepIssues(step, cleared).some((issue) => issue.questionId === "A04" && issue.fieldKey === "status"),
    "required Stand validation returns after clearing",
  );

  console.log("check-intake-draft: green");
}

function systemNames(answers: IntakeAnswers): string[] {
  const value = answers.katalog?.B01?.values?.systeme;
  if (!Array.isArray(value)) return [];
  return value.map((row) => String((row as { name?: unknown }).name ?? ""));
}

/** Wie der Chip: Vorlage umschalten und danach die bekannten Stammdaten verteilen. */
function clickPreset(answers: IntakeAnswers, id: string): IntakeAnswers {
  return prefillKnownFacts(toggleSoftwarePreset(answers, id));
}

/** Software-Vorlagen: wählen, abwählen, alle fünf, Entwurf nach dem Abwählen. */
export function checkSoftwarePresetToggle(): void {
  const ids = SOFTWARE_PRESETS.map((preset) => preset.id);
  ok(ids.length === 5 && new Set(ids).size === 5, "five distinct software templates");
  ok(
    readFileSync("components/betriebs-check.tsx", "utf8").includes("aria-pressed={software.includes(preset.id)}"),
    "software chips expose aria-pressed",
  );

  let single = ensureGesamt(emptyAnswers());
  single = clickPreset(single, "datev");
  ok(single.module?.software?.join() === "datev", "first click selects DATEV");
  ok(single.module?.stammdaten?.fibu === "DATEV", "selecting DATEV still suggests the system name");
  ok(systemNames(single).includes("DATEV"), "selecting DATEV adds the B01 system");
  ok(single.katalog?.BU01?.values?.kontenrahmen === "SKR 03", "selecting DATEV suggests the chart of accounts");
  single = clickPreset(single, "datev");
  ok((single.module?.software ?? []).length === 0, "second click deselects DATEV");
  ok(!single.module?.stammdaten?.fibu, "deselect removes the untouched FiBu suggestion");
  ok(!systemNames(single).includes("DATEV"), "deselect removes the untouched B01 system");
  ok(!single.katalog?.BU01?.values?.kontenrahmen, "deselect removes the untouched chart of accounts");

  let below = ensureGesamt(emptyAnswers());
  below = toggleSoftwarePreset(below, "lexoffice");
  below = toggleSoftwarePreset(below, "sevdesk");
  below = toggleSoftwarePreset(below, "lexoffice");
  ok(below.module?.software?.join() === "sevdesk", "one of two selected templates can be removed");
  below = toggleSoftwarePreset(below, "shopify");
  ok(below.module?.software?.join() === "sevdesk,shopify", "another template can be added after a removal");

  let full = ensureGesamt(emptyAnswers());
  for (const id of ids) full = toggleSoftwarePreset(full, id);
  ok(full.module?.software?.join() === ids.join(), "all five templates can be selected");
  const blocked = toggleSoftwarePreset(full, "nicht-vorhanden");
  ok(blocked.module?.software?.join() === ids.join(), "an unknown option is not added at the limit");
  full = toggleSoftwarePreset(full, ids[0]!);
  ok(full.module?.software?.join() === ids.slice(1).join(), "a selected template can be removed when all five are on");
  full = toggleSoftwarePreset(full, "noch-eine");
  ok(full.module?.software?.length === 4, "an unknown option is not added after one removal");
  full = toggleSoftwarePreset(full, ids[0]!);
  ok(full.module?.software?.join() === [...ids.slice(1), ids[0]].join(), "the removed template can be selected again");

  const step = 0;
  const stored = JSON.parse(
    JSON.stringify({
      answers: full,
      step,
      savedAt: "2026-11-16T12:00:00.000Z",
      revision: 3,
    }),
  ) as IntakeDraftSnapshot;
  ok(
    stored.answers.module?.software?.join() === [...ids.slice(1), ids[0]].join(),
    "the selection after deselect and reselect survives draft JSON",
  );
  const reloaded = prefillKnownFacts(stored.answers);
  ok(
    reloaded.module?.software?.join() === stored.answers.module?.software?.join(),
    "hydration keeps the deselected template off and the selected ones on",
  );

  let dropped = ensureGesamt(emptyAnswers());
  dropped = clickPreset(dropped, "pos");
  dropped = clickPreset(dropped, "pos");
  const emptyStored = JSON.parse(
    JSON.stringify({ answers: dropped, step, savedAt: "2026-11-16T12:01:00.000Z", revision: 2 }),
  ) as IntakeDraftSnapshot;
  const emptyReloaded = prefillKnownFacts(emptyStored.answers);
  ok((emptyReloaded.module?.software ?? []).length === 0, "a full deselect survives draft reload");
  ok(!emptyReloaded.module?.stammdaten?.kasse, "reload keeps the removed POS name out of Stammdaten");
  ok(!emptyReloaded.katalog?.KA01?.values?.art, "reload keeps the removed POS kind out of the catalog");
  ok(!emptyReloaded.katalog?.KA01?.values?.system, "reload does not restore the POS name from Stammdaten");
  ok(!emptyReloaded.katalog?.A01?.values?.gastroKasse, "reload does not restore the POS copy");

  let edited = clickPreset(ensureGesamt(emptyAnswers()), "datev");
  edited = {
    ...edited,
    module: {
      ...edited.module!,
      stammdaten: { ...edited.module?.stammdaten, fibu: "DATEV Unternehmen online" },
    },
  };
  edited = setCatalogValue(edited, "BU01", "kontenrahmen", "SKR 03 geändert");
  edited = clickPreset(edited, "datev");
  ok(edited.module?.stammdaten?.fibu === "DATEV Unternehmen online", "an edited FiBu value stays");
  ok(edited.katalog?.BU01?.values?.kontenrahmen === "SKR 03 geändert", "an edited chart of accounts stays");
  ok(!systemNames(edited).includes("DATEV"), "the untouched B01 card is still removed");

  let beside = clickPreset(ensureGesamt(emptyAnswers()), "lexoffice");
  beside = setCatalogValue(beside, "E05", "systeme", "lexoffice, Eigenes Programm");
  const withOwnCard = systemNames(beside).includes("lexoffice")
    ? [
        ...(beside.katalog?.B01?.values?.systeme as Record<string, unknown>[]),
        { name: "Eigenes Archiv", funktion: "Ablage", typ: "archiv" },
      ]
    : [{ name: "Eigenes Archiv", funktion: "Ablage", typ: "archiv" }];
  beside = setCatalogValue(beside, "B01", "systeme", withOwnCard);
  beside = {
    ...beside,
    module: {
      ...beside.module!,
      stammdaten: { ...beside.module?.stammdaten, fibu: "lexoffice, Kanzlei" },
    },
  };
  beside = clickPreset(beside, "lexoffice");
  ok(beside.katalog?.E05?.values?.systeme === "Eigenes Programm", "a user token beside the template token stays");
  ok(beside.module?.stammdaten?.fibu === "Kanzlei", "a user FiBu note beside the template name stays");
  ok(!systemNames(beside).includes("lexoffice"), "the untouched lexoffice card is removed");
  ok(systemNames(beside).includes("Eigenes Archiv"), "a user system card beside the template card stays");

  const probe = {
    id: "probe-gleich",
    label: "Probe",
    values: {
      B01: { systeme: [{ name: "DATEV", funktion: "Finanzbuchhaltung", typ: "fibu" }] },
      BU01: { kontenrahmen: "SKR 03" },
    },
    stammdaten: { fibu: "DATEV" },
  };
  SOFTWARE_PRESETS.push(probe);
  try {
    let shared = clickPreset(ensureGesamt(emptyAnswers()), "datev");
    shared = clickPreset(shared, "probe-gleich");
    shared = clickPreset(shared, "datev");
    ok(shared.module?.software?.join() === "probe-gleich", "the other template stays selected");
    ok(shared.module?.stammdaten?.fibu === "DATEV", "a shared FiBu value stays while the other template provides it");
    ok(shared.katalog?.BU01?.values?.kontenrahmen === "SKR 03", "a shared chart of accounts stays");
    ok(systemNames(shared).includes("DATEV"), "a shared system card stays");
    shared = clickPreset(shared, "probe-gleich");
    ok(!shared.module?.stammdaten?.fibu, "the shared FiBu value goes away with the last template");
    ok(!shared.katalog?.BU01?.values?.kontenrahmen, "the shared chart of accounts goes away with the last template");
    ok(!systemNames(shared).includes("DATEV"), "the shared system card goes away with the last template");
  } finally {
    const index = SOFTWARE_PRESETS.findIndex((item) => item.id === "probe-gleich");
    if (index >= 0) SOFTWARE_PRESETS.splice(index, 1);
  }

  let owned = ensureGesamt(emptyAnswers());
  owned = {
    ...owned,
    module: { ...owned.module!, stammdaten: { fibu: "DATEV" } },
  };
  owned = setCatalogValue(owned, "B01", "systeme", [{ name: "DATEV", funktion: "Finanzbuchhaltung", typ: "fibu" }]);
  owned = setCatalogValue(owned, "BU01", "kontenrahmen", "SKR 03");
  owned = clickPreset(owned, "datev");
  const reloadedOwned = JSON.parse(JSON.stringify(owned)) as IntakeAnswers;
  const kept = clickPreset(reloadedOwned, "datev");
  ok(kept.module?.stammdaten?.fibu === "DATEV", "a value the user already had stays after deselect and reload");
  ok(kept.katalog?.BU01?.values?.kontenrahmen === "SKR 03", "a chart of accounts the user already had stays");
  ok(systemNames(kept).includes("DATEV"), "a system card the user already had stays");

  let typed = ensureGesamt(emptyAnswers());
  for (const text of ["M", "Me", "Mei", "Mein", "Meine", "Meine ", "Meine F", "Meine Fi", "Meine FiB", "Meine FiBu"]) {
    typed = prefillStammdatenInput(typed, { fibu: text });
  }
  ok(systemNames(typed).join("|") === "Meine FiBu", "typing FiBu creates exactly one B01 card");
  ok(typed.module?.stammdaten?.fibu === "Meine FiBu", "the FiBu field keeps the full text");

  let stale = setCatalogValue(ensureGesamt(emptyAnswers()), "B01", "systeme", [
    { name: "M", funktion: "Finanzbuchhaltung", typ: "fibu" },
    { name: "Me", funktion: "Finanzbuchhaltung", typ: "fibu" },
    { name: "Meine FiBu", funktion: "Finanzbuchhaltung", typ: "fibu" },
  ]);
  stale = {
    ...stale,
    module: { ...stale.module!, stammdaten: { fibu: "Meine FiBu" } },
  };
  stale = prefillStammdatenInput(stale, { fibu: "Meine FiBu X" });
  ok(systemNames(stale).join("|") === "M|Me|Meine FiBu X", "existing intermediate FiBu cards are not deleted");

  let kasseTyped = ensureGesamt(emptyAnswers());
  for (const text of ["K", "Ka", "Kas", "Kasse"]) kasseTyped = prefillStammdatenInput(kasseTyped, { kasse: text });
  ok(kasseTyped.katalog?.KA01?.values?.system === "Kasse", "typing Kasse updates the one catalog field");
  ok(kasseTyped.katalog?.A01?.values?.gastroKasse === "Kasse", "typing Kasse updates the copied field");
  ok(systemNames(kasseTyped).length === 0, "Kasse does not create B01 cards");

  const e05 = (answers: IntakeAnswers): string[] => {
    const value = answers.katalog?.E05?.values?.systeme;
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim());
    return [];
  };
  let templates = clickPreset(ensureGesamt(emptyAnswers()), "lexoffice");
  templates = clickPreset(templates, "sevdesk");
  ok(e05(templates).join("|") === "lexoffice|sevDesk", "sevDesk appends its E05 token");
  templates = clickPreset(templates, "sevdesk");
  ok(templates.module?.software?.join() === "lexoffice", "lexoffice stays selected");
  ok(e05(templates).join("|") === "lexoffice", "deselecting sevDesk keeps the lexoffice token");

  let order = clickPreset(ensureGesamt(emptyAnswers()), "datev");
  order = clickPreset(order, "lexoffice");
  ok(order.module?.stammdaten?.fibu === "DATEV", "the first template still owns FiBu");
  order = clickPreset(order, "datev");
  ok(order.module?.software?.join() === "lexoffice", "lexoffice remains after DATEV is removed");
  ok(order.module?.stammdaten?.fibu === "lexoffice", "FiBu shows the remaining template");
  ok(!systemNames(order).includes("DATEV") && systemNames(order).includes("lexoffice"), "only the remaining system card stays");
  const orderReloaded = prefillKnownFacts(JSON.parse(JSON.stringify(order)) as IntakeAnswers);
  ok(orderReloaded.module?.stammdaten?.fibu === "lexoffice", "the remaining FiBu value survives draft reload");

  let editedOrder = clickPreset(ensureGesamt(emptyAnswers()), "datev");
  editedOrder = clickPreset(editedOrder, "lexoffice");
  editedOrder = {
    ...editedOrder,
    module: {
      ...editedOrder.module!,
      stammdaten: { ...editedOrder.module?.stammdaten, fibu: "DATEV Unternehmen online" },
    },
  };
  editedOrder = clickPreset(editedOrder, "datev");
  ok(editedOrder.module?.stammdaten?.fibu === "DATEV Unternehmen online", "an edited FiBu value is not replaced");

  const kasseProbe = {
    id: "probe-kasse",
    label: "Probe Kasse",
    values: { KA01: { art: "Andere Kasse" } },
    stammdaten: { kasse: "Andere Kasse" },
  };
  SOFTWARE_PRESETS.push(kasseProbe);
  try {
    let bothKasse = clickPreset(ensureGesamt(emptyAnswers()), "pos");
    bothKasse = clickPreset(bothKasse, "probe-kasse");
    ok(bothKasse.module?.stammdaten?.kasse === "POS-System", "the first Kasse template keeps the field");
    bothKasse = clickPreset(bothKasse, "pos");
    ok(bothKasse.module?.stammdaten?.kasse === "Andere Kasse", "Kasse shows the remaining template");
    ok(bothKasse.katalog?.KA01?.values?.system === "Andere Kasse", "the Kasse copy follows the remaining template");
    let editedKasse = clickPreset(ensureGesamt(emptyAnswers()), "pos");
    editedKasse = clickPreset(editedKasse, "probe-kasse");
    editedKasse = {
      ...editedKasse,
      module: {
        ...editedKasse.module!,
        stammdaten: { ...editedKasse.module?.stammdaten, kasse: "Meine Kasse" },
      },
    };
    editedKasse = clickPreset(editedKasse, "pos");
    ok(editedKasse.module?.stammdaten?.kasse === "Meine Kasse", "an edited Kasse value is not replaced");
  } finally {
    const index = SOFTWARE_PRESETS.findIndex((item) => item.id === "probe-kasse");
    if (index >= 0) SOFTWARE_PRESETS.splice(index, 1);
  }

  console.log("check-software-preset-toggle: green");
}

export function checkDraftMerge(): void {
  const saved = ensureGesamt(emptyAnswers());
  saved.gf = "Gespeichert";
  const typed = ensureGesamt(emptyAnswers());
  typed.gf = "Neu getippt";
  const defaults = {
    validFrom: "2026-10-08",
    validTo: "",
    changeSummary: "",
    changedBy: "owner@example.com",
  };
  const restored = resolveDraftAfterLoad({
    saved: {
      answers: saved,
      step: 4,
      revision: 3,
      change: {
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        changeSummary: "Erstfassung",
        changedBy: "owner@example.com",
      },
    },
    localEdited: false,
    localRevision: 0,
    current: { answers: typed, step: 0, change: defaults },
  });
  ok(restored.restored, "untouched form restores the draft");
  ok(restored.answers.gf === "Gespeichert", "restored answers come from the draft");
  ok(restored.step === 4, "restored step comes from the draft");
  ok(restored.change.validFrom === "2026-01-01", "Gültig ab is restored");
  ok(restored.change.validTo === "2026-12-31", "Gültig bis is restored");
  ok(restored.change.changeSummary === "Erstfassung", "Änderungsgrund is restored");
  ok(restored.revision === 3, "restore keeps the saved revision");

  const kept = resolveDraftAfterLoad({
    saved: {
      answers: saved,
      step: 4,
      revision: 3,
      change: {
        validFrom: "2026-01-01",
        validTo: "",
        changeSummary: "Alt",
        changedBy: "owner@example.com",
      },
    },
    localEdited: true,
    localRevision: 1,
    current: {
      answers: typed,
      step: 2,
      change: { ...defaults, validFrom: "2026-06-01", changeSummary: "Neu" },
    },
  });
  ok(!kept.restored, "typed input is not marked restored");
  ok(kept.answers.gf === "Neu getippt", "typed answers are not overwritten by Fortsetzen");
  ok(kept.step === 2, "typed step is not overwritten");
  ok(kept.change.validFrom === "2026-06-01", "typed Gültig ab is not overwritten");
  ok(kept.change.changeSummary === "Neu", "typed Änderungsgrund is not overwritten");
  ok(kept.revision === 3, "local edits keep a revision the server will accept");

  const legacy = resolveDraftAfterLoad({
    saved: { answers: saved, step: 1, revision: 2 },
    localEdited: false,
    localRevision: 0,
    current: { answers: typed, step: 0, change: defaults },
  });
  ok(legacy.restored, "draft without version fields still restores answers");
  ok(legacy.change.validFrom === defaults.validFrom, "missing Gültig ab keeps the form default");
  ok(parseDraftVersionChange(null) === null, "absent change does not invent dates");
  ok(
    parseDraftVersionChange({ validFrom: "2026-03-01", validTo: "", changeSummary: "Grund", changedBy: "a@example.com" })
      ?.changeSummary === "Grund",
    "change payload round-trips",
  );
  console.log("check-draft-merge: green");
}

function sheetRow(partial: Partial<SheetRow>): SheetRow {
  return { ...emptySheetRow(), ...partial };
}

export function checkDocumentOwnership(): void {
  const older = sheetRow({
    documentId: "doc-old",
    parentDocumentId: "doc-old",
    email: "owner@example.com",
    version: "1",
    timestamp: "2026-10-01T10:00:00.000Z",
  });
  const newer = sheetRow({
    documentId: "doc-new",
    parentDocumentId: "doc-old",
    email: "owner@example.com",
    version: "2",
    timestamp: "2026-10-08T10:00:00.000Z",
  });
  const foreign = sheetRow({
    documentId: "foreign-doc",
    parentDocumentId: "doc-old",
    email: "other@example.com",
    version: "9",
    timestamp: "2026-10-08T12:00:00.000Z",
  });
  const picked = latestOwnedInFamily([older, foreign, newer], "owner@example.com");
  ok(picked?.documentId === "doc-new", "edit target is the newest version of this mailbox");
  ok(picked?.email === "owner@example.com", "edit target email matches the session mailbox");
  ok(latestOwnedInFamily([foreign], "owner@example.com") === null, "another mailbox is not selectable");
  const first = sheetRow({
    documentId: "first-row",
    parentDocumentId: "fam",
    email: "owner@example.com",
    version: "1",
    timestamp: "2026-01-01T00:00:00.000Z",
  });
  const second = sheetRow({
    documentId: "second-row",
    parentDocumentId: "fam",
    email: "owner@example.com",
    version: "1",
    timestamp: "2026-10-08T00:00:00.000Z",
  });
  ok(
    latestOwnedInFamily([first, second], "Owner@Example.com")?.documentId === "second-row",
    "same version: newest timestamp wins over the first sheet row",
  );
  console.log("check-document-ownership: green");
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("check-intake-draft.ts") || entry.endsWith("check-intake-draft.js")) {
  checkIntakeDraftRestore();
  checkSoftwarePresetToggle();
  checkDraftMerge();
  checkDocumentOwnership();
}
