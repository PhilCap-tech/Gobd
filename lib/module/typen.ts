/**
 * Typen des Modulkatalogs (komplette Verfahrensdokumentation in 24 Modulen).
 * Konzept: gobd-ops/product/24-module-konzept.md
 */
import type {
  BereichField,
  BereichFrist,
  BereichKontrolle,
  BereichQuestion,
  BereichSchritt,
} from "@/lib/bereiche";

/** Vier Teile nach GoBD Rz. 153. */
export type ModulTeil = 1 | 2 | 3 | 4;

/** kern: immer aktiv · regel: standardmäßig aktiv · betrieb: vom Betriebs-Check aktiviert. */
export type ModulTyp = "kern" | "regel" | "betrieb";

export type ModulStatus = "tool" | "extern" | "offen" | "nicht_vorhanden";

export const MODUL_STATUSES: ModulStatus[] = ["tool", "extern", "offen", "nicht_vorhanden"];

export const CHECK_KEYS = [
  "bargeld",
  "lager",
  "personal",
  "zeiterfassung",
  "online",
  "retouren",
  "papier",
  "erechnung",
  "anlagen",
  "kanzlei",
  "branche",
  "zahlungsdienstleister",
] as const;

export type CheckKey = (typeof CHECK_KEYS)[number];
export type CheckAntwort = "ja" | "nein" | "unbekannt";

export type ModulEintrag = {
  status: ModulStatus;
  /** Begründung bei „nicht vorhanden“. */
  reason?: string;
  /** Verweis auf bestehende Dokumentation (Pflicht bei „extern“). */
  ref?: string;
  /** Link oder Ablageort der bestehenden Dokumentation. */
  link?: string;
};

export type Stammdaten = {
  gf?: string;
  buchhaltung?: string;
  it?: string;
  kanzlei?: string;
  fibu?: string;
  archiv?: string;
  kasse?: string;
  shop?: string;
  lohn?: string;
  warenwirtschaft?: string;
  bank?: string;
};

/** Gesamtdokument-Zustand. Vorhanden = Dokument im 24-Module-Format. */
export type ModulZustand = {
  version: 1;
  check: Partial<Record<CheckKey, CheckAntwort>>;
  /** Art der branchenspezifischen Abläufe (Modul 14). */
  branchenArt?: string[];
  /** Gewählte Branchenvorlage. */
  vorlage?: string;
  /** Gewählte Software-Vorlagen. */
  software?: string[];
  stammdaten?: Stammdaten;
  /** Ausdrücklich gesetzter Status je Modul; sonst gilt der abgeleitete Status. */
  status: Record<string, ModulEintrag>;
};

export type ModulGruppe = {
  /** Abschnittstitel im Kapitel. */
  titel: string;
  /** Fragen aus einem bisherigen Bereich (lib/bereiche.ts). */
  bereich?: string;
  /** Teilmenge der Bereichsfragen; ohne Angabe alle spezifischen Fragen + Rahmen 91/92. */
  ids?: string[];
  /** Eigene Fragen des Moduls. */
  questions?: BereichQuestion[];
  /** Nur wenn diese Betriebs-Check-Antwort nicht „nein“ ist. */
  teil?: CheckKey;
  /** Gliederung der Fragen im PDF. */
  sections?: Array<{ title: string; hinweis?: string; questions: string[] }>;
};

export type ModulDef = {
  id: string;
  nr: number;
  titel: string;
  kurz: string;
  /** Was das Modul beschreibt (Gegenstand, aus dem Expertenmaßstab). */
  inhalt: string[];
  teil: ModulTeil;
  typ: ModulTyp;
  /** Betriebs-Check-Frage, die das Modul aktiviert (nur typ „betrieb“). */
  trigger?: CheckKey;
  /** Fragen aus dem bestehenden Katalog (Schritte A–I). */
  catalogIds: string[];
  /** Abschnitte aus dem Belegfluss-Dokument (Kapitel.Abschnitt, z. B. "05.1"). */
  vorlagen: string[];
  gruppen: ModulGruppe[];
  /** Allgemeiner Hinweis (Rechtslage, keine betriebliche Aussage). */
  hinweis?: string;
  prozess?: BereichSchritt[];
  kontrollen?: BereichKontrolle[];
  aufbewahrung?: BereichFrist[];
  begriffe?: Array<[string, string]>;
};

export type { BereichField, BereichQuestion };
