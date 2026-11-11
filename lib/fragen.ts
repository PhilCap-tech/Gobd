import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import {
  FRAGEN_GRUPPEN,
  FRAGEN_KURZLINKS,
  FRAGEN_WELLE1_NR,
  type FragenGruppeKey,
} from "@/lib/fragen-katalog";

export const FRAGEN_INDEX_PATH = "/fragen";
export const FRAGEN_INDEX_H1 = "Fragen zu GoBD und Verfahrensdokumentation";
export const FRAGEN_INDEX_INTRO =
  "Hier beantworten wir häufige Fragen zu den GoBD und zur Verfahrensdokumentation, kurz und mit Verweisen auf ausführliche Beiträge. Die Antworten sind allgemeine Arbeitshilfen und ersetzen keine Steuerberatung.";

/** Friseur-Fassung, verbatim, directly under the H1 in every Welle-1 body. */
export const FRAGEN_DISCLAIMER =
  "> **Keine Steuerberatung.** Dieser Text ist eine allgemeine Arbeitshilfe. Welche Pflichten in Ihrem Fall gelten, klären Sie bitte mit Ihrer Steuerberatung.";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STAND = /^\d{4}-\d{2}-\d{2}$/;
const GRUPPE_KEYS = new Set<string>(FRAGEN_GRUPPEN.map((group) => group.key));

export type FragenQuelle = {
  label: string;
  href: string;
};

export type FragenSeite = {
  slug: string;
  frage: string;
  route: string;
  gruppe: FragenGruppeKey;
  welle: 1;
  stand: string;
  kurzantwort: string;
  interneLinks: string[];
  quellen: FragenQuelle[];
  /** Repo-relative markdown path. */
  sourceFile: string;
  body: string;
};

export type FragenIndexEintrag = {
  nr: number;
  gruppe: FragenGruppeKey;
  frage: string;
  slug: string;
  href: string;
  moreHrefs: readonly string[];
  /** Null when the catalog row has no kurzantwort. */
  kurzantwort: string | null;
  stand: string | null;
};

type FieldValue = string | string[];

function fail(message: string): never {
  throw new Error(`fragen: ${message}`);
}

export function fragenContentDir(): string {
  return path.join(process.cwd(), "content", "fragen");
}

export function fragenPath(slug: string): string {
  return `/fragen/${slug}`;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
  }
  return trimmed;
}

function parseFrontmatter(raw: string, file: string): {
  fields: Record<string, FieldValue>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) fail(`${file}: Frontmatter fehlt`);
  const fields: Record<string, FieldValue> = {};
  let listKey: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item) {
      if (!listKey) fail(`${file}: Listenpunkt ohne Schlüssel`);
      const list = fields[listKey];
      if (!Array.isArray(list)) fail(`${file}: ${listKey} ist keine Liste`);
      list.push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) fail(`${file}: Frontmatter-Zeile unlesbar: ${line.trim()}`);
    if (kv[1] in fields) fail(`${file}: ${kv[1]} doppelt`);
    const value = kv[2].trim();
    if (!value) {
      fields[kv[1]] = [];
      listKey = kv[1];
      continue;
    }
    if (value === "[]") {
      fields[kv[1]] = [];
      listKey = null;
      continue;
    }
    listKey = null;
    fields[kv[1]] = unquote(value);
  }
  return { fields, body: match[2].trim() };
}

function asString(fields: Record<string, FieldValue>, key: string, file: string): string {
  const value = fields[key];
  if (typeof value !== "string" || !value.trim()) fail(`${file}: ${key} fehlt`);
  return value.trim();
}

function asStringList(fields: Record<string, FieldValue>, key: string, file: string): string[] {
  const value = fields[key];
  if (!Array.isArray(value)) fail(`${file}: ${key} muss eine Liste sein`);
  if (value.some((item) => !item.trim())) fail(`${file}: ${key} enthält einen leeren Eintrag`);
  return value;
}

