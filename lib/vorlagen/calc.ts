/** Eingaben des Kostenrechners. In der Lead-Zeile unter calc_json, nicht im signierten Link. */

export const CALC_BODY_MAX_BYTES = 512;

export const TOOL_SETUP_EUR = 149;
export const TOOL_MONTHLY_EUR = 49;
export const DEFAULT_STB_MIN = 66;
export const DEFAULT_STB_MAX = 164;
export const DEFAULT_MONTHS = 12;
export const DEFAULT_YEARS = 1;
export const DEFAULT_ZINS_MONTHS = 0;
export const ZINS_RATE_PER_MONTH = 0.0015;

const MAX_HOURS = 100_000;
const MAX_MONEY = 1_000_000_000_000;
const MAX_COUNT = 1_200;

export const UST_RATES = [0.19, 0.07, 0] as const;
export type UstRate = (typeof UST_RATES)[number];

export type CalcSnapshot = {
  stunden_eigen: number | null;
  stundensatz_eigen: number | null;
  stunden_stb: number | null;
  satz_stb_min: number | null;
  satz_stb_max: number | null;
  monate_tool: number | null;
  hinzuschaetzung_netto: number | null;
  ust_satz: UstRate | null;
  grenzsteuersatz: number | null;
  jahre: number | null;
  zinsmonate: number | null;
  kasse: boolean;
  kleinunternehmer: boolean;
};

const NUMBER_KEYS = [
  "stunden_eigen",
  "stundensatz_eigen",
  "stunden_stb",
  "satz_stb_min",
  "satz_stb_max",
  "monate_tool",
  "hinzuschaetzung_netto",
  "grenzsteuersatz",
  "jahre",
  "zinsmonate",
] as const;

const INTEGER_KEYS = new Set<string>(["monate_tool", "jahre", "zinsmonate"]);
const ALLOWED = new Set<string>([...NUMBER_KEYS, "ust_satz", "kasse", "kleinunternehmer"]);

export function emptyCalc(): CalcSnapshot {
  return {
    stunden_eigen: null,
    stundensatz_eigen: null,
    stunden_stb: null,
    satz_stb_min: null,
    satz_stb_max: null,
    monate_tool: null,
    hinzuschaetzung_netto: null,
    ust_satz: null,
    grenzsteuersatz: null,
    jahre: null,
    zinsmonate: null,
    kasse: false,
    kleinunternehmer: false,
  };
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function maxFor(key: (typeof NUMBER_KEYS)[number]): number {
  if (key === "grenzsteuersatz") return 100;
  if (key === "stunden_eigen" || key === "stunden_stb") return MAX_HOURS;
  if (key === "monate_tool" || key === "jahre" || key === "zinsmonate") return MAX_COUNT;
  return MAX_MONEY;
}

function inRange(key: (typeof NUMBER_KEYS)[number], value: number): boolean {
  if (value < 0 || value > maxFor(key)) return false;
  if ((key === "monate_tool" || key === "jahre") && value < 1) return false;
  return true;
}

export function parseMagnetCalc(input: unknown): CalcSnapshot | null {
  if (input == null) return emptyCalc();
  let encoded = "";
  try {
    encoded = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    return null;
  }
  if (Buffer.byteLength(encoded) > CALC_BODY_MAX_BYTES) return null;
  let record: unknown = input;
  if (typeof input === "string") {
    try {
      record = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const source = record as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!ALLOWED.has(key)) return null;
  }
  const next = emptyCalc();
  for (const key of NUMBER_KEYS) {
    if (!(key in source)) continue;
    const value = finiteNumber(source[key]);
    if (value == null) return null;
    if (INTEGER_KEYS.has(key) && !Number.isInteger(value)) return null;
    if (!inRange(key, value)) return null;
    next[key] = value;
  }
  if ("ust_satz" in source) {
    const rate = source.ust_satz;
    if (rate !== 0.19 && rate !== 0.07 && rate !== 0) return null;
    next.ust_satz = rate;
  }
  if ("kasse" in source) {
    if (typeof source.kasse !== "boolean") return null;
    next.kasse = source.kasse;
  }
  if ("kleinunternehmer" in source) {
    if (typeof source.kleinunternehmer !== "boolean") return null;
    next.kleinunternehmer = source.kleinunternehmer;
  }
  if ("satz_stb_min" in source && "satz_stb_max" in source && next.satz_stb_min != null && next.satz_stb_max != null) {
    if (next.satz_stb_min > next.satz_stb_max) return null;
  }
  return next;
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

export const EURO = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const COUNT = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 2,
});

export type CalcView = {
  eigen: string;
  stb: string;
  tool: string;
  blockB: string;
  blockBDetail: string;
  assumption: string;
  scenario: boolean;
};

