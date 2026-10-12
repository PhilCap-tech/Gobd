/**
 * Offline-Check: „Keine regelmäßige Kontrolle“ und „Keine Ausnahmen“.
 * Der PDF-Text enthält die Keine-Aussage und keinen Katalog- oder Fallbacktext.
 * Usage: npx tsx scripts/check-keine-angaben.ts
 */
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { CATALOG_STEPS, catalogStepIssues } from "@/lib/intake-catalog";
import { emptyChannelDetail, normalizeIntakeAnswers, p1FieldError, TYPISCHE_KONTROLLEN } from "@/lib/intake-present";
import {
  KEINE_AUSNAHMEN_SATZ,
  KEINE_KONTROLLE_SATZ,
  KEINE_REGELMAESSIGE_KONTROLLE,
} from "@/lib/keine-angaben";
import { ensureGesamt } from "@/lib/module/status";
import { intakeCheckoutStatus, resolveCheckoutSession } from "@/lib/stripe";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

function stepOf(questionId: string): number {
  return CATALOG_STEPS.findIndex((step) => step.questions.some((question) => question.id === questionId));
}

function gesamt(katalog: NonNullable<IntakeAnswers["katalog"]>, papier = false): IntakeAnswers {
  const base = ensureGesamt({ ...emptyAnswers(), katalog });
  if (!papier || !base.module) return base;
  return {
    ...base,
    module: { ...base.module, check: { ...base.module.check, papier: "ja" } },
  };
}

function issues(questionId: string, answers: IntakeAnswers): string[] {
  return catalogStepIssues(stepOf(questionId), answers)
    .filter((issue) => issue.questionId === questionId)
    .map((issue) => issue.message);
}

function render(answers: IntakeAnswers, onlyModul?: string): string {
  const doc = renderDeliveryDocument({
    identity: {
      email: "qa@example.com",
      company: "QA Beispiel GmbH",
      stripeSessionId: "",
      stripeCustomerId: "",
      stub: true,
    },
    answers,
    documentId: "keine-angaben",
    version: 1,
    onlyModul,
  });
  return [doc.cover, ...doc.chapters.map((chapter) => chapter.body)].join("\n");
}

const LE = "Abgleich erbrachter Leistungen mit Rechnungen";
const VK = "Lückenprüfung der Rechnungsnummern";
const KASSE = "Täglicher Kassensturz (Soll-Ist-Abgleich)";
const KATALOG_KONTROLLEN = [
  VK,
  "Abgleich erbrachter Leistungen mit gestellten Rechnungen",
  LE,
  "Freigabe von Angeboten und Sonderpreisen",
  "keine konkrete Kontrollroutine",
  "Typische Kandidaten",
  "Postfachsichtung",
  `| ${KEINE_REGELMAESSIGE_KONTROLLE} |`,
];

const exclusive = normalizeIntakeAnswers({
  ...emptyAnswers(),
  katalog: {
    LE92: { status: "bestaetigt", values: { kontrollen: [LE, KEINE_REGELMAESSIGE_KONTROLLE], details: "Rest" } },
    VK92: { status: "bestaetigt", values: { kontrollen: [KEINE_REGELMAESSIGE_KONTROLLE, VK], details: "bleibt" } },
    KA92: { status: "bestaetigt", values: { kontrollen: [KASSE], details: "täglich" } },
    H01: {
      status: "bestaetigt",
      values: {
        keineKontrolle: true,
        kontrollen: [{ name: "Stichprobe", turnus: "monatlich", wer: "A", nachweis: "Liste" }],
      },
    },
    KF01: { status: "bestaetigt", values: { keineKontrolle: true, kontrollen: "Nummernlücken von Hand" } },
  },
});
expect(
  JSON.stringify(exclusive.katalog?.LE92?.values?.kontrollen) === JSON.stringify([KEINE_REGELMAESSIGE_KONTROLLE]),
  "letzte Keine-Auswahl ersetzt die übrigen Kontrollen",
);
expect(exclusive.katalog?.LE92?.values?.details === "", "Keine löscht den Detailtext");
expect(
  JSON.stringify(exclusive.katalog?.VK92?.values?.kontrollen) === JSON.stringify([VK]),
  "konkrete Kontrolle nach der Keine-Option bleibt",
);
expect(exclusive.katalog?.VK92?.values?.details === "bleibt", "Detailtext einer konkreten Kontrolle bleibt");
expect(JSON.stringify(exclusive.katalog?.KA92?.values?.kontrollen) === JSON.stringify([KASSE]), "reale Kontrolle bleibt unverändert");
expect(
  exclusive.katalog?.H01?.values?.keineKontrolle === true &&
    Array.isArray(exclusive.katalog?.H01?.values?.kontrollen) &&
    exclusive.katalog.H01.values.kontrollen.length === 0,
  "H01-Flag leert die Kontrollzeilen",
);
expect(exclusive.katalog?.KF01?.values?.kontrollen === "", "KF-Text entfällt bei der Keine-Angabe");

