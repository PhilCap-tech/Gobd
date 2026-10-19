import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

export type BlogPost = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  date: string;
  ctaSoft: string;
  ctaPrimary: string;
  status: string;
  body: string;
};

const PUBLISHABLE = "ready-for-publish";

export function blogContentDir(): string {
  return path.join(process.cwd(), "content", "blog");
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

function parseFrontmatter(raw: string): {
  fields: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { fields: {}, body: raw };
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s*-\s+/.test(line)) continue;
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const value = kv[2].trim();
    if (!value) continue;
    fields[kv[1]] = unquote(value);
  }
  return { fields, body: match[2].trim() };
}

function toPost(fileName: string, raw: string): BlogPost {
  const { fields, body } = parseFrontmatter(raw);
  const fallbackSlug = fileName.replace(/\.mdx?$/, "");
  const title = fields.title || fallbackSlug;
  const description = fields.metaDescription || fields.description || "";
  return {
    slug: fields.slug || fallbackSlug,
    title,
    h1: fields.h1 || title,
    description,
    metaTitle: fields.metaTitle || title,
    metaDescription: description,
    date: fields.date || "",
    ctaSoft: fields.ctaSoft || "/readiness",
    ctaPrimary: fields.ctaPrimary || "/",
    status: fields.status || "",
    body,
  };
}

export function formatBlogDate(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

export const listPublishedPosts = cache(async (): Promise<BlogPost[]> => {
  const dir = blogContentDir();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }

  const posts: BlogPost[] = [];
  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    const raw = await readFile(path.join(dir, file), "utf8");
    const post = toPost(file, raw);
    if (post.status === PUBLISHABLE) posts.push(post);
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return posts;
});

export const getPublishedPost = cache(
  async (slug: string): Promise<BlogPost | null> => {
    const posts = await listPublishedPosts();
    return posts.find((post) => post.slug === slug) ?? null;
  },
);