const EMPTY_HOURS = "Bitte Stunden eingeben";

export function viewCalc(calc: CalcSnapshot): CalcView {
  const eigenReady = calc.stunden_eigen != null && calc.stundensatz_eigen != null;
  const eigen = eigenReady
    ? `Erstellung in Eigenleistung: ${EURO.format(fromCents(cents(calc.stunden_eigen! * calc.stundensatz_eigen!)))} € (Ihre Angaben: ${COUNT.format(calc.stunden_eigen!)} Std. × ${EURO.format(calc.stundensatz_eigen!)} €).`
    : EMPTY_HOURS;
  const stbReady = calc.stunden_stb != null && calc.satz_stb_min != null && calc.satz_stb_max != null;
  const stb = stbReady
    ? `Erstellung mit Steuerberatung: ${EURO.format(fromCents(cents(calc.stunden_stb! * calc.satz_stb_min!)))} € bis ${EURO.format(fromCents(cents(calc.stunden_stb! * calc.satz_stb_max!)))} € netto (Ihre Stunden × Zeitgebühr nach § 13 StBVV; eine abweichende Vergütungsvereinbarung ist möglich).`
    : EMPTY_HOURS;
  const toolReady = calc.monate_tool != null && calc.monate_tool >= 1;
  const tool = toolReady
    ? `gobd-doku-erstellen.de: ${EURO.format(TOOL_SETUP_EUR + TOOL_MONTHLY_EUR * calc.monate_tool!)} € netto für ${COUNT.format(calc.monate_tool!)} Monate (149 € Einrichtung + 49 € pro Monat, zzgl. USt, monatlich kündbar).`
    : "Bitte geben Sie die Anzahl der Monate ein.";
  const scenario =
    calc.hinzuschaetzung_netto != null && calc.ust_satz != null && calc.grenzsteuersatz != null;
  if (!scenario) {
    return {
      eigen,
      stb,
      tool,
      blockB:
        "Sie haben kein Szenario eingegeben. Das ist in Ordnung: Eine Schätzung ist keine automatische Folge einer fehlenden Verfahrensdokumentation.",
      blockBDetail: "",
      assumption: "",
      scenario: false,
    };
  }
  const jahre = calc.jahre != null && calc.jahre >= 1 ? calc.jahre : DEFAULT_YEARS;
  const zinsmonate = calc.zinsmonate != null && calc.zinsmonate >= 0 ? calc.zinsmonate : DEFAULT_ZINS_MONTHS;
  const netto = cents(calc.hinzuschaetzung_netto!);
  const ust = Math.round(netto * calc.ust_satz!);
  const ertrag = Math.round(netto * (calc.grenzsteuersatz! / 100));
  const steuer = ust + ertrag;
  const zinsen = Math.round(steuer * ZINS_RATE_PER_MONTH * zinsmonate);
  const summe = (steuer + zinsen) * jahre;
  const jahrText = jahre === 1 ? "1 Jahr" : `${COUNT.format(jahre)} Jahre`;
  const zinsText = zinsmonate > 0 ? " und Zinsen" : "";
  return {
    eigen,
    stb,
    tool,
    blockB: `In Ihrem Szenario – ${EURO.format(calc.hinzuschaetzung_netto!)} € Mehrbetrag pro Jahr, ${jahrText} – ergäben sich rechnerisch rund ${EURO.format(fromCents(summe))} € an Umsatzsteuer, Ertragsteuer${zinsText}.`,
    blockBDetail:
      "Bitte beachten Sie: Diese Zahl beruht ausschließlich auf Ihren eigenen Annahmen. Ob es überhaupt zu einer Schätzung kommt, hängt davon ab, ob Ihre Buchführung nachvollziehbar und nachprüfbar ist (GoBD Rz. 155, §§ 158, 162 AO). Gewerbesteuer, Zuschläge und Bußgelder sind nicht berücksichtigt.",
    assumption:
      "Annahme: Der Mehrbetrag wirkt voll als zusätzlicher Gewinn; geschätzte Mehrausgaben sind nicht abgezogen. In der Praxis kann das anders sein. Solidaritätszuschlag, Kirchensteuer, Sicherheitszuschläge, die Abrundung nach § 238 Abs. 2 AO und eine tageweise Berechnung bei wechselnden Zinssätzen (§ 238 Abs. 1b AO) sind nicht berücksichtigt.",
    scenario: true,
  };
}

export const CALC_RZ155 =
  "Soweit eine fehlende oder ungenügende Verfahrensdokumentation die Nachvollziehbarkeit und Nachprüfbarkeit nicht beeinträchtigt, liegt kein formeller Mangel mit sachlichem Gewicht vor, der zum Verwerfen der Buchführung führen kann. (GoBD Rz. 155)";

