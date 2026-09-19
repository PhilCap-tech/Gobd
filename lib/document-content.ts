import { renderDeliveryDocument } from "@/lib/delivery-templates";
import type { DeliveryDocumentContent } from "@/lib/delivery";
import { parseDocumentVersion } from "@/lib/documents";
import {
  answersFromSheetRow,
  identityFromSheetRow,
  type SheetRow,
} from "@/lib/types";

/** Stay under Google Sheets' 50k cell limit. */
export const CHAPTER_CONTENT_MAX_CHARS = 45_000;
const MAX_CHAPTERS = 20;
const MAX_ID_LEN = 80;
const MAX_TITLE_LEN = 200;
const MAX_BODY_LEN = 20_000;
const MAX_COVER_LEN = 8_000;

export type DocumentChapter = DeliveryDocumentContent["chapters"][number];

export type EditableDocument = {
  cover: string;
  chapters: DocumentChapter[];
  disclaimer: string;
};

function asTrimmedString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

export function parseDocumentContent(
  raw: string | undefined | null,
): DeliveryDocumentContent | null {
  const text = raw?.trim() ?? "";
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return normalizeDocumentContent(parsed);
  } catch {
    return null;
  }
}

export function normalizeDocumentContent(
  value: unknown,
): DeliveryDocumentContent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as {
    cover?: unknown;
    chapters?: unknown;
  };
  if (!Array.isArray(record.chapters)) return null;

  const chapters = record.chapters
    .slice(0, MAX_CHAPTERS)
    .map((item, index): DocumentChapter | null => {
      if (!item || typeof item !== "object") return null;
      const chapter = item as {
        id?: unknown;
        title?: unknown;
        body?: unknown;
      };
      const body = asTrimmedString(chapter.body, MAX_BODY_LEN);
      const title = asTrimmedString(chapter.title, MAX_TITLE_LEN);
      const id =
        asTrimmedString(chapter.id, MAX_ID_LEN).replace(/[^A-Za-z0-9._-]/g, "") ||
        `kapitel-${index + 1}`;
      if (!body.trim() && !title.trim()) return null;
      return { id, title: title || id, body };
    })
    .filter((chapter): chapter is DocumentChapter => Boolean(chapter));

  if (chapters.length === 0) return null;

  return {
    cover: asTrimmedString(record.cover, MAX_COVER_LEN),
    chapters,
  };
}

export function serializeDocumentContent(
  content: DeliveryDocumentContent,
): string {
  const normalized = normalizeDocumentContent(content);
  if (!normalized) {
    throw new Error("Kapiteltext fehlt oder ist ungültig.");
  }
  const json = JSON.stringify({
    cover: normalized.cover ?? "",
    chapters: normalized.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      body: chapter.body,
    })),
  });
  if (json.length > CHAPTER_CONTENT_MAX_CHARS) {
    throw new Error(
      "Der Dokumenttext ist zu lang. Bitte kürzen und erneut speichern.",
    );
  }
  return json;
}

export function editableDocumentFromRow(row: SheetRow): EditableDocument {
  const stored = parseDocumentContent(row.chapterContent);
  const rendered = renderDeliveryDocument({
    identity: identityFromSheetRow(row),
    answers: answersFromSheetRow(row),
    documentId: row.documentId || "edit",
    version: parseDocumentVersion(row),
  });

  if (stored) {
    return {
      cover: stored.cover?.trim() ? stored.cover : rendered.cover,
      chapters: stored.chapters,
      disclaimer: rendered.disclaimer,
    };
  }

  return {
    cover: rendered.cover,
    chapters: rendered.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      body: chapter.body,
    })),
    disclaimer: rendered.disclaimer,
  };
}
