"use client";

import { decideSvArm, parseSvArm, SV_ARM_COOKIE, SV_ARM_MAX_AGE_SEC, type SvArm } from "@/lib/schnellversion-assign";
import { parseSchnellversionAnswers, type SchnellversionAnswers } from "@/lib/schnellversion-answers";
import type { SvEventRow } from "@/lib/schnellversion-events";
import { hasMarketingConsent, subscribeConsent } from "@/lib/tracking";

export const SV_ANSWERS_KEY = "sv49_answers";
export const SV_BOUGHT_KEY = "sv49_gekauft";

let answersCacheKey = "\u0000";
let answersCache: SchnellversionAnswers | null = null;
let boughtCacheKey = "\u0000";
let boughtCache = "";

export function subscribeSvStorage(): () => void {
  return () => {};
}

export function readSvAnswersSnapshot(): SchnellversionAnswers | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SV_ANSWERS_KEY) || "";
  if (raw === answersCacheKey) return answersCache;
  answersCacheKey = raw;
  try {
    answersCache = parseSchnellversionAnswers(raw ? JSON.parse(raw) : null);
  } catch {
    answersCache = null;
  }
  return answersCache;
}

export function saveSvAnswers(answers: SchnellversionAnswers): void {
  sessionStorage.setItem(SV_ANSWERS_KEY, JSON.stringify(answers));
  answersCacheKey = "\u0000";
}

export function readSvBoughtSnapshot(): string {
  if (typeof window === "undefined") return "";
  const raw = sessionStorage.getItem(SV_BOUGHT_KEY) || "";
  if (raw === boughtCacheKey) return boughtCache;
  boughtCacheKey = raw;
  boughtCache = raw;
  return boughtCache;
}

export function saveSvBought(iso: string): void {
  sessionStorage.setItem(SV_BOUGHT_KEY, iso);
  boughtCacheKey = iso;
  boughtCache = iso;
}

function readArmCookie(): SvArm | null {
  const match = document.cookie.match(/(?:^|; )sv49_arm=(control|test)(?:;|$)/);
  return parseSvArm(match?.[1]);
}

function writeArmCookie(arm: SvArm): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SV_ARM_COOKIE}=${arm}; Path=/; Max-Age=${SV_ARM_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function clearArmCookie(): void {
  document.cookie = `${SV_ARM_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Schreibt das Cookie nur nach Marketing-Einwilligung. Sonst wird es gelöscht. */
export function syncSvArm(): SvArm | null {
  const marketing = hasMarketingConsent();
  const arm = decideSvArm({
    marketing,
    existing: marketing ? readArmCookie() : null,
    roll: Math.random(),
  });
  if (!arm) {
    clearArmCookie();
    return null;
  }
  writeArmCookie(arm);
  return arm;
}

export function onConsentChange(listener: () => void): () => void {
  return subscribeConsent(listener);
}

/** Aufruf ohne Einwilligung und ohne Arm. Nur eine Zählung, keine Personenbezogenen Daten. */
export async function postSvVisit(): Promise<void> {
  try {
    await fetch("/api/schnellversion/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "sv_visit" }),
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch {
    /* Die Messung hält die Seite nicht auf. */
  }
}

export async function postSvEvent(
  row: Pick<SvEventRow, "name" | "arm"> & Partial<Pick<SvEventRow, "branche_vorlage" | "value" | "step" | "ziel">>,
): Promise<void> {
  if (!hasMarketingConsent()) return;
  const body = {
    name: row.name,
    arm: row.arm,
    variante: "b" as const,
    ...(row.branche_vorlage ? { branche_vorlage: row.branche_vorlage } : {}),
    ...(row.value !== undefined ? { value: row.value } : {}),
    ...(row.step !== undefined ? { step: row.step } : {}),
    ...(row.ziel ? { ziel: row.ziel } : {}),
  };
  try {
    await fetch("/api/schnellversion/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* Die Messung hält die Seite nicht auf. */
  }
}
