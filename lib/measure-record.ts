/**
 * Writes one aggregate row after the response when the caller must not
 * wait (draft save, magic-link verify). The Ampel beacon awaits its row
 * in the step route, same as the existing step sheet.
 */
import { after } from "next/server";
import { waitUntil } from "@vercel/functions";
import { resolveMeasureChannel } from "@/lib/measure-channel";
import { claimMeasureOnce, rememberProductionStart } from "@/lib/measure-claim";
import { measureDate, type MeasureCohort, type MeasureMetric } from "@/lib/measure-event";
import { recordMeasureRow } from "@/lib/measure-store";
import { isProductionMeasureEnv, measureCohort } from "@/lib/measure-test";

let nowForTest: (() => Date) | null = null;

export function setMeasureNowForTest(next: (() => Date) | null): void {
  nowForTest = next;
}

function now(): Date {
  return nowForTest ? nowForTest() : new Date();
}

function logMeasureFailure(error: unknown): void {
  console.error("[messluecken]", error instanceof Error ? error.name : "error");
}

export function scheduleMeasureWrite(work: () => Promise<void>): void {
  let task: Promise<void> | undefined;
  const run = (): Promise<void> => {
    task ??= work().catch((error: unknown) => {
      logMeasureFailure(error);
    });
    return task;
  };
  let scheduled = false;
  try {
    after(() => run());
    scheduled = true;
  } catch {
    // Outside a request there is no after() scope. The fallback below still runs.
  }
  try {
    waitUntil(run());
    scheduled = true;
  } catch {
    // Same outside the platform helper.
  }
  if (!scheduled) void run();
}

async function writeMeasure(input: {
  metric: MeasureMetric;
  n: string;
  channel: ReturnType<typeof resolveMeasureChannel>;
  cohort: MeasureCohort;
}): Promise<void> {
  const date = measureDate(now());
  if (isProductionMeasureEnv()) {
    const start = await rememberProductionStart(input.metric, date);
    if (!start) return;
  }
  await recordMeasureRow({ date, ...input });
}

function cohortFor(input: {
  email?: string | null;
  referrerHeader?: string | null;
  clientSignal?: unknown;
  gobdTest?: unknown;
}): MeasureCohort {
  return measureCohort({
    email: input.email,
    referrer: input.referrerHeader,
    signal: input.clientSignal,
    gobdTest: input.gobdTest,
  });
}

export async function recordIntakeStart(input: {
  draftKey: string;
  email?: string | null;
  referrerHeader?: string | null;
  clientChannel?: unknown;
  clientSignal?: unknown;
  gobdTest?: unknown;
}): Promise<void> {
  const claim = await claimMeasureOnce("intake", input.draftKey);
  if (claim !== "created") return;
  await writeMeasure({
    metric: "intake_start",
    n: "",
    channel: resolveMeasureChannel({
      referrerHeader: input.referrerHeader,
      clientChannel: input.clientChannel,
    }),
    cohort: cohortFor(input),
  });
}

export async function recordNewAccount(input: {
  email: string;
  referrerHeader?: string | null;
  clientChannel?: unknown;
  clientSignal?: unknown;
  gobdTest?: unknown;
}): Promise<void> {
  const claim = await claimMeasureOnce("magic-link", input.email);
  if (claim !== "created") return;
  await writeMeasure({
    metric: "magic_link_first_login",
    n: "",
    channel: resolveMeasureChannel({
      referrerHeader: input.referrerHeader,
      clientChannel: input.clientChannel,
    }),
    cohort: cohortFor(input),
  });
}

export async function recordAmpelMeasure(input: {
  metric: MeasureMetric;
  n: string;
  referrerHeader?: string | null;
  clientChannel?: unknown;
  clientSignal?: unknown;
  gobdTest?: unknown;
}): Promise<void> {
  await writeMeasure({
    metric: input.metric,
    n: input.n,
    channel: resolveMeasureChannel({
      referrerHeader: input.referrerHeader,
      clientChannel: input.clientChannel,
    }),
    cohort: cohortFor(input),
  });
}
