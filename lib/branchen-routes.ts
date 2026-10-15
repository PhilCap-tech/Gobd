import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Public URL. Next.js has no partial dynamic segment, so the page lives at `/branchen/[slug]`. */
export function branchenPath(slug: string): string {
  return `/verfahrensdokumentation-${slug}`;
}

/** Internal App Router path. Direct hits redirect to `branchenPath`. */
export function branchenInternalPath(slug: string): string {
  return `/branchen/${slug}`;
}

export function branchenContentDir(): string {
  return path.join(process.cwd(), "content", "branchen");
}

export type BranchenRoute = {
  slug: string;
  noindex: boolean;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Sync list for `next.config` (rewrites, redirect, X-Robots-Tag).
 * Skips internal notes. Full field validation lives in `lib/branchen.ts`.
 */
export function listBranchenRoutes(): BranchenRoute[] {
  const dir = branchenContentDir();
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }

  const routes: BranchenRoute[] = [];
  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    const raw = readFileSync(path.join(dir, file), "utf8");
    const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const head = frontmatter?.[1] ?? "";
    if (/^status:\s*["']?internal-note["']?\s*$/m.test(head)) continue;
    const slug = file.replace(/\.mdx?$/, "");
    if (!SLUG.test(slug)) {
      throw new Error(`branchen: Dateiname ist kein Slug: ${file}`);
    }
    routes.push({
      slug,
      noindex: /^noindex:\s*true\s*$/m.test(head),
    });
  }
  routes.sort((a, b) => a.slug.localeCompare(b.slug, "de"));
  return routes;
}
