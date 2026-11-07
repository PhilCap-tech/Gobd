/**
 * Once-only marker for a questionnaire start or a new account.
 * The stored name is an HMAC. The file holds only a timestamp.
 * The email, the draft key, the IP and any click id are not written.
 * Markers are kept so the same key is not counted again. They are not
 * shown in the admin view.
 */
import { createHmac } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { getMagicLinkSecret, isBlobConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { MEASURE_METRICS, type MeasureMetric } from "@/lib/measure-event";
import { isProductionMeasureEnv } from "@/lib/measure-test";
import { getFileFallbackDir } from "@/lib/store";

export type MeasureClaimResult = "created" | "exists" | "skipped";

const HMAC_LABEL = "gobd/measure-claim/v1";

let testRoot: string | null = null;

export function setMeasureClaimRootForTest(dir: string | null): void {
  testRoot = dir;
}

function claimId(scope: string, material: string): string {
  const key = createHmac("sha256", getMagicLinkSecret()).update(HMAC_LABEL).digest();
  return createHmac("sha256", key).update(`${scope}\n${material}`).digest("hex");
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isBlobConflict(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  if (name === "BlobPreconditionFailedError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists") || message.includes("precondition");
}

async function claimFile(root: string, id: string): Promise<MeasureClaimResult> {
  const file = path.join(root, `${id}.json`);
  await mkdir(root, { recursive: true });
  let handle;
  try {
    handle = await open(file, "wx");
  } catch (error) {
    if (errorCode(error) === "EEXIST") return "exists";
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ at: new Date().toISOString() }), "utf8");
  } finally {
    await handle.close();
  }
  return "created";
}

function blobEnabled(): boolean {
  if (testRoot) return false;
  if (automatedRunForbidsLiveWrites()) return false;
  return isBlobConfigured() && Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function claimBlob(id: string): Promise<MeasureClaimResult> {
  try {
    await put(`gobd/measure-claim/${id}.json`, JSON.stringify({ at: new Date().toISOString() }), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json; charset=utf-8",
      token: process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "",
    });
    return "created";
  } catch (error) {
    if (isBlobConflict(error)) return "exists";
    throw error;
  }
}

export async function claimMeasureOnce(scope: "intake" | "magic-link", material: string): Promise<MeasureClaimResult> {
  const value = material.trim().toLowerCase();
  if (!value) return "skipped";
  if (!testRoot && !isProductionMeasureEnv()) return "skipped";
  if (!testRoot && automatedRunForbidsLiveWrites()) return "skipped";
  const id = claimId(scope, value);
  if (testRoot) return claimFile(testRoot, id);
  try {
    if (blobEnabled()) return await claimBlob(id);
    return await claimFile(path.join(getFileFallbackDir(), "measure-claim"), id);
  } catch (error) {
    console.error("[messluecken]", error instanceof Error ? error.name : "error");
    return "skipped";
  }
}

const START_DATE = /^\d{4}-\d{2}-\d{2}$/;

function startFile(root: string, metric: MeasureMetric): string {
  return path.join(root, "starts", `${metric}.json`);
}

function parseStart(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { date?: unknown };
    return typeof parsed.date === "string" && START_DATE.test(parsed.date) ? parsed.date : null;
  } catch {
    return null;
  }
}

async function readStartFile(root: string, metric: MeasureMetric): Promise<string | null> {
  try {
    return parseStart(await readFile(startFile(root, metric), "utf8"));
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

/** First production day for this metric. An existing marker is never moved. */
async function createStartFile(root: string, metric: MeasureMetric, date: string): Promise<string | null> {
  const existing = await readStartFile(root, metric);
  if (existing) return existing;
  const file = startFile(root, metric);
  await mkdir(path.dirname(file), { recursive: true });
  let handle;
  try {
    handle = await open(file, "wx");
  } catch (error) {
    if (errorCode(error) === "EEXIST") return readStartFile(root, metric);
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ date }), "utf8");
  } finally {
    await handle.close();
  }
  return date;
}

async function readStartBlob(metric: MeasureMetric): Promise<string | null> {
  try {
    const result = await get(`gobd/measure-claim/starts/${metric}.json`, {
      access: "private",
      useCache: false,
      token: process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "",
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return parseStart(await new Response(result.stream).text());
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "BlobNotFoundError") return null;
    throw error;
  }
}

async function createStartBlob(metric: MeasureMetric, date: string): Promise<string | null> {
  const existing = await readStartBlob(metric);
  if (existing) return existing;
  try {
    await put(`gobd/measure-claim/starts/${metric}.json`, JSON.stringify({ date }), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json; charset=utf-8",
      token: process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "",
    });
    return date;
  } catch (error) {
    if (!isBlobConflict(error)) throw error;
    return readStartBlob(metric);
  }
}

/**
 * Stores the Berlin day of the first production event for this metric.
 * Later calls keep that day, including a call with an earlier date.
 * Non-production does not write the marker.
 */
export async function rememberProductionStart(metric: MeasureMetric, date: string): Promise<string | null> {
  if (!START_DATE.test(date)) return null;
  if (!isProductionMeasureEnv()) return null;
  if (!testRoot && automatedRunForbidsLiveWrites()) return null;
  try {
    if (testRoot) return await createStartFile(testRoot, metric, date);
    if (blobEnabled()) return await createStartBlob(metric, date);
    return await createStartFile(path.join(getFileFallbackDir(), "measure-claim"), metric, date);
  } catch (error) {
    console.error("[messluecken]", error instanceof Error ? error.name : "error");
    return null;
  }
}

export async function readProductionStarts(): Promise<Partial<Record<MeasureMetric, string>>> {
  if (!testRoot && automatedRunForbidsLiveWrites()) return {};
  const starts: Partial<Record<MeasureMetric, string>> = {};
  for (const metric of MEASURE_METRICS) {
    let date: string | null = null;
    if (testRoot) date = await readStartFile(testRoot, metric);
    else if (blobEnabled()) date = await readStartBlob(metric);
    else date = await readStartFile(path.join(getFileFallbackDir(), "measure-claim"), metric);
    if (date) starts[metric] = date;
  }
  return starts;
}