function parseQuelle(raw: string, file: string): FragenQuelle {
  const parts = raw.split(" — ");
  if (parts.length !== 2) fail(`${file}: Quelle ohne Kurzform und URL: ${raw}`);
  const label = parts[0].trim();
  const href = parts[1].trim();
  if (!label || !/^https?:\/\//.test(href)) fail(`${file}: Quelle unlesbar: ${raw}`);
  return { label, href };
}

function toSeite(fileName: string, raw: string): FragenSeite {
  const { fields, body } = parseFrontmatter(raw, fileName);
  const slug = asString(fields, "slug", fileName);
  const stem = fileName.replace(/\.mdx?$/, "");
  if (!SLUG.test(slug)) fail(`${fileName}: slug „${slug}“ ist ungültig`);
  if (slug !== stem) fail(`${fileName}: slug „${slug}“ weicht vom Dateinamen ab`);
  if (!(slug in FRAGEN_WELLE1_NR)) fail(`${fileName}: slug gehört nicht zur ersten Welle`);

  const frage = asString(fields, "frage", fileName);
  const route = fragenPath(slug);
  const declared = asString(fields, "url", fileName);
  if (declared !== route) fail(`${fileName}: url „${declared}“ passt nicht zu ${route}`);

  const gruppe = asString(fields, "gruppe", fileName);
  if (!GRUPPE_KEYS.has(gruppe)) fail(`${fileName}: gruppe „${gruppe}“ ist unbekannt`);

  if (asString(fields, "welle", fileName) !== "1") fail(`${fileName}: nur Welle 1 wird veröffentlicht`);
  const stand = asString(fields, "stand", fileName);
  if (!STAND.test(stand)) fail(`${fileName}: stand muss ein ISO-Datum sein`);

  const kurzantwort = asString(fields, "kurzantwort", fileName);
  if (kurzantwort.includes("# intern")) fail(`${fileName}: Kurzantwort enthält einen internen Kommentar`);
  const firstLine = body.split(/\r?\n/, 1)[0];
  if (firstLine !== `# ${frage}`) fail(`${fileName}: die erste Zeile muss die Frage als H1 sein`);
  if (!body.includes(FRAGEN_DISCLAIMER)) fail(`${fileName}: der Disclaimer fehlt`);
  if (body.includes("# intern:")) fail(`${fileName}: ein interner Kommentar steht im Text`);

  return {
    slug,
    frage,
    route,
    gruppe: gruppe as FragenGruppeKey,
    welle: 1,
    stand,
    kurzantwort,
    interneLinks: asStringList(fields, "interneLinks", fileName),
    quellen: asStringList(fields, "quellen", fileName).map((item) => parseQuelle(item, fileName)),
    sourceFile: `content/fragen/${fileName}`,
    body,
  };
}

/**
 * Meta description taken from existing words.
 * Text of up to 160 characters stays as written. Longer text keeps the
 * longest exact prefix that ends on a sentence boundary within 160
 * characters, otherwise the longest word prefix within 155 characters.
 */
export function exactMetaDescription(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) return normalized;
  const ends: number[] = [];
  const re = /[.!?](?=\s+[A-ZÄÖÜ])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    const before = match.index > 0 ? normalized[match.index - 1] : "";
    if (before >= "0" && before <= "9") continue;
    ends.push(match.index + 1);
  }
  let best = "";
  for (const end of ends) {
    const prefix = normalized.slice(0, end).trim();
    if (prefix.length >= 80 && prefix.length <= 160 && normalized.startsWith(prefix)) best = prefix;
  }
  if (best) return best;
  const window = normalized.slice(0, 155);
  const space = window.lastIndexOf(" ");
  const cut = (space >= 80 ? window.slice(0, space) : window).trim();
  if (!normalized.startsWith(cut)) fail("Meta-Beschreibung ist kein Präfix des Ausgangstextes");
  return cut;
}

/**
 * BlogMarkdown drops the lines after a heading when the blank line is missing.
 * Insert it at render time. The markdown files stay as written.
 */