const mixed = normalizeIntakeAnswers({
  ...emptyAnswers(),
  katalog: {
    H01: {
      status: "bestaetigt",
      values: {
        kontrollen: [
          { name: KEINE_REGELMAESSIGE_KONTROLLE },
          { name: "Stichprobe", turnus: "monatlich", wer: "A", nachweis: "Liste" },
        ],
      },
    },
  },
});
const mixedRows = mixed.katalog?.H01?.values?.kontrollen;
expect(
  Array.isArray(mixedRows) && mixedRows.length === 1 && (mixedRows[0] as { name?: string }).name === "Stichprobe",
  "gemischte H01-Zeilen behalten die konkrete Kontrolle",
);
expect(normalizeIntakeAnswers(exclusive) === exclusive, "Normalize ist idempotent");
const untouched = gesamt({
  LE92: { status: "bestaetigt", values: { kontrollen: [LE], details: "monatlich, Inhaber, Vermerk" } },
});
expect(normalizeIntakeAnswers(untouched) === untouched, "unveränderte Angaben bleiben dasselbe Objekt");

const keineLe = gesamt({
  LE92: { status: "bestaetigt", values: { kontrollen: [KEINE_REGELMAESSIGE_KONTROLLE], details: "" } },
});
expect(issues("LE92", keineLe).length === 0, "Keine regelmäßige Kontrolle erfüllt LE92");
expect(
  issues("LE92", gesamt({ LE92: { status: "bestaetigt", values: { kontrollen: [], details: "" } } })).length > 0,
  "leere Kontrollen bleiben Pflicht",
);
expect(
  issues("LE92", gesamt({ LE92: { status: "bestaetigt", values: { kontrollen: [LE], details: "" } } })).length > 0,
  "konkrete Kontrolle ohne Details bleibt offen",
);
expect(issues("LE92", untouched).length === 0, "bestehende Kontrolle mit Details bleibt gültig");
expect(
  p1FieldError("H01", "bestaetigt", { keineKontrolle: true, kontrollen: [] }) === "",
  "H01 ohne Kontrolle ist vollständig",
);
expect(
  issues("KF01", gesamt({ KF01: { status: "bestaetigt", values: { keineKontrolle: true, kontrollen: "" } } })).length === 0,
  "KF01 ohne Kontrolle ist vollständig",
);
const channel = {
  ...emptyChannelDetail(),
  ort: "postfach@example.com",
  wer: "Inhaber",
  turnus: "wöchentlich",
  uebergabe: "Buchhaltung",
};
expect(
  p1FieldError("C02", "bestaetigt", { kanaeleDetail: { "E-Mail-PDF": { ...channel, keineAusnahmen: true } } }, ["E-Mail-PDF"]) === "",
  "Keine Ausnahmen erfüllt C02",
);
expect(
  p1FieldError("C03", "bestaetigt", { eingang: { ...channel, keineAusnahmen: true } }) === "",
  "Keine Ausnahmen erfüllt C03",
);
expect(
  p1FieldError("C02", "bestaetigt", { kanaeleDetail: { "E-Mail-PDF": channel } }, ["E-Mail-PDF"]).length > 0,
  "C02 ohne Ausnahme und ohne Auswahl bleibt offen",
);

