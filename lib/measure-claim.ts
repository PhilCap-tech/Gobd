/**
 * Once-only marker for a questionnaire start or a new account.
 * The stored name is an HMAC. The file holds only a timestamp.
 * The email, the draft key, the IP and any click id are not written.
 * Markers are kept so the same key is not counted again. They are not
 * shown in the admin view.
 */
import { createHmac } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, put } from "@vercel/blob";
import { getMagicLinkSecret, isBlobConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
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

export async function claimMeasureOnce(scope: "intake" | "account", material: string): Promise<MeasureClaimResult> {
  const value = material.trim().toLowerCase();
  if (!value) return "skipped";
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