export function fragenBodyForMarkdown(body: string): string {
  return body.replace(/^(#{1,6}[ \t]+.+)\n(?!\n)/gm, "$1\n\n");
}

const STATIC_ZIEL_LABELS: Record<string, string> = {
  "/kassen-check": "Kassen- und TSE-Meldecheck",
  "/steuerberater": "Kostenloser Kanzleizugang",
};

/** Visible label for an existing page. Falls back to the path when unknown. */
export function fragenZielLabel(
  href: string,
  blogTitles: ReadonlyMap<string, string>,
  branchenLabels: ReadonlyMap<string, string>,
): string {
  if (STATIC_ZIEL_LABELS[href]) return STATIC_ZIEL_LABELS[href];
  if (href.startsWith("/blog/")) {
    const title = blogTitles.get(href.slice("/blog/".length));
    if (title) return title;
  }
  return branchenLabels.get(href) ?? href;
}

export const listFragenSeiten = cache(async (): Promise<FragenSeite[]> => {
  const dir = fragenContentDir();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") fail("content/fragen fehlt");
    throw error;
  }

  const seiten: FragenSeite[] = [];
  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    const raw = await readFile(path.join(dir, file), "utf8");
    seiten.push(toSeite(file, raw));
  }

  const expected = Object.keys(FRAGEN_WELLE1_NR);
  if (seiten.length !== expected.length) {
    fail(`erwartet ${expected.length} Seiten, gefunden ${seiten.length}`);
  }
  for (const slug of expected) {
    if (!seiten.some((seite) => seite.slug === slug)) fail(`content/fragen/${slug}.md fehlt`);
  }
  const slugs = new Set<string>();
  for (const seite of seiten) {
    if (slugs.has(seite.slug)) fail(`slug doppelt: ${seite.slug}`);
    slugs.add(seite.slug);
    for (const link of seite.interneLinks) {
      if (!link.startsWith("/fragen/")) continue;
      const target = link.slice("/fragen/".length);
      if (!(target in FRAGEN_WELLE1_NR)) {
        fail(`${seite.slug}: verlinkt eine Seite außerhalb der ersten Welle (${link})`);
      }
    }
  }

  seiten.sort((a, b) => FRAGEN_WELLE1_NR[a.slug] - FRAGEN_WELLE1_NR[b.slug]);
  return seiten;
});

export const getFragenSeite = cache(async (slug: string): Promise<FragenSeite | null> => {
  const seiten = await listFragenSeiten();
  return seiten.find((seite) => seite.slug === slug) ?? null;
});

export function latestFragenStand(seiten: FragenSeite[]): string {
  return seiten.reduce((latest, seite) => (seite.stand > latest ? seite.stand : latest), "");
}

export async function listFragenIndex(): Promise<FragenIndexEintrag[]> {
  const seiten = await listFragenSeiten();
  const fromSeiten: FragenIndexEintrag[] = seiten.map((seite) => ({
    nr: FRAGEN_WELLE1_NR[seite.slug],
    gruppe: seite.gruppe,
    frage: seite.frage,
    slug: seite.slug,
    href: seite.route,
    moreHrefs: [],
    kurzantwort: seite.kurzantwort,
    stand: seite.stand,
  }));
  const fromLinks: FragenIndexEintrag[] = FRAGEN_KURZLINKS.map((row) => {
    if (row.hrefs.length === 0) fail(`${row.slug}: kurz+link ohne Ziel`);
    return {
      nr: row.nr,
      gruppe: row.gruppe,
      frage: row.frage,
      slug: row.slug,
      href: row.hrefs[0],
      moreHrefs: row.hrefs.slice(1),
      kurzantwort: null,
      stand: null,
    };
  });
  const entries = [...fromSeiten, ...fromLinks].sort((a, b) => a.nr - b.nr);
  const numbers = new Set<number>();
  for (const entry of entries) {
    if (numbers.has(entry.nr)) fail(`Katalognummer doppelt: ${entry.nr}`);
    numbers.add(entry.nr);
  }
  return entries;
}

export function groupFragenIndex(entries: FragenIndexEintrag[]): {
  key: FragenGruppeKey;
  title: string;
  entries: FragenIndexEintrag[];
}[] {
  return FRAGEN_GRUPPEN.map((group) => ({
    key: group.key,
    title: group.title,
    entries: entries.filter((entry) => entry.gruppe === group.key),
  })).filter((group) => group.entries.length > 0);
}