const m02 = render(
  gesamt({
    VK92: { status: "bestaetigt", values: { kontrollen: [KEINE_REGELMAESSIGE_KONTROLLE], details: "alt" } },
    LE92: { status: "bestaetigt", values: { kontrollen: [KEINE_REGELMAESSIGE_KONTROLLE], details: "" } },
  }),
  "m02",
);
expect(m02.includes(KEINE_KONTROLLE_SATZ), "PDF nennt die fehlende regelmäßige Kontrolle");
for (const phrase of KATALOG_KONTROLLEN) {
  expect(!m02.includes(phrase), `PDF enthält Katalogtext „${phrase}“`);
}

const m20 = render(
  gesamt({
    H01: { status: "bestaetigt", values: { keineKontrolle: true, kontrollen: [] } },
    KF01: { status: "bestaetigt", values: { keineKontrolle: true, kontrollen: "Nummernlücken" } },
    KF02: { status: "bestaetigt", values: { keineKontrolle: true, kontrollen: "Stichprobe" } },
    KF03: { status: "bestaetigt", values: { keineKontrolle: true, ablauf: "Eskalation", wer: "Inhaber" } },
    KF04: { status: "bestaetigt", values: { keineKontrolle: true, nachweis: "Protokoll" } },
    KF05: { status: "bestaetigt", values: { keineKontrolle: true, wer: "Inhaber", turnus: "monatlich" } },
  }),
  "m20",
);
expect(m20.includes(KEINE_KONTROLLE_SATZ), "Modul Kontrollen nennt die Keine-Aussage");
for (const name of TYPISCHE_KONTROLLEN) {
  expect(!m20.includes(name), `Modul Kontrollen nennt die Beispielkontrolle „${name}“`);
}
expect(!m20.includes("Typische Kandidaten"), "Modul Kontrollen nutzt den Fallback");
expect(!m20.includes("keine konkrete Kontrollroutine"), "Modul Kontrollen nutzt den Kontrollroutine-Fallback");
expect(!m20.includes("Nummernlücken"), "zurückgelassener KF-Text erscheint nicht");

const m03 = render(
  gesamt({
    C02: {
      status: "bestaetigt",
      values: {
        kanaeleDetail: {
          "E-Mail-PDF": { ...channel, ausnahmen: "Barbelege vom Wochenmarkt", keineAusnahmen: true },
        },
      },
    },
  }),
  "m03",
);
expect(m03.includes(KEINE_AUSNAHMEN_SATZ), "PDF sagt Ausnahmen: keine");
expect(!m03.includes("Barbelege vom Wochenmarkt"), "PDF erfindet die gelöschte Ausnahme nicht");
expect(!m03.includes("Urlaubsvertretung"), "PDF nutzt die Beispielausnahme nicht");

const m06 = render(
  gesamt(
    {
      C03: {
        status: "bestaetigt",
        values: {
          eingang: { ...channel, ausnahmen: "Urlaubsvertretung", keineAusnahmen: true },
          schritte: "Ausnahmen: Urlaubsvertretung",
        },
      },
    },
    true,
  ),
  "m06",
);
expect(m06.includes(KEINE_AUSNAHMEN_SATZ), "Papierweg sagt Ausnahmen: keine");
expect(!m06.includes("Urlaubsvertretung"), "Papierweg behält die Beispielausnahme nicht");

const areaDoc = renderDeliveryDocument({
  identity: {
    email: "qa@example.com",
    company: "QA Beispiel GmbH",
    stripeSessionId: "",
    stripeCustomerId: "",
    stub: true,
  },
  answers: {
    ...emptyAnswers(),
    bereich: "kasse",
    katalog: {
      KA92: { status: "bestaetigt", values: { kontrollen: [KEINE_REGELMAESSIGE_KONTROLLE], details: "alt" } },
    },
  },
  documentId: "keine-kasse",
  version: 1,
});
const area = areaDoc.chapters.find((chapter) => chapter.id === "bereich-kasse")?.body ?? "";
expect(area.includes(KEINE_KONTROLLE_SATZ), "Bereichskapitel nennt die Keine-Aussage");
expect(!area.includes(KASSE), "Bereichskapitel druckt den Kontrollkatalog nicht");
expect(!area.includes("Die Tabelle nennt typische Kontrollen"), "Bereichskapitel kündigt keine Katalogtabelle an");

