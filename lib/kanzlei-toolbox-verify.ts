import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { normalizeKanzleiName } from "@/lib/kanzlei-toolbox";

export type ImpressumCheck = {
  reachable: boolean;
  url: string;
  nameFound: boolean;
};

const PRIVATE_V4 = /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/;

function privateAddress(address: string): boolean {
  const ip = address.toLowerCase();
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  return PRIVATE_V4.test(ip);
}

async function publicHost(hostname: string): Promise<boolean> {
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) return false;
  if (isIP(hostname) && privateAddress(hostname)) return false;
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((record) => !privateAddress(record.address));
  } catch {
    return false;
  }
}

async function readText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < 150_000) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks)).slice(0, 150_000);
}

async function fetchPublic(url: URL, fetchImpl: typeof fetch): Promise<{ url: URL; text: string } | null> {
  let current = url;
  for (let hop = 0; hop < 3; hop += 1) {
    if (current.protocol !== "https:" || current.username || current.password || current.port) return null;
    if (!(await publicHost(current.hostname))) return null;
    const response = await fetchImpl(current, {
      redirect: "manual",
      headers: { "user-agent": "IKAT-Kanzlei-Pruefung", accept: "text/html" },
      signal: AbortSignal.timeout(4000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (type && !/html|text|xml/i.test(type)) return null;
    return { url: current, text: await readText(response) };
  }
  return null;
}

function nameInText(name: string, text: string): boolean {
  const folded = text.replace(/\s+/g, " ").toLowerCase();
  return folded.includes(name.toLowerCase());
}

/**
 * Reads the public website and its impressum. Does not call the
 * Steuerberaterverzeichnis. The page body is not stored.
 */
export async function checkImpressum(
  website: string,
  displayName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ImpressumCheck> {
  const empty = { reachable: false, url: "", nameFound: false };
  const name = normalizeKanzleiName(displayName);
  if (!name) return empty;
  let start: URL;
  try {
    start = new URL(website);
  } catch {
    return empty;
  }
  try {
    const home = await fetchPublic(start, fetchImpl);
    if (!home) return empty;
    const href = home.text.match(/href\s*=\s*["']([^"']*impressum[^"']*)["']/i)?.[1];
    const impressumUrl = href ? new URL(href, home.url) : new URL("/impressum", home.url);
    const page = impressumUrl.href === home.url.href ? home : await fetchPublic(impressumUrl, fetchImpl);
    if (!page) return { reachable: false, url: impressumUrl.href, nameFound: false };
    return { reachable: true, url: page.url.href, nameFound: nameInText(name, page.text) };
  } catch {
    return empty;
  }
}
