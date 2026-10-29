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

export function pageTexts(buffer: Buffer): string[] {
  const raw = buffer.toString("latin1");
  const texts: string[] = [];
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
    texts.push(textFromContent(latin));
  }
  return texts;
}

export function pageCount(buffer: Buffer): number {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
}
