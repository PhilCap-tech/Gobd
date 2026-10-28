/**
 * Account prefill from Checkout customer_details, and the company-card wording.
 * Synthetic sessions only — no Stripe network and no draft storage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type Stripe from "stripe";
import { AccountCompanyCard } from "../components/account-company-card";
import {
  checkoutAccountFactsFromIdentity,
  firstCompanyFormDefaults,
  mergeCheckoutIntoFirstCompany,
  profileNameFromCheckout,
  profilePrefillName,
  type CheckoutAccountFacts,
} from "../lib/account-checkout-prefill";
import {
  CHECKOUT_PREFILL_NOTE,
  FIRMA_ADD_LABEL,
  FIRMA_EDIT_LABEL,
} from "../lib/account-labels";
import {
  DEFAULT_ENTITY_NAME,
  MAX_ENTITIES_PER_ACCOUNT,
  emptyEntity,
  type Entity,
} from "../lib/entities";
import { PROFILE_NAME_MAX } from "../lib/profile";
import { resolveCheckoutSession } from "../lib/stripe";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const STAMP = "2026-04-01T10:00:00.000Z";

function company(overrides: Partial<Entity> = {}): Entity {
  return {
    ...emptyEntity(),
    entityId: "ent_1",
    userEmail: "ada@example.com",
    name: DEFAULT_ENTITY_NAME,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

function facts(overrides: Partial<CheckoutAccountFacts> = {}): CheckoutAccountFacts {
  return {
    profileName: "Ada Lovelace",
    companyName: "Nordlicht Handel GmbH",
    street: "Königstraße 12",
    zip: "50667",
    city: "Köln",
    ustId: "DE136695976",
    ...overrides,
  };
}

function checkProfile() {
  ok(profilePrefillName(null, facts()) === "Ada Lovelace", "leeres Profil erhält customer_details.name");
  ok(
    profilePrefillName({ name: "Petra Beispiel" }, facts()) === null,
    "gespeicherter Profilname wird nicht überschrieben",
  );
  ok(
    profilePrefillName({ name: "" }, facts({ profileName: "Ada Lovelace" })) === null,
    "geleerter Profilname bleibt leer",
  );
  ok(profilePrefillName(null, facts({ profileName: "   " })) === null, "leerer Checkout-Name füllt nichts");
  ok(
    profileNameFromCheckout("  Ada   Lovelace \n") === "Ada Lovelace",
    "Profilname aus dem Checkout wird auf eine Zeile gekürzt",
  );
  const long = `${"Ä".repeat(PROFILE_NAME_MAX)} extra`;
  ok(
    profileNameFromCheckout(long).length === PROFILE_NAME_MAX,
    "zu langer Checkout-Name wird auf die Profilgrenze gekürzt",
  );
  ok(
    profilePrefillName(null, facts({ profileName: "Nordlicht Handel GmbH" })) ===
      "Nordlicht Handel GmbH",
    "customer_details.name wird auch dann übernommen, wenn er wie ein Firmenname aussieht",
  );
}

function checkCompanyMerge() {
  const fresh = mergeCheckoutIntoFirstCompany(company(), facts());
  ok(fresh?.review === true, "erste Firma aus dem Checkout soll geprüft werden");
  ok(fresh?.input.name === "Nordlicht Handel GmbH", "Platzhaltername wird zum Firmennamen aus dem Checkout");
  ok(fresh?.input.street === "Königstraße 12", "Straße kommt aus der Checkout-Adresse");
  ok(fresh?.input.zip === "50667", "PLZ kommt aus der Checkout-Adresse");
  ok(fresh?.input.city === "Köln", "Ort kommt aus der Checkout-Adresse");
  ok(fresh?.input.ustId === "DE136695976", "USt-IdNr. kommt aus dem Checkout");
  ok(fresh?.input.stnr === "", "Steuernummer bleibt unberührt");

  const edited = mergeCheckoutIntoFirstCompany(
    company({
      name: "Eigene Firma GmbH",
      street: "Hafenweg 2",
      zip: "20457",
      city: "Hamburg",
      stnr: "12/345/67890",
      ustId: "DE111111111",
      updatedAt: "2026-05-01T10:00:00.000Z",
    }),
    facts({
      companyName: "Andere GmbH",
      street: "Königstraße 12",
      zip: "50667",
      city: "Köln",
      ustId: "DE136695976",
    }),
  );
  ok(edited?.review === false, "vollständig eigene Firma braucht keinen Prüfhinweis");
  ok(edited?.input.name === "Eigene Firma GmbH", "eigener Firmenname bleibt");
  ok(edited?.input.street === "Hafenweg 2", "eigene Straße bleibt");
  ok(edited?.input.zip === "20457", "eigene PLZ bleibt");
  ok(edited?.input.city === "Hamburg", "eigener Ort bleibt");
  ok(edited?.input.ustId === "DE111111111", "eigene USt-IdNr. bleibt");
  ok(edited?.input.stnr === "12/345/67890", "eigene Steuernummer bleibt");

  const partial = mergeCheckoutIntoFirstCompany(
    company({
      name: "Nordlicht Handel GmbH",
      street: "Hafenweg 2",
      updatedAt: "2026-05-01T10:00:00.000Z",
    }),
    facts({ street: "Königstraße 12", zip: "50667", city: "Köln" }),
  );
  ok(partial?.input.street === "Hafenweg 2", "gefüllte Straße bleibt bei Teiladresse");
  ok(partial?.input.zip === "50667", "leere PLZ wird gefüllt");
  ok(partial?.input.city === "Köln", "leerer Ort wird gefüllt");
  ok(partial?.review === true, "ergänzte Adresse soll geprüft werden");

  const keptPlaceholder = mergeCheckoutIntoFirstCompany(
    company({
      name: DEFAULT_ENTITY_NAME,
      updatedAt: "2026-05-02T10:00:00.000Z",
    }),
    facts(),
  );
  ok(
    keptPlaceholder?.input.name === DEFAULT_ENTITY_NAME,
    "gespeicherter Platzhaltername wird nicht ersetzt",
  );
  ok(keptPlaceholder?.input.city === "Köln", "Adresse wird trotzdem in leere Felder geschrieben");

  const careOf = mergeCheckoutIntoFirstCompany(
    company(),
    facts({ street: "c/o Max Test, Königstraße 12" }),
  );
  ok(
    careOf?.input.street === "c/o Max Test, Königstraße 12",
    "Rechnungsadresse bleibt vollständig, auch mit c/o",
  );

  ok(
    mergeCheckoutIntoFirstCompany(company({ checkoutPrefill: "done", street: "" }), facts()) === null,
    "erledigte Vorausfüllung füllt geleerte Felder nicht erneut",
  );
  ok(
    mergeCheckoutIntoFirstCompany(company({ checkoutPrefill: "review", street: "" }), facts()) === null,
    "offene Prüfung wird nicht ein zweites Mal beschrieben",
  );

  const second = firstCompanyFormDefaults(1, facts());
  ok(second.showNote === false && !second.initial, "weitere Firma übernimmt keine Checkout-Daten");
  const firstForm = firstCompanyFormDefaults(0, facts());
  ok(firstForm.showNote === true, "erste Firma anlegen zeigt den Prüfhinweis");
  ok(firstForm.initial?.name === "Nordlicht Handel GmbH", "Formular der ersten Firma erhält den Firmennamen");
  ok(firstForm.initial?.street === "Königstraße 12", "Formular der ersten Firma erhält die Straße");
  ok(firstForm.initial?.ustId === "DE136695976", "Formular der ersten Firma erhält die USt-IdNr.");
  ok(firstCompanyFormDefaults(0, null).showNote === false, "ohne Checkout-Daten gibt es keinen Hinweis");
  ok(
    firstCompanyFormDefaults(0, facts({
      profileName: "Ada",
      companyName: "",
      street: "",
      zip: "",
      city: "",
      ustId: "",
    })).showNote === false,
    "ein Personenname allein füllt die Firma nicht",
  );
}

function paidSession(
  details: Stripe.Checkout.Session.CustomerDetails | null,
  companyName = "Nordlicht Handel GmbH",
): Stripe.Checkout.Session {
  return {
    id: "cs_test_account_prefill",
    status: "complete",
    payment_status: "paid",
    customer: "cus_test_account",
    metadata: { company: companyName },
    customer_details: details,
  } as unknown as Stripe.Checkout.Session;
}

async function checkSession() {
  const saved = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_SETUP_ID: process.env.STRIPE_PRICE_SETUP_ID,
    STRIPE_PRICE_MONTHLY_ID: process.env.STRIPE_PRICE_MONTHLY_ID,
  };
  process.env.STRIPE_SECRET_KEY = "sk_test_account_prefill";
  process.env.STRIPE_PRICE_SETUP_ID = "price_setup_prefill";
  process.env.STRIPE_PRICE_MONTHLY_ID = "price_monthly_prefill";
  try {
    const present = await resolveCheckoutSession("cs_test_account_present", async () =>
      paidSession({
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: null,
        tax_exempt: "none",
        business_name: "Anderer Handelsname GmbH",
        individual_name: "Nicht dieser Name",
        address: {
          line1: "Königstraße 12",
          line2: null,
          postal_code: "50667",
          city: "Köln",
          state: null,
          country: "DE",
        },
        tax_ids: [
          { type: "de_stn", value: "12/345/67890" },
          { type: "eu_vat", value: " DE136695976 " },
        ],
      } as unknown as Stripe.Checkout.Session.CustomerDetails),
    );
    ok(!("error" in present), "Checkout-Session mit Name und USt-IdNr. wird gelesen");
    if (!("error" in present)) {
      ok(present.customerName === "Ada Lovelace", "Profilname ist customer_details.name");
      ok(present.customerName !== "Nicht dieser Name", "individual_name ersetzt den Profilnamen nicht");
      ok(present.company === "Nordlicht Handel GmbH", "Firmenname bleibt der Checkout-Metadatenname");
      ok(present.ustId === "DE136695976", "USt-IdNr. ist die eu_vat, nicht die Steuernummer");
      const parsed = checkoutAccountFactsFromIdentity(present);
      ok(parsed.profileName === "Ada Lovelace", "Fakten nutzen customer_details.name fürs Profil");
      ok(parsed.companyName === "Nordlicht Handel GmbH", "Metadaten-Firma gewinnt vor business_name");
      ok(parsed.street === "Königstraße 12", "Straße steht in den Firmenfakten");
      ok(parsed.ustId === "DE136695976", "USt-IdNr. steht in den Firmenfakten");
    }

    const businessOnly = await resolveCheckoutSession("cs_test_business_only", async () =>
      paidSession(
        {
          name: null,
          email: "ada@example.com",
          phone: null,
          tax_exempt: null,
          business_name: "Nordlicht Handel GmbH",
          address: null,
          tax_ids: [{ type: "de_stn", value: "12/345/67890" }],
        } as unknown as Stripe.Checkout.Session.CustomerDetails,
        "",
      ),
    );
    ok(!("error" in businessOnly), "Session ohne Metadaten-Firma bleibt gültig");
    if (!("error" in businessOnly)) {
      ok(!businessOnly.customerName, "ohne customer_details.name gibt es keinen Profilnamen");
      ok(!businessOnly.ustId, "Steuernummer wird nicht zur USt-IdNr.");
      const parsed = checkoutAccountFactsFromIdentity(businessOnly);
      ok(parsed.companyName === "Nordlicht Handel GmbH", "business_name füllt den Firmennamen, wenn Metadaten leer sind");
      ok(parsed.profileName === "", "Profil bleibt ohne customer_details.name leer");
    }
  } finally {
    process.env.STRIPE_SECRET_KEY = saved.STRIPE_SECRET_KEY;
    process.env.STRIPE_PRICE_SETUP_ID = saved.STRIPE_PRICE_SETUP_ID;
    process.env.STRIPE_PRICE_MONTHLY_ID = saved.STRIPE_PRICE_MONTHLY_ID;
  }
}

function checkWording() {
  ok(FIRMA_EDIT_LABEL === "Firmendaten bearbeiten", "Kartenbutton heißt Firmendaten bearbeiten");
  ok(
    FIRMA_ADD_LABEL ===
      (["v2", "v3"].includes((process.env.PRICING_MODEL ?? "").trim().toLowerCase())
        ? "Weitere Firma hinzufügen"
        : `Weitere Firma hinzufügen (bis zu ${MAX_ENTITIES_PER_ACCOUNT} im Abo)`),
    "unter der Karte steht Weitere Firma hinzufügen",
  );
  ok(CHECKOUT_PREFILL_NOTE.includes("Bitte prüfen"), "Prüfhinweis enthält Bitte prüfen");

  const reviewed = renderToStaticMarkup(
    createElement(AccountCompanyCard, {
      email: "ada@example.com",
      group: { entity: company({ checkoutPrefill: "review", name: "Nordlicht Handel GmbH", city: "Köln" }), families: [] },
    }),
  );
  ok(reviewed.includes("Firmendaten bearbeiten"), "Karte zeigt Firmendaten bearbeiten");
  ok(!reviewed.includes("Stammdaten bearbeiten"), "Karte sagt nicht mehr Stammdaten bearbeiten");
  ok(reviewed.includes("Bitte prüfen"), "Karte zeigt den Prüfhinweis");
  ok(!reviewed.includes("Weitere Firma hinzufügen"), "der Hinweis auf eine weitere Firma steht nicht in der Karte");

  const settled = renderToStaticMarkup(
    createElement(AccountCompanyCard, {
      email: "ada@example.com",
      group: { entity: company({ checkoutPrefill: "done", name: "Nordlicht Handel GmbH" }), families: [] },
    }),
  );
  ok(settled.includes("Firmendaten bearbeiten"), "geprüfte Karte behält den Button");
  ok(!settled.includes("Bitte prüfen"), "geprüfte Karte wiederholt den Hinweis nicht");

  const page = readFileSync("app/account/page.tsx", "utf8");
  ok(page.includes("prepareAccountCheckout"), "Konto wendet die Checkout-Vorausfüllung an");
  const listAt = page.indexOf('className="entity-list"');
  const addAt = page.lastIndexOf("FIRMA_ADD_LABEL");
  ok(listAt >= 0 && addAt > listAt, "weitere Firma steht unter den Karten");
  ok(!page.includes("Stammdaten bearbeiten"), "Kontoseite sagt nicht Stammdaten bearbeiten");
  const card = readFileSync("components/account-company-card.tsx", "utf8");
  ok(card.includes("FIRMA_EDIT_LABEL"), "Kartenbutton nutzt Firmendaten bearbeiten");
  ok(card.includes("CHECKOUT_PREFILL_NOTE"), "Karte kann den Prüfhinweis zeigen");
  const profile = readFileSync("components/account-profile-form.tsx", "utf8");
  ok(profile.includes("FIRMA_EDIT_LABEL"), "Profil verlinkt Firmendaten bearbeiten");
  ok(!profile.includes("Stammdaten bearbeiten"), "Profil sagt nicht Stammdaten bearbeiten");
  const form = readFileSync("app/account/firma/firma-form.tsx", "utf8");
  ok(form.includes("showCheckoutNote"), "Firmenformular kann den Prüfhinweis zeigen");
  ok(form.includes("CHECKOUT_PREFILL_NOTE"), "Firmenformular nutzt denselben Prüfhinweis");
  const neu = readFileSync("app/account/firma/neu/page.tsx", "utf8");
  ok(neu.includes("firstCompanyFormDefaults"), "Firma anlegen füllt nur die erste Firma vor");
  const edit = readFileSync("app/account/firma/[id]/page.tsx", "utf8");
  ok(edit.includes('checkoutPrefill === "review"'), "bearbeiten zeigt den Hinweis, solange die Prüfung offen ist");
  const api = readFileSync("app/api/entities/route.ts", "utf8");
  ok(api.includes('checkoutPrefill: "done"'), "Speichern der Firma schließt die Vorausfüllung ab");
}

checkProfile();
checkCompanyMerge();
checkWording();
checkSession()
  .then(() => {
    console.log("check-account-prefill: green");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
