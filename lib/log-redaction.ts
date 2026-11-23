/** Request-Log von `next dev`: URLs mit Download-Token nicht ausgeben. */
export const DL_REQUEST_LOG_IGNORE = /[?&]dl=/;

/** Wert hinter `dl=` schwärzen. Die Session-ID bleibt stehen. */
export function redactDlTokenText(text: string): string {
  return text.replace(/([?&]dl=)[^&\s"'<>]*/g, "$1[redacted]");
}

type WriteFn = NodeJS.WriteStream["write"];

function redactChunk(chunk: string | Uint8Array): string | Uint8Array {
  if (typeof chunk === "string") return redactDlTokenText(chunk);
  const text = Buffer.from(chunk).toString("utf8");
  if (!text.includes("dl=")) return chunk;
  return Buffer.from(redactDlTokenText(text));
}

/** Schwärzt `dl=` in stdout und stderr des Node-Servers (`next dev` und `next start`). */
export function installDlLogRedaction(): void {
  for (const stream of [process.stdout, process.stderr]) {
    const original = stream.write as WriteFn & { redactsDl?: boolean };
    if (original.redactsDl) continue;
    const wrapped = function (this: NodeJS.WriteStream, chunk: string | Uint8Array, encoding?: unknown, cb?: unknown) {
      const next = redactChunk(chunk);
      const write = original as (this: NodeJS.WriteStream, chunk: string | Uint8Array, encoding?: unknown, cb?: unknown) => boolean;
      if (encoding === undefined) return write.call(this, next);
      if (typeof encoding === "function") return write.call(this, next, encoding);
      return write.call(this, next, encoding, cb);
    } as WriteFn & { redactsDl?: boolean };
    wrapped.redactsDl = true;
    stream.write = wrapped;
  }
}
