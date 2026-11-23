import { NextResponse } from "next/server";
import { authCallIsScanner, classifyAuthUserAgent, type AuthUaClass } from "@/lib/auth-ua-class";
import {
  applySessionCookie,
  loginPath,
  mayIssueSessionCookie,
  readExpiredMagicToken,
  safeNextPath,
  verifyMagicToken,
} from "@/lib/auth";
import { lookupMailDedupe } from "@/lib/mail-dedupe";
import { readMailLinkResendId } from "@/lib/mail-link-token-store";
import { recordAuthDailyCount, recordNewAccount, scheduleMeasureWrite } from "@/lib/measure-record";
import { ownerNoticeEmailHash, ownerNoticeMailKey, queueOwnerNotice } from "@/lib/owner-notice";

export const runtime = "nodejs";

type VerifyResult = "ok_first" | "ok_repeat" | "expired" | "invalid" | "scanner_skip";

function pathOnly(value: string): string {
  try {
    return new URL(value, "http://safe.invalid").pathname || "/login";
  } catch {
    return "/login";
  }
}

function region(): string | null {
  return process.env.VERCEL_REGION?.trim() || null;
}

function logVerify(fields: {
  result: VerifyResult;
  method: "GET" | "HEAD";
  uaClass: AuthUaClass;
  target: string;
  region: string | null;
}): void {
  console.info("[auth] verify " + JSON.stringify(fields));
}

export async function GET(request: Request): Promise<NextResponse> {
  return handleAuthVerify(request);
}

export async function HEAD(request: Request): Promise<NextResponse> {
  return handleAuthVerify(request);
}

async function handleAuthVerify(request: Request): Promise<NextResponse> {
  const method = request.method === "HEAD" ? "HEAD" : "GET";
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const next = safeNextPath(url.searchParams.get("next"));
  const uaClass = classifyAuthUserAgent(request.headers.get("user-agent"));
  const referrerHeader = request.headers.get("referer");
  let result: VerifyResult = "invalid";
  let target = "/login";
  let response = NextResponse.redirect(new URL("/login", request.url));
  try {
    if (authCallIsScanner({ method, uaClass })) {
      result = "scanner_skip";
      target = "/login";
      response = NextResponse.redirect(new URL("/login", request.url));
      scheduleMeasureWrite(() =>
        recordAuthDailyCount({
          metric: "verify_scanner",
          referrerHeader,
          gobdTest: url.searchParams.get("gobd_test"),
        }),
      );
      return response;
    }
    scheduleMeasureWrite(() =>
      recordAuthDailyCount({
        metric: "verify_human",
        referrerHeader,
        gobdTest: url.searchParams.get("gobd_test"),
      }),
    );
    const email = await verifyMagicToken(token);
    if (email && mayIssueSessionCookie({ channel: "magic", targetEmail: email })) {
      const login = await recordNewAccount({
        email,
        referrerHeader,
        gobdTest: url.searchParams.get("gobd_test"),
      });
      target = pathOnly(next ?? "/account");
      const redirect = NextResponse.redirect(new URL(next ?? "/account", request.url));
      applySessionCookie(redirect, email);
      response = redirect;
      const noticeKey = ownerNoticeMailKey("account", ownerNoticeEmailHash(email));
      const noticeAlready = login === "repeat" || (await lookupMailDedupe(noticeKey)) !== "free";
      if (noticeAlready) {
        result = "ok_repeat";
      } else {
        result = "ok_first";
        const resendId = await readMailLinkResendId(token);
        queueOwnerNotice({
          kind: "account",
          id: ownerNoticeEmailHash(email),
          title: "Neues Konto / erste Anmeldung",
          email,
          ...(resendId ? { facts: [["Versandkennung", resendId] as [string, string]] } : {}),
        });
      }
      return response;
    }
    const expiredEmail = await readExpiredMagicToken(token);
    if (expiredEmail) {
      result = "expired";
      target = "/auth/abgelaufen";
      const expired = new URL("/auth/abgelaufen", request.url);
      expired.searchParams.set("token", token);
      if (next) expired.searchParams.set("next", next);
      response = NextResponse.redirect(expired);
      return response;
    }
    result = "invalid";
    target = "/login";
    const loginUrl = new URL(loginPath(next), request.url);
    loginUrl.searchParams.set("error", "invalid");
    response = NextResponse.redirect(loginUrl);
    return response;
  } finally {
    logVerify({ result, method, uaClass, target, region: region() });
  }
}
