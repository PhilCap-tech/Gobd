import { sendKassenConfirmationMail, sendKassenResultMail } from "@/lib/kassen-check-mail";
import {
  KASSEN_LEAD_PREFIX,
  KASSEN_LEAD_STATUS,
  KASSEN_QUESTIONS,
  KASSEN_RATE_SCOPE,
  KASSEN_SENT_NOTICE,
} from "@/lib/kassen-check-questions";
import { kassenResultDedupeKey } from "@/lib/kassen-check-mail";
import {
  completeAmpelResult,
  submitAmpelResult,
  type SubmitAmpelDeps,
  type SubmitAmpelInput,
  type SubmitAmpelOutcome,
} from "@/lib/ampel-result-send";

function kassenSendDeps(deps: SubmitAmpelDeps): SubmitAmpelDeps {
  return {
    questions: KASSEN_QUESTIONS,
    rateScope: KASSEN_RATE_SCOPE,
    leadPrefix: KASSEN_LEAD_PREFIX,
    leadStatus: KASSEN_LEAD_STATUS,
    check: "kassen-check",
    dedupeKey: kassenResultDedupeKey,
    sentNotice: KASSEN_SENT_NOTICE,
    mail: (payload) => sendKassenResultMail(payload),
    sendConfirmation: sendKassenConfirmationMail,
    ...deps,
  };
}

export function submitKassenResult(
  input: SubmitAmpelInput,
  deps: SubmitAmpelDeps = {},
): Promise<SubmitAmpelOutcome> {
  return submitAmpelResult(input, kassenSendDeps(deps));
}

export function completeKassenResult(
  input: SubmitAmpelInput,
  deps: SubmitAmpelDeps = {},
): Promise<SubmitAmpelOutcome> {
  return completeAmpelResult(input, kassenSendDeps(deps));
}
