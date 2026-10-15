import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { listPublishedPosts } from "@/lib/blog";
import { markdownToPlain } from "@/lib/markdown-section";
import type { FaqEntry } from "@/lib/faq-entries";
import { isMusterVorlage, type MusterVorlageId } from "@/lib/module-muster";
import {
  branchenContentDir,
  branchenPath,
  listBranchenRoutes,
} from "@/lib/branchen-routes";

export type { MusterVorlageId };
export { branchenPath };

export type BranchenSeite = {
  slug: string;
  branche: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  musterVorlage: MusterVorlageId;
  readinessBranche?: string;
  noindex: boolean;
  stand: string;
  quellen: string[];
  status: "draft" | "ready-for-publish";
  /** Internal targets from the content file. Not rendered as labels. */
  ctaSoft: string;
  ctaPrimary: string;
  route: string;
  body: string;
};

export const BRANCHEN_SLUGS = ["friseure", "einzelhandel"] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STAND = /^\d{4}-\d{2}-\d{2}$/;

type FieldValue = string | boolean | string[];

function fail(message: string): never {
  throw new Error(`branchen: ${message}`);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(raw: string): string | boolean {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
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
    if (!line.trim()) continue;
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
    listKey = null;
    fields[kv[1]] = parseScalar(value);
  }
  return { fields, body: match[2].trim() };
}

function asString(
  fields: Record<string, FieldValue>,
  key: string,
  file: string,
): string {
  const value = fields[key];
  if (typeof value !== "string" || !value.trim()) {
    fail(`${file}: ${key} fehlt`);
  }
  return value.trim();
}

function asStringList(
  fields: Record<string, FieldValue>,
  key: string,
  file: string,
): string[] {
  const value = fields[key];
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${file}: ${key} muss eine nicht leere Liste sein`);
  }
  if (value.some((item) => !item.trim())) {
    fail(`${file}: ${key} enthält einen leeren Eintrag`);
  }
  return value;
}

function toSeite(fileName: string, raw: string): BranchenSeite | null {
  const { fields, body } = parseFrontmatter(raw, fileName);
  if (fields.status === "internal-note") return null;
  const slug = asString(fields, "slug", fileName);
  const stem = fileName.replace(/\.mdx?$/, "");
  if (!SLUG.test(slug)) fail(`${fileName}: slug „${slug}“ ist ungültig`);
  if (slug !== stem) fail(`${fileName}: slug „${slug}“ weicht vom Dateinamen ab`);

  const h1 = asString(fields, "h1", fileName);
  const firstLine = body.split(/\r?\n/, 1)[0];
  if (firstLine !== `# ${h1}`) {
    fail(`${fileName}: die erste Zeile muss die H1 aus dem Frontmatter sein`);
  }

  const musterVorlage = asString(fields, "musterVorlage", fileName);
  if (!isMusterVorlage(musterVorlage)) {
    fail(`${fileName}: musterVorlage „${musterVorlage}“ ist keine Muster-Vorlage`);
  }

  const readinessRaw = fields.readinessBranche;
  let readinessBranche: string | undefined;
  if (readinessRaw !== undefined) {
    if (typeof readinessRaw !== "string" || !SLUG.test(readinessRaw)) {
      fail(`${fileName}: readinessBranche ist ungültig`);
    }
    const readinessFile = path.join(
      process.cwd(),
      "content",
      "readiness",
      `${readinessRaw}.md`,
    );
    if (!existsSync(readinessFile)) {
      fail(`${fileName}: content/readiness/${readinessRaw}.md fehlt`);
    }
    readinessBranche = readinessRaw;
  }

  if (typeof fields.noindex !== "boolean") {
    fail(`${fileName}: noindex muss true oder false sein`);
  }
  const stand = asString(fields, "stand", fileName);
  if (!STAND.test(stand)) fail(`${fileName}: stand muss ein ISO-Datum sein`);

  const status = asString(fields, "status", fileName);
  if (status !== "draft" && status !== "ready-for-publish") {
    fail(`${fileName}: status „${status}“ ist ungültig`);
  }

  const route = branchenPath(slug);
  const declaredRoute = fields.route;
  if (declaredRoute !== undefined && declaredRoute !== route) {
    fail(`${fileName}: route „${String(declaredRoute)}“ passt nicht zu ${route}`);
  }

  return {
    slug,
    branche: asString(fields, "branche", fileName),
    metaTitle: asString(fields, "metaTitle", fileName),
    metaDescription: asString(fields, "metaDescription", fileName),
    h1,
    primaryKeyword: asString(fields, "primaryKeyword", fileName),
    secondaryKeywords: asStringList(fields, "secondaryKeywords", fileName),
    musterVorlage,
    ...(readinessBranche ? { readinessBranche } : {}),
    noindex: fields.noindex,
    stand,
    quellen: asStringList(fields, "quellen", fileName),
    status,
    ctaSoft: typeof fields.ctaSoft === "string" ? fields.ctaSoft : "/readiness",
    ctaPrimary: typeof fields.ctaPrimary === "string" ? fields.ctaPrimary : "/",
    route,
    body,
  };
}

