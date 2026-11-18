/** Text aus pdfkit-PDFs lesen (Content-Streams, WinAnsi). Gemeinsam für Muster-Checks. */
import zlib from "node:zlib";

const WINANSI_EXTRA: Record<number, string> = {
  0x80: "€",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x99: "™",
};

function winAnsiChar(code: number): string {
  return WINANSI_EXTRA[code] ?? String.fromCharCode(code);
}

function decodePdfLiteral(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i] ?? "";
    if (ch !== "\\") {
      out += winAnsiChar(ch.charCodeAt(0));
      continue;
    }
    const next = body[i + 1] ?? "";
    if (next === "n") {
      out += "\n";
      i += 1;
      continue;
    }
    if (next === "r") {
      out += "\r";
      i += 1;
      continue;
    }
    if (next === "t") {
      out += "\t";
      i += 1;
      continue;
    }
    if (next === "(" || next === ")" || next === "\\") {
      out += next;
      i += 1;
      continue;
    }
    if (/[0-7]/.test(next)) {
      let oct = next;
      let j = i + 2;
      for (let k = 0; k < 2 && j < body.length && /[0-7]/.test(body[j] ?? ""); k += 1, j += 1) {
        oct += body[j];
      }
      out += winAnsiChar(Number.parseInt(oct, 8));
      i = j - 1;
      continue;
    }
  }
  return out;
}

function decodeHex(hex: string): string {
  const bytes = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = Number.parseInt(bytes.slice(i, i + 2), 16);
    if (Number.isNaN(code)) continue;
    out += winAnsiChar(code);
  }
  return out;
}

function textFromContent(latin: string): string {
  const parts: string[] = [];
  const hex = /<([0-9A-Fa-f\s]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = hex.exec(latin))) {
    parts.push(decodeHex(match[1] ?? ""));
  }
  const literal = /\((?:\\.|[^\\)])*\)/g;
  while ((match = literal.exec(latin))) {
    parts.push(decodePdfLiteral((match[0] ?? "").slice(1, -1)));
  }
  return parts.join("");
}

function pageStreams(buffer: Buffer): string[] {
  const raw = buffer.toString("latin1");
  const streams: string[] = [];
  // Length, not the next "endstream" bytes: Flate data can contain that sequence.
  const re = /\/Length\s+(\d+)\b[^>]*>>\s*stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const length = Number(match[1]);
    const start = match.index + match[0].length;
    const data = Buffer.from(raw.slice(start, start + length), "latin1");
    let inflated: Buffer;
    try {
      inflated = zlib.inflateSync(data);
    } catch {
      inflated = data;
    }
    const latin = inflated.toString("latin1");
    if (!/\/F\d+ [\d.]+ Tf/.test(latin)) continue;
    streams.push(latin);
  }
  return streams;
}

export function pageTexts(buffer: Buffer): string[] {
  return pageStreams(buffer).map((latin) => textFromContent(latin));
}

function piecesInOrder(latin: string): string[] {
  const pieces: string[] = [];
  const re = /<([0-9A-Fa-f\s]+)>|\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(latin))) {
    if (match[1] != null) pieces.push(decodeHex(match[1]));
    else pieces.push(decodePdfLiteral((match[0] ?? "").slice(1, -1)));
  }
  return pieces;
}

/**
 * Text operators in stream order, concatenated.
 * pdfkit splits a word around kerning (`J` + `ahre`, `w` + `erden`) and keeps
 * the real word space inside an operator. Inserting a space between operators
 * turns that into „J ahre“.
 */
export function orderedPageTexts(buffer: Buffer): string[] {
  return pageStreams(buffer).map((latin) => piecesInOrder(latin).join(""));
}

/**
 * Tabellenzeile = eine Einheit, Zellen der Zeile mit Leerzeichen.
 * Eine neue Zeile (andere Grundlinie) wird ein Absatz, damit die
 * Aufbewahrungstabelle nicht ein einziger Satz wird.
 * Kerning bleibt zusammen: pdfkit setzt dort nur eine Zahl zwischen den Fragmenten.
 */
export function separatedPageTexts(buffer: Buffer): string[] {
  return pageStreams(buffer).map(separateCells);
}

function separateCells(latin: string): string {
  const token = /<([0-9A-Fa-f\s]+)>|\((?:\\.|[^\\)])*\)/g;
  const pieces: { text: string; x: number | null; y: number | null }[] = [];
  let prevEnd = 0;
  let x: number | null = null;
  let y: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = token.exec(latin))) {
    const between = latin.slice(prevEnd, match.index);
    const text = match[1] != null ? decodeHex(match[1]) : decodePdfLiteral((match[0] ?? "").slice(1, -1));
    const tms = [...between.matchAll(/([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+Tm/g)];
    const moved = /(?:\bTm\b|\bTd\b|\bTD\b|\bT\*)/.test(between);
    if (tms.length > 0) {
      x = Number(tms.at(-1)?.[1]);
      y = Number(tms.at(-1)?.[2]);
    }
    if (!moved && pieces.length > 0) pieces[pieces.length - 1]!.text += text;
    else pieces.push({ text, x: moved ? x : pieces.at(-1)?.x ?? x, y: moved ? y : pieces.at(-1)?.y ?? y });
    prevEnd = match.index + match[0].length;
  }
  const lines: { cells: typeof pieces; table: boolean }[] = [];
  for (const piece of pieces) {
    const last = lines.at(-1);
    const sameLine = last && piece.y != null && last.cells[0]?.y != null && Math.abs(piece.y - (last.cells[0]?.y ?? 0)) <= 0.8;
    if (last && sameLine) last.cells.push(piece);
    else lines.push({ cells: [piece], table: false });
  }
  for (const line of lines) {
    const xs = line.cells.map((cell) => cell.x).filter((value): value is number => value != null);
    line.table = new Set(xs.map((value) => Math.round(value))).size >= 2;
  }
  let out = "";
  let prevTable = false;
  for (const line of lines) {
    const text = line.cells.map((cell) => cell.text).join(" ").replace(/[^\S\n]+/g, " ").trim();
    if (!text) continue;
    if (!out) {
      out = text;
      prevTable = line.table;
      continue;
    }
    out += prevTable || line.table ? `\n\n${text}` : `\n${text}`;
    prevTable = line.table;
  }
  return out;
}

export function pageCount(buffer: Buffer): number {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
}
