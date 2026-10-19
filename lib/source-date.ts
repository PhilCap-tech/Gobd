import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const gitCache = new Map<string, string | null>();

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value);
}

/** `YYYY-MM-DD` of the last commit that touched `relativePath`, or null. */
export function gitCommitDate(relativePath: string): string | null {
  const key = relativePath.split(path.sep).join("/");
  if (gitCache.has(key)) return gitCache.get(key) ?? null;
  let value: string | null = null;
  try {
    const output = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", key],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    if (ISO_DATE.test(output)) value = output;
  } catch {
    value = null;
  }
  gitCache.set(key, value);
  return value;
}

function mtimeDate(relativePath: string): string {
  const mtime = statSync(path.join(process.cwd(), relativePath)).mtime;
  return mtime.toISOString().slice(0, 10);
}

/**
 * Sitemap lastmod for one source file.
 * A frontmatter `date` or `stand` wins. Otherwise the file's last commit.
 * File mtime is only the fallback when this build cannot see a commit
 * (no git, or the path was never committed).
 */
export function sourceLastmod(relativePath: string, frontmatter?: string): string {
  if (frontmatter && isIsoDate(frontmatter)) return frontmatter;
  return gitCommitDate(relativePath) ?? mtimeDate(relativePath);
}

/**
 * Article `dateModified`. An explicit frontmatter value wins.
 * Otherwise the file's last commit, unless that commit is older than
 * `datePublished` — then the publication date.
 */
export function articleDateModified(
  datePublished: string,
  dateModified: string | undefined,
  sourceFile: string,
): string {
  if (dateModified && isIsoDate(dateModified)) return dateModified;
  const git = gitCommitDate(sourceFile);
  if (git && (!isIsoDate(datePublished) || git >= datePublished)) return git;
  if (isIsoDate(datePublished)) return datePublished;
  return git ?? "";
}
