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
  type BillingAddressParts,
  type FirmFacts,
} from "../lib/intake-catalog";
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
  for (const typedPrefix of Array.from("Philip Cappelletti").map((_, index, chars) => chars.slice(0, index + 1).join(""))) {
    frozen = prefillKnownFacts(setStammdaten(frozen, { gf: typedPrefix }));
  }
  ok(
    value(frozen, "A01", "gf") === "P",
    "ohne vorherigen Wert bleibt der erste Buchstabe stehen",
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
  ok(value(stuckReload, "A01", "gf") === "P", "bereits gespeichertes P wird nicht repariert");
  const stuckTyped = prefillStammdatenInput(stuckReload, { gf: "Philip Cappelletti." });
  ok(value(stuckTyped, "A01", "gf") === "P", "ein gespeichertes P gilt als eigener Wert");

  const cleared = prefillKnownFacts(setCatalogValue(stuckReload, "A01", "gf", ""), undefined, {
    protect: [["A01", "gf"]],
  });
  ok(!value(cleared, "A01", "gf"), "Leeren im Modul bleibt leer und holt den Namen nicht zurück");

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

checkNames();
checkStandort();
checkStripeAddress()
  .then(() => {
    console.log("check-prefill-namen: green");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