export const CALC_DISCLAIMER =
  "Wichtiger Hinweis: Dieser Rechner ist eine vereinfachte Illustration und keine Prognose. Er ersetzt keine Steuer- oder Rechtsberatung. Die Ergebnisse beruhen allein auf Ihren Eingaben und vereinfachten Annahmen; sie sagen nichts darüber aus, ob in Ihrem Betrieb Mängel vorliegen oder ob und in welcher Höhe eine Finanzbehörde schätzen würde. Eine fehlende Verfahrensdokumentation führt nicht automatisch zu einer Schätzung (GoBD Rz. 155). Für Ihren Einzelfall wenden Sie sich bitte an eine Steuerberaterin oder einen Steuerberater. Stand der Rechtsgrundlagen: Oktober 2026.";

export const CALC_INTRO_B =
  "Eine fehlende Verfahrensdokumentation allein ist nach Auffassung der Finanzverwaltung kein Grund, die Buchführung zu verwerfen, solange Ihre Bücher für eine sachverständige dritte Person in angemessener Zeit nachvollziehbar und nachprüfbar sind (GoBD Rz. 155). Zu einer Schätzung kann es kommen, wenn die Finanzbehörde die Besteuerungsgrundlagen nicht ermitteln kann oder Ihre Buchführung nach § 158 Abs. 2 AO nicht zugrunde legt (§ 162 AO). Ob und in welcher Höhe geschätzt wird, hängt vom Einzelfall ab. Eine allgemeingültige Quote gibt es nicht. Die folgenden Felder sind deshalb leer – tragen Sie nur ein, was Sie selbst durchspielen möchten.";

export const CALC_WAYS_NOTE =
  "Die Wege sind nicht gleichwertig: Eine Steuerberatung prüft Ihren Einzelfall. Unser Werkzeug führt Sie mit Fragen zu einem PDF-Entwurf und einer Liste offener Punkte; die Verantwortung für Inhalt und Umsetzung bleibt bei Ihnen (vgl. GoBD Rz. 21).";

export const CALC_KASSE_HINT =
  "Bei einer Kassen-Nachschau kann die Amtsperson die Verfahrensdokumentation zum Kassensystem einschließlich der Informationen zur TSE anfordern. Können Dokumentationsunterlagen nicht vorgelegt werden, kann das Anlass zur Beanstandung sein; ein Übergang zur Außenprüfung liegt im Ermessen der Behörde.";

export const CALC_KLEIN_HINT =
  "Bei kleinen Unternehmen sollen die Anforderungen regelmäßig auch mit Blick auf die Unternehmensgröße bewertet werden (GoBD Rz. 15). Eine Verfahrensdokumentation kann entsprechend schlanker ausfallen.";

export const CALC_ALWAYS_HINT =
  "Die Verfahrensdokumentation muss dem tatsächlich gelebten Verfahren entsprechen und Änderungen nachvollziehbar versioniert sein.";

export const CALC_INTERPRETATION =
  "Auslegung, kein Rechenposten: Ob eine konkrete Verfahrensdokumentation zu den „Arbeitsanweisungen und sonstigen Organisationsunterlagen“ im Sinne von § 147 Abs. 1 Nr. 1 AO zählt (und damit theoretisch unter § 379 Abs. 1 Nr. 7 AO fallen könnte), sagt das Gesetz nicht ausdrücklich. Die GoBD verknüpfen die Aufbewahrung der Verfahrensdokumentation mit den Unterlagen, zu deren Verständnis sie nötig ist (Rz. 154).";

export const CALC_ABSCHLUSS =
  "Eine Verfahrensdokumentation hilft vor allem dabei, Ihre Abläufe für Dritte verständlich zu machen – etwa bei einer Außenprüfung oder einem Wechsel in Ihrem Team. Wie umfangreich sie sein muss, hängt von Größe und Komplexität Ihres Betriebs ab (GoBD Rz. 151).";

export const CALC_STB_HINT =
  "Annahme: Abrechnung nach Zeitgebühr (§ 13 Satz 2 StBVV: 16,50 bis 41 Euro je angefangene viertel Stunde, hier als 66 bis 164 Euro je Stunde). Ob das gilt oder eine Vergütungsvereinbarung nach § 4 StBVV, hängt vom Auftrag ab. Die Sätze können Sie ändern.";

export const CALC_ZINS_HINT =
  "Der Zinslauf beginnt grundsätzlich 15 Monate nach Ablauf des Jahres, in dem die Steuer entstanden ist.";

export const CALC_GRENZ_HINT = "Fragen Sie im Zweifel Ihre Steuerberatung.";

export const CALC_RESULT_TITLE = "Ihre Übersicht – eine Illustration auf Basis Ihrer Eingaben";