async function assertBlogLinks(seite: BranchenSeite, published: Set<string>) {
  for (const match of seite.body.matchAll(/\/blog\/([a-z0-9-]+)/g)) {
    const linked = match[1];
    if (!published.has(linked)) {
      fail(
        `${seite.slug}: Blog-Link /blog/${linked} ist nicht veröffentlicht`,
      );
    }
  }
}

export const listBranchenSeiten = cache(async (): Promise<BranchenSeite[]> => {
  const dir = branchenContentDir();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") fail("content/branchen fehlt");
    throw error;
  }

  const seiten: BranchenSeite[] = [];
  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    const raw = await readFile(path.join(dir, file), "utf8");
    const seite = toSeite(file, raw);
    if (seite) seiten.push(seite);
  }
  seiten.sort((a, b) => a.slug.localeCompare(b.slug, "de"));

  for (const slug of BRANCHEN_SLUGS) {
    if (!seiten.some((seite) => seite.slug === slug)) {
      fail(`content/branchen/${slug}.md fehlt`);
    }
  }

  const published = new Set(
    (await listPublishedPosts()).map((post) => post.slug),
  );
  for (const seite of seiten) {
    await assertBlogLinks(seite, published);
  }

  const routed = new Set(listBranchenRoutes().map((route) => route.slug));
  for (const seite of seiten) {
    if (!routed.has(seite.slug)) {
      fail(`${seite.slug}: Route fehlt in der öffentlichen Pfadliste`);
    }
  }
  return seiten;
});

export const getBranchenSeite = cache(
  async (slug: string): Promise<BranchenSeite | null> => {
    const seiten = await listBranchenSeiten();
    return seiten.find((seite) => seite.slug === slug) ?? null;
  },
);

/**
 * BlogMarkdown keeps a heading and the following lines in one block when no
 * blank line separates them, and then prints only the heading. The branch
 * files put the FAQ answer and the Weiterlesen list on the next line.
 * Insert the missing blank line at render time; the content files stay as written.
 */
export function branchenBodyForMarkdown(body: string): string {
  return body.replace(/^(#{1,6}[ \t]+.+)\n(?!\n)/gm, "$1\n\n");
}

/** FAQ H3s under „Häufige Fragen“, without the closing disclaimer quote. */
export function branchenFaq(body: string): FaqEntry[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## Häufige Fragen");
  if (start < 0) return [];
  const entries: FaqEntry[] = [];
  let question = "";
  let answer: string[] = [];
  const flush = () => {
    const text = markdownToPlain(answer.join("\n"));
    if (question && text) entries.push({ question, answer: text });
    question = "";
    answer = [];
  };
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) break;
    if (line.startsWith("### ")) {
      flush();
      question = line.slice(4).trim();
      continue;
    }
    if (line.trim().startsWith(">")) continue;
    if (question) answer.push(line);
  }
  flush();
  return entries;
}
