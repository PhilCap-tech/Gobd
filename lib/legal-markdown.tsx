import type { ReactNode } from "react";
import { LEGAL_OPERATOR } from "@/lib/legal";

const OTHER_EMAILS =
  /\b[\w.+-]+@(?:deutsche-erben\.de|mysugardaddy\.eu|gmx\.de)\b/gi;

const INTERNAL_LINKS: Record<string, string> = {
  "Cookie-/Tracking-Hinweis": "/cookies",
  Datenschutzerklärung: "/datenschutz",
  "AGB / Nutzungsbedingungen": "/agb",
};

export function cleanLegalMarkdown(source: string): string {
  return source
    .replace(/^(?:>.*\n)+/m, "")
    .replace(/^---\s*\n/, "")
    .replace(OTHER_EMAILS, LEGAL_OPERATOR.email)
    .replace(
      /\*\*Stand:\*\* TODO: Datum der Veröffentlichung/g,
      "**Stand:** 19. September 2026",
    )
    .trim();
}

function extractTitle(markdown: string): { title: string; body: string } {
  const match = markdown.match(/^#\s+(.+)\n+([\s\S]*)$/);
  if (!match) return { title: "", body: markdown };
  return { title: match[1].trim(), body: match[2].trim() };
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const token =
    /(\*\*[^*]+?\*\*|https?:\/\/[^\s<]+|\b[\w.+-]+@gobd-doku-erstellen\.de\b)/g;
  let last = 0;
  let part = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const raw = match[0];
    const key = `${keyPrefix}-${part++}`;
    if (raw.startsWith("**") && raw.endsWith("**")) {
      const inner = raw.slice(2, -2);
      const href = INTERNAL_LINKS[inner];
      nodes.push(
        href ? (
          <a key={key} href={href}>
            {inner}
          </a>
        ) : (
          <strong key={key}>{inner}</strong>
        ),
      );
    } else if (raw.includes("@")) {
      nodes.push(
        <a key={key} href={`mailto:${raw}`}>
          {raw}
        </a>,
      );
    } else {
      nodes.push(
        <a key={key} href={raw} rel="noreferrer">
          {raw}
        </a>,
      );
    }
    last = match.index + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderLinesWithBreaks(text: string, key: string): ReactNode[] {
  const lines = text.split(/\n/);
  const nodes: ReactNode[] = [];
  lines.forEach((line, index) => {
    const cleaned = line.replace(/ {2}$/, "");
    nodes.push(...renderInline(cleaned, `${key}-${index}`));
    if (index < lines.length - 1) {
      nodes.push(<br key={`${key}-br-${index}`} />);
    }
  });
  return nodes;
}

function isTableBlock(block: string): boolean {
  return block.split("\n").every((line) => line.trim().startsWith("|"));
}

function isListBlock(block: string): boolean {
  return block.split("\n").every((line) => /^-\s+/.test(line));
}

function renderTable(block: string, key: string): ReactNode {
  const rows = block
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
  if (rows.length === 0) return null;
  const [header, ...body] = rows;
  return (
    <div key={key} className="legal-table-wrap">
      <table>
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={`${key}-h-${i}`}>{renderInline(cell, `${key}-h-${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={`${key}-r-${r}`}>
              {row.map((cell, c) => (
                <td key={`${key}-r-${r}-c-${c}`}>
                  {renderInline(cell, `${key}-r-${r}-c-${c}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderList(lines: string[], key: string): ReactNode {
  return (
    <ul key={key} className="prose-list">
      {lines.map((line, i) => (
        <li key={`${key}-${i}`}>
          {renderInline(line.replace(/^-\s+/, ""), `${key}-${i}`)}
        </li>
      ))}
    </ul>
  );
}

function renderMixedBlock(block: string, key: string): ReactNode[] {
  const lines = block.split("\n");
  const nodes: ReactNode[] = [];
  let buffer: string[] = [];
  let list: string[] = [];
  let part = 0;

  const flushParagraph = () => {
    if (!buffer.length) return;
    nodes.push(
      <p key={`${key}-p-${part++}`} className="prose">
        {renderLinesWithBreaks(buffer.join("\n"), `${key}-p-${part}`)}
      </p>,
    );
    buffer = [];
  };
  const flushList = () => {
    if (!list.length) return;
    nodes.push(renderList(list, `${key}-ul-${part++}`));
    list = [];
  };

  for (const line of lines) {
    if (/^-\s+/.test(line)) {
      flushParagraph();
      list.push(line);
    } else {
      flushList();
      buffer.push(line);
    }
  }
  flushParagraph();
  flushList();
  return nodes;
}

function renderBlocks(body: string): ReactNode[] {
  return body.split(/\n{2,}/).flatMap((block, index) => {
    const key = `b-${index}`;
    const trimmed = block.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("## ")) {
      return [<h2 key={key}>{trimmed.slice(3).trim()}</h2>];
    }
    if (isTableBlock(trimmed)) {
      return [renderTable(trimmed, key)];
    }
    if (isListBlock(trimmed)) {
      return [renderList(trimmed.split("\n"), key)];
    }
    if (trimmed.split("\n").some((line) => /^-\s+/.test(line))) {
      return renderMixedBlock(trimmed, key);
    }
    return [
      <p key={key} className="prose">
        {renderLinesWithBreaks(trimmed, key)}
      </p>,
    ];
  });
}

export function LegalMarkdown({
  source,
  includeTitle = false,
}: {
  source: string;
  includeTitle?: boolean;
}) {
  const cleaned = cleanLegalMarkdown(source);
  const { title, body } = extractTitle(cleaned);
  return (
    <>
      {includeTitle && title ? <h1>{title}</h1> : null}
      {renderBlocks(body)}
    </>
  );
}

export function legalTitle(source: string): string {
  return extractTitle(cleanLegalMarkdown(source)).title;
}
