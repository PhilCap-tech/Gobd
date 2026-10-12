/**
 * Name prefills from „Namen der Verantwortlichen“ and Standort from the
 * Checkout billing address. Synthetic fixtures only — no draft storage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type Stripe from "stripe";
import {
  prefillKnownFacts,
  prefillStammdatenInput,
  standortFromBillingAddress,
  standortPrefillLine,
  setCatalogValue,
  VERANTWORTLICHE_NAME_FIELDS,
  type BillingAddressParts,
  type FirmFacts,
} from "../lib/intake-catalog";
import { scrollIntakeStepIntoView } from "../lib/intake-step-focus";
import { fieldLabel } from "../lib/intake-present";
import { gruppenFragen, MODULE } from "../lib/module/katalog";
import { ensureGesamt, setStammdaten } from "../lib/module/status";
import type { Stammdaten } from "../lib/module/typen";
import { billingAddressFromCustomerDetails, resolveCheckoutSession } from "../lib/stripe";
import { emptyAnswers, type IntakeAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const NAMES = {
  gf: "Jörg Philip Cappelletti",
  buchhaltung: "Änne Müller-Groß",
  it: "Jürgen Weiß",
  kanzlei: "Sören Höfer",
} as const;

const ROLE_TEXT = [
  `Geschäftsleitung: ${NAMES.gf}`,
  `Buchhaltung: ${NAMES.buchhaltung}`,
  `IT: ${NAMES.it}`,
  `Steuerkanzlei: ${NAMES.kanzlei}`,
].join("\n");

function roundTrip(answers: IntakeAnswers): IntakeAnswers {
  return JSON.parse(JSON.stringify(answers)) as IntakeAnswers;
}

function value(answers: IntakeAnswers, id: string, key: string): string {
  const stored = answers.katalog?.[id]?.values?.[key];
  return typeof stored === "string" ? stored : "";
}

function namesOf(answers: IntakeAnswers) {
  return {
    gf: value(answers, "A01", "gf"),
    buchhaltung: value(answers, "F01", "buchhaltung"),
    it: value(answers, "B01", "it"),
    kanzlei: value(answers, "F05", "kanzleiName"),
    rollen: value(answers, "UO03", "zustaendigkeiten"),
  };
}

function assertFullNames(answers: IntakeAnswers, label: string) {
  const got = namesOf(answers);
  ok(got.gf === NAMES.gf, `${label}: Geschäftsleitung ist der volle Name`);
  ok(got.buchhaltung === NAMES.buchhaltung, `${label}: Buchhaltung ist der volle Name`);
  ok(got.it === NAMES.it, `${label}: IT ist der volle Name`);
  ok(got.kanzlei === NAMES.kanzlei, `${label}: Steuerkanzlei ist der volle Name`);
  ok(got.rollen === ROLE_TEXT, `${label}: Zuständigkeiten enthalten alle vollen Namen`);
  ok(!got.gf.startsWith("J") || got.gf.length > 1, `${label}: Geschäftsleitung ist nicht nur der erste Buchstabe`);
  ok(got.gf !== "J" && got.gf !== "P", `${label}: kein eingefrorener Anfangsbuchstabe`);
}

function typeField(
  start: IntakeAnswers,
  key: keyof Pick<Stammdaten, "gf" | "buchhaltung" | "it" | "kanzlei">,
  full: string,
  firm?: FirmFacts,
): IntakeAnswers {
  let current = start;
  const chars = Array.from(full);
  const catalogKey = {
    gf: ["A01", "gf"],
    buchhaltung: ["F01", "buchhaltung"],
    it: ["B01", "it"],
    kanzlei: ["F05", "kanzleiName"],
  }[key];
  for (let i = 1; i <= chars.length; i += 1) {
    const typed = chars.slice(0, i).join("");
    current = prefillStammdatenInput(current, { [key]: typed }, firm);
    const shown = value(current, catalogKey[0], catalogKey[1]);
    assert.equal(
      shown,
      typed.trim(),
      `${key} blieb bei ${JSON.stringify(shown)} stehen, während ${JSON.stringify(typed)} getippt wurde`,
    );
  }
  return current;
}

function checkNames() {
  const fresh = prefillKnownFacts(
    setStammdaten(ensureGesamt(emptyAnswers()), { ...NAMES }),
    { name: "IKAT GmbH" },
  );
  assertFullNames(fresh, "frisch");
  ok(value(fresh, "A01", "company") === "IKAT GmbH", "Unternehmen bleibt IKAT GmbH");

  let typed = ensureGesamt(emptyAnswers());
  typed = typeField(typed, "gf", "Philip Cappelletti");
  ok(value(typed, "A01", "gf") === "Philip Cappelletti", "Philip Cappelletti wird vollständig übernommen");
  ok(value(typed, "A01", "gf") !== "P", "Geschäftsleitung ist nicht nur P");

  typed = ensureGesamt(emptyAnswers());
  typed = typeField(typed, "gf", NAMES.gf, { name: "IKAT GmbH" });
  typed = typeField(typed, "buchhaltung", NAMES.buchhaltung, { name: "IKAT GmbH" });
  typed = typeField(typed, "it", NAMES.it, { name: "IKAT GmbH" });
  typed = typeField(typed, "kanzlei", NAMES.kanzlei, { name: "IKAT GmbH" });
  assertFullNames(typed, "Tastatureingabe");
  ok(value(typed, "A01", "company") === "IKAT GmbH", "Unternehmen bleibt beim Tippen der Namen vollständig");

  let frozen = ensureGesamt(emptyAnswers());
  for (const typedPrefix of Array.from("Philip Cappelletti").map((_, index, chars) =>
    chars.slice(0, index + 1).join(""),
  )) {
    frozen = prefillKnownFacts(setStammdaten(frozen, { gf: typedPrefix }));
  }
  ok(
    value(frozen, "A01", "gf") === "Phi",
    "ohne vorherigen Wert bleibt der Name beim dritten Zeichen stehen",
  );

  const savedFull = roundTrip(typed);
  const reloadedFull = prefillKnownFacts(savedFull, { name: "IKAT GmbH" });
  assertFullNames(reloadedFull, "Entwurf neu geladen");
  ok(value(reloadedFull, "A01", "company") === "IKAT GmbH", "geladenes Unternehmen bleibt");

  const untouched = roundTrip(setStammdaten(ensureGesamt(emptyAnswers()), { ...NAMES }));
  ok(!value(untouched, "A01", "gf"), "Entwurf ohne Modul-Namen speichert die Katalogfelder nicht vor");
  assertFullNames(prefillKnownFacts(untouched, { name: "IKAT GmbH" }), "leerer Entwurf");

  const edited = setCatalogValue(
    setStammdaten(ensureGesamt(emptyAnswers()), { ...NAMES }),
    "A01",
    "gf",
    "Petra Beispiel",
  );
  edited.katalog = {
    ...edited.katalog,
    F01: { values: { buchhaltung: "Eigene Buchhaltung" } },
    B01: { values: { it: "Eigene IT" } },
    F05: { values: { kanzleiName: "Eigene Kanzlei" } },
    UO03: { values: { zustaendigkeiten: "Selbst eingetragen" } },
  };
  const kept = prefillKnownFacts(roundTrip(edited), { name: "IKAT GmbH" });
  ok(value(kept, "A01", "gf") === "Petra Beispiel", "gespeicherte Geschäftsleitung wird nicht überschrieben");
  ok(value(kept, "F01", "buchhaltung") === "Eigene Buchhaltung", "gespeicherte Buchhaltung bleibt");
  ok(value(kept, "B01", "it") === "Eigene IT", "gespeicherte IT bleibt");
  ok(value(kept, "F05", "kanzleiName") === "Eigene Kanzlei", "gespeicherte Steuerkanzlei bleibt");
  ok(value(kept, "UO03", "zustaendigkeiten") === "Selbst eingetragen", "bearbeitete Zuständigkeiten bleiben");

  const stuck = setCatalogValue(
    setStammdaten(ensureGesamt(emptyAnswers()), { gf: "Philip Cappelletti" }),
    "A01",
    "gf",
    "P",
  );
  const stuckReload = prefillKnownFacts(roundTrip(stuck));
  ok(value(stuckReload, "A01", "gf") === "Philip Cappelletti", "gespeichertes P wird durch den vollen Namen ersetzt");
  const stuckTyped = prefillStammdatenInput(stuckReload, { gf: "Philip Cappelletti." });
  ok(
    value(stuckTyped, "A01", "gf") === "Philip Cappelletti.",
    "nach der Reparatur folgt die Geschäftsleitung wieder der Quelle",
  );

  const twoLetters = setCatalogValue(
    setStammdaten(ensureGesamt(emptyAnswers()), { gf: "Philip Cappelletti" }),
    "A01",
    "gf",
    "Ph",
  );
  ok(value(prefillKnownFacts(roundTrip(twoLetters)), "A01", "gf") === "Philip Cappelletti", "gespeichertes Ph wird ersetzt");

  const threeLetters = setCatalogValue(
    setStammdaten(ensureGesamt(emptyAnswers()), { gf: "Philip Cappelletti" }),
    "A01",
    "gf",
    "Phi",
  );
  ok(value(prefillKnownFacts(threeLetters), "A01", "gf") === "Phi", "ab drei Zeichen bleibt ein Präfix stehen");

  const otherInitial = setCatalogValue(
    setStammdaten(ensureGesamt(emptyAnswers()), { gf: "Özlem Yılmaz" }),
    "A01",
    "gf",
    "P",
  );
  ok(
    value(prefillKnownFacts(otherInitial), "A01", "gf") === "P",
    "P bleibt, wenn es kein Präfix des Namens ist",
  );

  const prefixes = setStammdaten(ensureGesamt(emptyAnswers()), { ...NAMES });
  let withPrefixes = setCatalogValue(prefixes, "A01", "gf", "Jö");
  withPrefixes = setCatalogValue(withPrefixes, "F01", "buchhaltung", "Ä");
  withPrefixes = setCatalogValue(withPrefixes, "B01", "it", "Jü");
  withPrefixes = setCatalogValue(withPrefixes, "F05", "kanzleiName", "Sö");
  withPrefixes = setCatalogValue(
    withPrefixes,
    "UO03",
    "zustaendigkeiten",
    ["Geschäftsleitung: Jö", "Buchhaltung: Ä", "IT: Jü", "Steuerkanzlei: Sö"].join("\n"),
  );
  assertFullNames(prefillKnownFacts(roundTrip(withPrefixes)), "eingefrorene Kürzel");

  const mixedRoles = setCatalogValue(
    setCatalogValue(
      setStammdaten(ensureGesamt(emptyAnswers()), { ...NAMES, gf: "Philip Cappelletti" }),
      "A01",
      "gf",
      "P",
    ),
    "UO03",
    "zustaendigkeiten",
    "Geschäftsleitung: P\nBuchhaltung: Eigene Buchhaltung",
  );
  const mixedKept = prefillKnownFacts(mixedRoles);
  ok(
    value(mixedKept, "A01", "gf") === "Philip Cappelletti",
    "P wird ersetzt, auch wenn die Zuständigkeiten eigen sind",
  );
  ok(
    value(mixedKept, "UO03", "zustaendigkeiten") === "Geschäftsleitung: P\nBuchhaltung: Eigene Buchhaltung",
    "eine eigene Zuständigkeit bleibt stehen",
  );

  const companyPrefix = prefillKnownFacts(
    setCatalogValue(ensureGesamt(emptyAnswers()), "A01", "company", "IK"),
    { name: "IKAT GmbH" },
  );
  ok(value(companyPrefix, "A01", "company") === "IK", "ein Firmenkürzel wird nicht ersetzt");

  const archivPrefix = prefillKnownFacts(
    setCatalogValue(setStammdaten(ensureGesamt(emptyAnswers()), { archiv: "NAS Server" }), "G01", "ablage", "NA"),
  );
  ok(value(archivPrefix, "G01", "ablage") === "NA", "ein Ablage-Kürzel wird nicht ersetzt");

  let protectedTyping = setStammdaten(ensureGesamt(emptyAnswers()), { gf: "Philip Cappelletti" });
  for (const part of ["P", "Pe", "Pet", "Petra"]) {
    protectedTyping = prefillKnownFacts(setCatalogValue(protectedTyping, "A01", "gf", part), undefined, {
      protect: [["A01", "gf"]],
    });
    ok(value(protectedTyping, "A01", "gf") === part, `geschützte Eingabe ${part} bleibt während des Tippens`);
  }

  const cleared = prefillKnownFacts(setCatalogValue(protectedTyping, "A01", "gf", ""), undefined, {
    protect: [["A01", "gf"]],
  });
  ok(value(cleared, "A01", "gf") === "", "Leeren der Geschäftsleitung bleibt leer");
  ok(cleared.katalog?.A01?.cleared?.includes("gf") === true, "Leeren der Geschäftsleitung wird im Entwurf gemerkt");
  ok(
    value(prefillKnownFacts(roundTrip(cleared)), "A01", "gf") === "",
    "geleerte Geschäftsleitung bleibt nach dem Neuladen leer",
  );

  let clearedNames = setStammdaten(ensureGesamt(emptyAnswers()), { ...NAMES });
  clearedNames = prefillKnownFacts(clearedNames);
  for (const [id, key] of [
    ["F01", "buchhaltung"],
    ["B01", "it"],
    ["F05", "kanzleiName"],
  ] as const) {
    clearedNames = prefillKnownFacts(setCatalogValue(clearedNames, id, key, ""), undefined, {
      protect: [[id, key]],
    });
    ok(value(clearedNames, id, key) === "", `geleertes ${key} bleibt in der Sitzung leer`);
  }
  const reloadedClears = prefillKnownFacts(roundTrip(clearedNames));
  ok(value(reloadedClears, "F01", "buchhaltung") === "", "geleerte Buchhaltung bleibt nach dem Neuladen leer");
  ok(value(reloadedClears, "B01", "it") === "", "geleerte IT bleibt nach dem Neuladen leer");
  ok(value(reloadedClears, "F05", "kanzleiName") === "", "geleerte Steuerkanzlei bleibt nach dem Neuladen leer");
  ok(reloadedClears.katalog?.B01?.cleared?.includes("it") === true, "geleerte IT bleibt im neu geladenen Entwurf gemerkt");

  const ui = readFileSync("components/betriebs-check.tsx", "utf8");
  ok(ui.includes("prefillStammdatenInput"), "die Namensfelder nutzen die tastensichere Vorausfüllung");
  const hint = readFileSync("components/intake-questionnaire.tsx", "utf8");
  ok(
    hint.includes("Vorausgefüllt aus bereits erfassten Angaben. Bitte prüfen."),
    "Hinweis bleibt Vorausgefüllt … Bitte prüfen",
  );
  ok(hint.includes("standortPrefillLine"), "Standort-Hinweis vergleicht die Rechnungsadresse");
}

function firmFromBilling(address: BillingAddressParts | null | undefined, extra: FirmFacts = {}): FirmFacts {
  return {
    name: "IKAT GmbH",
    billingLine1: address?.line1 ?? undefined,
    billingPostalCode: address?.postalCode ?? undefined,
    billingCity: address?.city ?? undefined,
    ...extra,
  };
}

function checkStandort() {
  const fullAddress = {
    line1: "Königstraße 12",
    postalCode: "50667",
    city: "Köln",
  };
  ok(
    standortFromBillingAddress(fullAddress) === "Königstraße 12, 50667 Köln",
    "vollständige Adresse mit Umlaut",
  );
  ok(standortFromBillingAddress({ city: "Düsseldorf" }) === "Düsseldorf", "nur der Ort");
  ok(
    standortFromBillingAddress({ postalCode: "40210", city: "Düsseldorf" }) === "40210 Düsseldorf",
    "PLZ und Ort ohne Straße",
  );
  ok(
    standortFromBillingAddress({ line1: "Gartzenweg 1a", city: "Monheim am Rhein" }) ===
      "Gartzenweg 1a, Monheim am Rhein",
    "Straße und Ort ohne PLZ",
  );
  ok(
    standortFromBillingAddress({ line1: "Am Markt", city: "Bonn" }) === "Bonn",
    "Straße ohne Hausnummer passt nicht ins Standortformat",
  );
  ok(
    standortFromBillingAddress({ line1: "Zeile 1\nZeile 2", postalCode: "50667", city: "Köln" }) === "50667 Köln",
    "Zeilenumbruch in der Straße fällt weg",
  );
  ok(
    standortFromBillingAddress({ postalCode: "keine", city: "Bonn" }) === "Bonn",
    "PLZ ohne Ziffer fällt weg",
  );
  ok(standortFromBillingAddress({ line1: "Gartzenweg 1a", postalCode: "40789" }) === "", "ohne Ort bleibt Standort leer");
  ok(standortFromBillingAddress(null) === "", "fehlende Adresse bleibt leer");
  ok(standortFromBillingAddress(undefined) === "", "undefinierte Adresse bleibt leer");
  ok(standortFromBillingAddress({}) === "", "leeres Adressobjekt bleibt leer");
  ok(standortFromBillingAddress({ city: "  \n  " }) === "", "Ort mit Zeilenumbruch bleibt leer");
  ok(
    standortFromBillingAddress({ line1: "c/o Max Test, 3. OG", postalCode: "50667", city: "Köln" }) === "50667 Köln",
    "c/o und Personenname fallen weg, es bleiben PLZ und Ort",
  );
  ok(
    standortFromBillingAddress({
      line1: "Königstraße 12, c/o Max Test, 3. OG",
      postalCode: "50667",
      city: "Köln",
    }) === "Königstraße 12, 50667 Köln",
    "Straße bleibt, c/o und Personenname fallen weg",
  );
  ok(
    standortPrefillLine({
      street: "Hafenweg 2",
      zip: "20457",
      city: "Hamburg",
      billingLine1: "Königstraße 12",
      billingPostalCode: "50667",
      billingCity: "Köln",
    }) === "Hafenweg 2, 20457 Hamburg",
    "hinterlegte Firmenadresse gewinnt vor der Rechnungsadresse",
  );

  const present = prefillKnownFacts(ensureGesamt(emptyAnswers()), firmFromBilling(fullAddress));
  ok(value(present, "A01", "standort") === "Königstraße 12, 50667 Köln", "Modul 1 übernimmt die volle Adresse");
  ok(value(present, "A01", "company") === "IKAT GmbH", "Unternehmen bleibt neben der Adresse gefüllt");
  ok(value(present, "UO01", "standorte") === "Königstraße 12, 50667 Köln", "Standorte im Modul folgen dem Standort");

  const partial = prefillKnownFacts(ensureGesamt(emptyAnswers()), firmFromBilling({ city: "Düsseldorf" }));
  ok(value(partial, "A01", "standort") === "Düsseldorf", "Teiladresse füllt nur den Ort");

  const unfitStreet = prefillKnownFacts(
    ensureGesamt(emptyAnswers()),
    firmFromBilling({ line1: "Am Markt", postalCode: "53111", city: "Bonn" }),
  );
  ok(value(unfitStreet, "A01", "standort") === "53111 Bonn", "unpassende Straße wird nicht in den Standort geschrieben");

  const missing = prefillKnownFacts(ensureGesamt(emptyAnswers()), { name: "IKAT GmbH" });
  ok(value(missing, "A01", "standort") === "", "ohne Adresse bleibt Standort leer");
  ok(value(missing, "A01", "company") === "IKAT GmbH", "ohne Adresse bleibt das Unternehmen gefüllt");

  const owned = setCatalogValue(ensureGesamt(emptyAnswers()), "A01", "standort", "Eigenes Werk");
  const kept = prefillKnownFacts(roundTrip(owned), firmFromBilling(fullAddress));
  ok(value(kept, "A01", "standort") === "Eigenes Werk", "eingetragener Standort bleibt beim Laden");

  const emptyDraft = roundTrip(ensureGesamt(emptyAnswers()));
  const filledOnReload = prefillKnownFacts(emptyDraft, firmFromBilling({ city: "München" }));
  ok(value(filledOnReload, "A01", "standort") === "München", "leerer Entwurf erhält den Ort");

  const careOfFirm = firmFromBilling({ line1: "c/o Max Test, 3. OG", postalCode: "50667", city: "Köln" });
  const careOf = prefillKnownFacts(ensureGesamt(emptyAnswers()), careOfFirm);
  ok(value(careOf, "A01", "standort") === "50667 Köln", "Modul 1 übernimmt bei c/o nur PLZ und Ort");
  ok(!value(careOf, "A01", "standort").includes("Max"), "der Personenname steht nicht im Standort");

  const clearedStandort = prefillKnownFacts(setCatalogValue(present, "A01", "standort", ""), firmFromBilling(fullAddress), {
    protect: [["A01", "standort"]],
  });
  ok(value(clearedStandort, "A01", "standort") === "", "geleerter Standort bleibt in der Sitzung leer");
  ok(clearedStandort.katalog?.A01?.cleared?.includes("standort") === true, "geleerter Standort wird im Entwurf gemerkt");
  const reloadedStandort = prefillKnownFacts(roundTrip(clearedStandort), firmFromBilling(fullAddress));
  ok(value(reloadedStandort, "A01", "standort") === "", "geleerter Standort bleibt nach dem Neuladen leer");
  ok(
    reloadedStandort.katalog?.A01?.cleared?.includes("standort") === true,
    "die Entscheidung bleibt nach dem Neuladen gespeichert",
  );
}

function paidSession(
  details: { address?: Stripe.Address | null; email?: string | null } | null,
): Stripe.Checkout.Session {
  return {
    id: "cs_test_prefill_addr",
    status: "complete",
    payment_status: "paid",
    customer: "cus_test_prefill",
    metadata: { company: "IKAT GmbH" },
    customer_details: details,
  } as unknown as Stripe.Checkout.Session;
}

async function checkStripeAddress() {
  const saved = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_SETUP_ID: process.env.STRIPE_PRICE_SETUP_ID,
    STRIPE_PRICE_MONTHLY_ID: process.env.STRIPE_PRICE_MONTHLY_ID,
  };
  process.env.STRIPE_SECRET_KEY = "sk_test_prefill_offline";
  process.env.STRIPE_PRICE_SETUP_ID = "price_setup_prefill";
  process.env.STRIPE_PRICE_MONTHLY_ID = "price_monthly_prefill";
  try {
    const present = await resolveCheckoutSession("cs_test_present", async () =>
      paidSession({
        email: "ada@example.com",
        address: {
          line1: "Königstraße 12",
          line2: null,
          postal_code: "50667",
          city: "Köln",
          state: null,
          country: "DE",
        },
      }),
    );
    ok(!("error" in present), "vorhandene Adresse lässt die Session zu");
    if (!("error" in present)) {
      ok(present.company === "IKAT GmbH", "Firmenname kommt weiter aus den Metadaten");
      ok(present.billingAddress?.line1 === "Königstraße 12", "line1 wird aus der Session gelesen");
      ok(present.billingAddress?.postalCode === "50667", "postal_code wird aus der Session gelesen");
      ok(present.billingAddress?.city === "Köln", "city wird aus der Session gelesen");
      ok(
        standortFromBillingAddress({
          line1: present.billingAddress?.line1,
          postalCode: present.billingAddress?.postalCode,
          city: present.billingAddress?.city,
        }) === "Königstraße 12, 50667 Köln",
        "gelesene Adresse passt ins Standortfeld",
      );
    }

    const partial = await resolveCheckoutSession("cs_test_partial", async () =>
      paidSession({
        email: "ada@example.com",
        address: {
          line1: null,
          line2: null,
          postal_code: null,
          city: "Düsseldorf",
          state: null,
          country: "DE",
        },
      }),
    );
    ok(!("error" in partial) && partial.billingAddress?.city === "Düsseldorf", "Teiladresse behält den Ort");
    ok(!("error" in partial) && !partial.billingAddress?.line1 && !partial.billingAddress?.postalCode, "fehlende Teile bleiben leer");
    if (!("error" in partial)) {
      ok(
        standortFromBillingAddress({
          line1: partial.billingAddress?.line1,
          postalCode: partial.billingAddress?.postalCode,
          city: partial.billingAddress?.city,
        }) === "Düsseldorf",
        "Teiladresse wird zum Ort",
      );
    }

    const noDetails = await resolveCheckoutSession("cs_test_missing", async () => paidSession(null));
    ok(!("error" in noDetails) && !noDetails.billingAddress, "ohne customer_details gibt es keine Adresse");

    const noAddress = billingAddressFromCustomerDetails({ address: null });
    ok(!noAddress, "address null ergibt keine Rechnungsadresse");
    ok(standortFromBillingAddress(null) === "", "fehlende Session-Adresse füllt den Standort nicht");
  } finally {
    process.env.STRIPE_SECRET_KEY = saved.STRIPE_SECRET_KEY;
    process.env.STRIPE_PRICE_SETUP_ID = saved.STRIPE_PRICE_SETUP_ID;
    process.env.STRIPE_PRICE_MONTHLY_ID = saved.STRIPE_PRICE_MONTHLY_ID;
  }
}

function checkStepFocus() {
  const reduced: ScrollToOptions[] = [];
  const focused: Array<FocusOptions | undefined> = [];
  scrollIntakeStepIntoView({
    reducedMotion: true,
    scrollTo: (opts) => reduced.push(opts),
    heading: { focus: (opts) => focused.push(opts) },
  });
  ok(reduced.length === 1 && reduced[0]?.top === 0 && reduced[0]?.left === 0, "Seitenwechsel springt nach oben");
  ok(reduced[0]?.behavior === "auto", "reduzierte Bewegung scrollt ohne Animation");
  ok(focused[0]?.preventScroll === true, "der Fokus verschiebt die Überschrift nicht vom Fortschritt weg");

  const smooth: ScrollToOptions[] = [];
  scrollIntakeStepIntoView({
    reducedMotion: false,
    scrollTo: (opts) => smooth.push(opts),
    heading: null,
  });
  ok(smooth[0]?.behavior === "smooth" && smooth[0]?.top === 0, "sonst scrollt der Seitenwechsel sanft nach oben");

  const form = readFileSync("app/intake/intake-form.tsx", "utf8");
  ok(form.includes("useIntakeStepFocus(step)"), "Weiter und Zurück lösen den Fokus über den Schritt aus");
  const demo = readFileSync("app/steuerberater/demo/demo-walkthrough.tsx", "utf8");
  ok(demo.includes("useIntakeStepFocus(step)"), "Modulwechsel in der Demo nutzen denselben Fokus");
  const hook = readFileSync("components/intake-step-heading.tsx", "utf8");
  ok(hook.includes("prefers-reduced-motion: reduce"), "der Seitenwechsel fragt reduzierte Bewegung ab");
  ok(hook.includes("}, [step]);"), "der Fokus hängt nur am Seitenwechsel");
  for (const file of [
    "components/intake-questionnaire.tsx",
    "components/betriebs-check.tsx",
    "app/intake/intake-form.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    ok(source.includes("<IntakeStepHeading>"), `${file} fokussiert die Schrittüberschrift`);
    ok(!source.includes("<h1>"), `${file} hat keine weitere Schrittüberschrift ohne Fokus`);
  }
}

const NAME_SAMPLES = {
  gf: { full: "Jörg Philip Cappelletti", prefix: "Jö", real: "Petra Beispiel" },
  buchhaltung: { full: "Änne Müller-Groß", prefix: "Ä", real: "Eigene Buchhaltung" },
  it: { full: "Nevaf Ay", prefix: "N", prefixTwo: "Ne", longer: "Nev", real: "Eigene IT" },
  kanzlei: { full: "Sören Höfer", prefix: "Sö", real: "Eigene Kanzlei" },
} as const;

function roleBlock(names: { gf: string; buchhaltung: string; it: string; kanzlei: string }): string {
  return [
    `Geschäftsleitung: ${names.gf}`,
    `Buchhaltung: ${names.buchhaltung}`,
    `IT: ${names.it}`,
    `Steuerkanzlei: ${names.kanzlei}`,
  ].join("\n");
}

function fieldsContaining(answers: IntakeAnswers, needle: string): string[] {
  const hits: string[] = [];
  for (const [id, entry] of Object.entries(answers.katalog ?? {})) {
    for (const [key, stored] of Object.entries(entry?.values ?? {})) {
      if (typeof stored === "string" && stored.includes(needle)) hits.push(`${id}.${key}`);
    }
  }
  return hits.sort();
}

function moduleAsks(modulId: string, questionId: string): boolean {
  const modul = MODULE.find((item) => item.id === modulId);
  if (!modul) return false;
  if (modul.catalogIds.includes(questionId)) return true;
  return modul.gruppen.some((gruppe) => gruppenFragen(gruppe).some((question) => question.id === questionId));
}

/** One case per field whose source is a Verantwortliche name. */
function checkEveryNameField() {
  const expected = [
    "m01.A01.gf",
    "m01.UO03.zustaendigkeiten",
    "m09.F01.buchhaltung",
    "m17.B01.it",
    "m21.F05.kanzleiName",
  ];
  ok(
    VERANTWORTLICHE_NAME_FIELDS.map((field) => `${field.modulId}.${field.questionId}.${field.key}`).join(",") ===
      expected.join(","),
    "die Liste der Namensfelder ist vollständig und ohne weitere Ziele",
  );

  const scalars = VERANTWORTLICHE_NAME_FIELDS.filter((field) => field.source !== "rollen");
  for (const field of scalars) {
    const sample = NAME_SAMPLES[field.source];
    const where = `Modul ${field.modulNr} ${field.label}`;
    ok(moduleAsks(field.modulId, field.questionId), `${where} liegt in ${field.modulId}`);
    ok(fieldLabel(field.questionId, field.key) === field.label, `${where} trägt das Feldetikett`);

    const fresh = prefillKnownFacts(
      setStammdaten(ensureGesamt(emptyAnswers()), { [field.source]: sample.full }),
    );
    ok(value(fresh, field.questionId, field.key) === sample.full, `${where}: frisch der volle Name`);

    const typed = typeField(ensureGesamt(emptyAnswers()), field.source, sample.full);
    ok(value(typed, field.questionId, field.key) === sample.full, `${where}: Tippweg bleibt beim vollen Namen`);

    const reloaded = prefillKnownFacts(roundTrip(fresh));
    ok(value(reloaded, field.questionId, field.key) === sample.full, `${where}: neu geladener Entwurf bleibt vollständig`);

    const frozen = prefillKnownFacts(
      roundTrip(
        setCatalogValue(
          setStammdaten(ensureGesamt(emptyAnswers()), { [field.source]: sample.full }),
          field.questionId,
          field.key,
          sample.prefix,
        ),
      ),
    );
    ok(
      value(frozen, field.questionId, field.key) === sample.full,
      `${where}: eingefrorenes ${JSON.stringify(sample.prefix)} wird ersetzt`,
    );

    const kept = prefillKnownFacts(
      roundTrip(
        setCatalogValue(
          setStammdaten(ensureGesamt(emptyAnswers()), { [field.source]: sample.full }),
          field.questionId,
          field.key,
          sample.real,
        ),
      ),
    );
    ok(value(kept, field.questionId, field.key) === sample.real, `${where}: eigene Angabe bleibt`);

    const cleared = prefillKnownFacts(setCatalogValue(fresh, field.questionId, field.key, ""), undefined, {
      protect: [[field.questionId, field.key]],
    });
    ok(value(cleared, field.questionId, field.key) === "", `${where}: Leeren bleibt leer`);
    ok(
      cleared.katalog?.[field.questionId]?.cleared?.includes(field.key) === true,
      `${where}: Leeren wird im Entwurf gemerkt`,
    );
    ok(
      value(prefillKnownFacts(roundTrip(cleared)), field.questionId, field.key) === "",
      `${where}: Leeren bleibt nach dem Neuladen leer`,
    );
  }

  const it = NAME_SAMPLES.it;
  const two = prefillKnownFacts(
    setCatalogValue(setStammdaten(ensureGesamt(emptyAnswers()), { it: it.full }), "B01", "it", it.prefixTwo),
  );
  ok(value(two, "B01", "it") === it.full, "Modul 17: gespeichertes Ne wird zu Nevaf Ay");
  const three = prefillKnownFacts(
    setCatalogValue(setStammdaten(ensureGesamt(emptyAnswers()), { it: it.full }), "B01", "it", it.longer),
  );
  ok(value(three, "B01", "it") === it.longer, "Modul 17: Nev ab drei Zeichen bleibt stehen");
  const legacyShort = ensureGesamt(emptyAnswers());
  legacyShort.it = it.prefix;
  const fromLegacy = prefillKnownFacts(
    setCatalogValue(setStammdaten(legacyShort, { it: it.full }), "B01", "it", it.prefix),
  );
  ok(value(fromLegacy, "B01", "it") === it.full, "Modul 17: altes N weicht Nevaf Ay aus den Verantwortlichen");
  const unspecified = ensureGesamt(emptyAnswers());
  unspecified.it = "nicht angegeben";
  ok(
    value(prefillKnownFacts(setStammdaten(unspecified, { it: it.full })), "B01", "it") === it.full,
    "Modul 17: nicht angegeben blockiert den IT-Namen nicht",
  );

  const stamm = {
    gf: NAME_SAMPLES.gf.full,
    buchhaltung: NAME_SAMPLES.buchhaltung.full,
    it: NAME_SAMPLES.it.full,
    kanzlei: NAME_SAMPLES.kanzlei.full,
  };
  const roles = roleBlock(stamm);
  const roleField = VERANTWORTLICHE_NAME_FIELDS.find((field) => field.source === "rollen");
  ok(roleField?.questionId === "UO03", "Zuständigkeiten sind das zusammengesetzte Namensfeld");
  ok(moduleAsks("m01", "UO03"), "Zuständigkeiten liegen in Modul 1");
  ok(
    fieldLabel("UO03", "zustaendigkeiten", roleField?.label) === roleField?.label,
    "Zuständigkeiten tragen das Feldetikett",
  );
  const freshRoles = prefillKnownFacts(setStammdaten(ensureGesamt(emptyAnswers()), stamm));
  ok(value(freshRoles, "UO03", "zustaendigkeiten") === roles, "Zuständigkeiten frisch mit allen vollen Namen");
  ok(
    value(prefillKnownFacts(roundTrip(freshRoles)), "UO03", "zustaendigkeiten") === roles,
    "Zuständigkeiten bleiben im neu geladenen Entwurf",
  );
  const frozenRoles = prefillKnownFacts(
    setCatalogValue(
      setStammdaten(ensureGesamt(emptyAnswers()), stamm),
      "UO03",
      "zustaendigkeiten",
      roleBlock({
        gf: NAME_SAMPLES.gf.prefix,
        buchhaltung: NAME_SAMPLES.buchhaltung.prefix,
        it: NAME_SAMPLES.it.prefix,
        kanzlei: NAME_SAMPLES.kanzlei.prefix,
      }),
    ),
  );
  ok(value(frozenRoles, "UO03", "zustaendigkeiten") === roles, "eingefrorene Kürzel in den Zuständigkeiten werden ersetzt");
  const customRoles = prefillKnownFacts(
    setCatalogValue(setStammdaten(ensureGesamt(emptyAnswers()), stamm), "UO03", "zustaendigkeiten", "Selbst eingetragen"),
  );
  ok(value(customRoles, "UO03", "zustaendigkeiten") === "Selbst eingetragen", "eigene Zuständigkeiten bleiben je Feld");
  const clearedRoles = prefillKnownFacts(setCatalogValue(freshRoles, "UO03", "zustaendigkeiten", ""), undefined, {
    protect: [["UO03", "zustaendigkeiten"]],
  });
  ok(value(clearedRoles, "UO03", "zustaendigkeiten") === "", "Leeren der Zuständigkeiten bleibt leer");
  ok(
    value(prefillKnownFacts(roundTrip(clearedRoles)), "UO03", "zustaendigkeiten") === "",
    "geleerte Zuständigkeiten bleiben nach dem Neuladen leer",
  );

  ok(
    fieldsContaining(freshRoles, NAME_SAMPLES.gf.full).join(",") === "A01.gf,UO03.zustaendigkeiten",
    "der Name der Geschäftsführung landet nur in Modul 1",
  );
  ok(
    fieldsContaining(freshRoles, NAME_SAMPLES.buchhaltung.full).join(",") === "F01.buchhaltung,UO03.zustaendigkeiten",
    "der Name der Buchhaltung landet nur in Modul 9 und den Zuständigkeiten",
  );
  ok(
    fieldsContaining(freshRoles, NAME_SAMPLES.it.full).join(",") === "B01.it,UO03.zustaendigkeiten",
    "Nevaf Ay landet nur in der IT-Verantwortung und den Zuständigkeiten",
  );
  ok(
    fieldsContaining(freshRoles, NAME_SAMPLES.kanzlei.full).join(",") === "F05.kanzleiName,UO03.zustaendigkeiten",
    "der Kanzleiname landet nur in Modul 21 und den Zuständigkeiten",
  );
}

checkNames();
checkEveryNameField();
checkStandort();
checkStepFocus();
checkStripeAddress()
  .then(() => {
    console.log("check-prefill-namen: green");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
