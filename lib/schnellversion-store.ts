/**
 * Ereignisse der Schnellversion. Kein Sheet, kein Blob.
 * Außerhalb von Produktion liegt eine Kopie unter /tmp, damit die
 * Admin-Auswertung im selben Rechner die Zeilen sieht. Produktion hält
 * die Zeilen nur im Prozess und schreibt nicht nach außen.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import type { SvEventRow } from "@/lib/schnellversion-events";

const FILE = "/tmp/gobd-sv49-events.jsonl";

let memory: SvEventRow[] = [];

export function resetSvEventsForTest(): void {
  memory = [];
}

export function rememberSvEvent(row: SvEventRow): void {
  memory.push(row);
  if ((process.env.VERCEL_ENV ?? "").trim() === "production") return;
  if (automatedRunForbidsLiveWrites()) return;
  try {
    appendFileSync(FILE, `${JSON.stringify(row)}\n`, "utf8");
  } catch {
    /* lokale Datei ist nur eine Hilfe */
  }
}

export function readSvEvents(): SvEventRow[] {
  if ((process.env.VERCEL_ENV ?? "").trim() === "production") return memory.slice();
  if (automatedRunForbidsLiveWrites()) return memory.slice();
  try {
    const text = readFileSync(FILE, "utf8");
    const rows: SvEventRow[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as SvEventRow;
        if (parsed && typeof parsed.name === "string" && (parsed.arm === "control" || parsed.arm === "test")) {
          rows.push(parsed);
        }
      } catch {
        /* kaputte Zeile überspringen */
      }
    }
    return rows.length ? rows : memory.slice();
  } catch {
    return memory.slice();
  }
}