const livedArea = renderDeliveryDocument({
  identity: {
    email: "qa@example.com",
    company: "QA Beispiel GmbH",
    stripeSessionId: "",
    stripeCustomerId: "",
    stub: true,
  },
  answers: {
    ...emptyAnswers(),
    bereich: "kasse",
    katalog: {
      KA92: { status: "bestaetigt", values: { kontrollen: [KASSE], details: "täglich, Inhaber, Zählprotokoll" } },
    },
  },
  documentId: "kasse-kontrolle",
  version: 1,
});
const lived = livedArea.chapters.find((chapter) => chapter.id === "bereich-kasse")?.body ?? "";
expect(lived.includes(KASSE), "bestätigte Kontrolle bleibt im Bereichskapitel");
expect(lived.includes("durchgeführt"), "bestätigte Kontrolle gilt als durchgeführt");
expect(!lived.includes(KEINE_KONTROLLE_SATZ), "konkrete Kontrolle wird nicht zur Keine-Aussage");

const belegfluss = render({
  ...emptyAnswers(),
  katalog: {
    H01: { status: "bestaetigt", values: { keineKontrolle: true, kontrollen: [] } },
  },
});
expect(belegfluss.includes(KEINE_KONTROLLE_SATZ), "Belegfluss nennt die Keine-Aussage");
expect(!belegfluss.includes("Typische Kandidaten"), "Belegfluss nutzt die Beispielkontrollen nicht");
expect(!belegfluss.includes("nur bestätigte Kontrollen aus Intake"), "Belegfluss behält die Platzhalterzeile nicht");

const saved = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PRICE_SETUP_ID: process.env.STRIPE_PRICE_SETUP_ID,
  STRIPE_PRICE_MONTHLY_ID: process.env.STRIPE_PRICE_MONTHLY_ID,
};
process.env.STRIPE_SECRET_KEY = "sk_test_offline_keine";
process.env.STRIPE_PRICE_SETUP_ID = "price_setup_offline";
process.env.STRIPE_PRICE_MONTHLY_ID = "price_monthly_offline";

function stripeError(fields: { code?: string; type?: string; statusCode?: number; message: string }) {
  return Object.assign(new Error(fields.message), fields);
}

async function checkStripe() {
  const missing = await resolveCheckoutSession("cs_test_missing", async () => {
    throw stripeError({
      code: "resource_missing",
      type: "StripeInvalidRequestError",
      statusCode: 404,
      message: "No such checkout.session: cs_test_missing",
    });
  });
  expect("error" in missing && missing.error === "invalid", "resource_missing ist ungültig");
  expect(intakeCheckoutStatus("invalid") === 401, "ungültige Session ergibt 401");

  const messageOnly = await resolveCheckoutSession("cs_test_nosuch", async () => {
    throw stripeError({ message: "No such checkout.session" });
  });
  expect("error" in messageOnly && messageOnly.error === "invalid", "No such checkout.session ist ungültig");

  const badId = await resolveCheckoutSession("foo", async () => {
    throw stripeError({
      type: "StripeInvalidRequestError",
      statusCode: 400,
      message: "Invalid checkout.session id: foo",
    });
  });
  expect("error" in badId && badId.error === "invalid", "ungültige Session-ID ergibt invalid");

  for (const failure of [
    stripeError({ type: "StripeConnectionError", message: "network down" }),
    stripeError({ type: "StripeAPIError", statusCode: 500, message: "upstream" }),
    stripeError({ statusCode: 429, message: "rate limit" }),
  ]) {
    const result = await resolveCheckoutSession("cs_test_down", async () => {
      throw failure;
    });
    expect("error" in result && result.error === "lookup_failed", `${failure.type ?? failure.statusCode} bleibt lookup_failed`);
    expect(intakeCheckoutStatus("lookup_failed") === 503, "Lookup-Ausfall bleibt 503");
  }
}

checkStripe()
  .catch((error) => {
    failures.push(error instanceof Error ? error.message : String(error));
  })
  .finally(() => {
    process.env.STRIPE_SECRET_KEY = saved.STRIPE_SECRET_KEY;
    process.env.STRIPE_PRICE_SETUP_ID = saved.STRIPE_PRICE_SETUP_ID;
    process.env.STRIPE_PRICE_MONTHLY_ID = saved.STRIPE_PRICE_MONTHLY_ID;
    if (failures.length) {
      console.error(failures.join("\n"));
      process.exit(1);
    }
    console.log("keine angaben ok");
  });
