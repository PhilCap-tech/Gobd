"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AmpelCta, AmpelDisclaimer, AmpelResult } from "@/components/ampel-result";
import { scoreAmpelCheck } from "@/lib/ampel-check-score";
import {
  AMPEL_CHECK_HINT,
  AMPEL_CHECK_INTRO,
  AMPEL_CHECK_KICKER,
  AMPEL_CHECK_MAIL,
  AMPEL_CHECK_PREVIEW_DETAIL,
  AMPEL_CHECK_PREVIEW_NOTE,
  AMPEL_CHECK_WHY,
  AMPEL_EMAIL_PRIVACY_NOTE,
  AMPEL_H1,
  AMPEL_MARKETING_CONSENT,
  AMPEL_QUESTIONS,
  AMPEL_RESULTS,
  AMPEL_RESULT_MAIL,
  AMPEL_SHARE_KANZLEI,
  ampelCheckPreviewLine,
  ampelSendStatusNotice,
  type AmpelAnswer,
} from "@/lib/ampel-questions";
import {
  AMPEL_PATH,
  ampelNeinQuestions,
  ampelSharePath,
  decodeAmpelAnswers,
  encodeAmpelAnswers,
  publicAmpelSource,
  sanitizeAmpelRef,
  type AmpelAnswerMap,
} from "@/lib/ampel-score";
import {
  armAmpelEmailView,
  noteAmpelSubmitResult,
  sendAmpelEmailView,
  sendAmpelQuestionView,
  sendAmpelStep,
} from "@/lib/ampel-step-beacon";
import { replaceCheckSearch, submitVariantFields } from "@/lib/campaign-params";
import { trackAmpelCheckSubmit, trackAmpelResult, trackAmpelStart } from "@/lib/tracking";

function EmailPrivacyNote() {
  const label = "Datenschutzerklärung";
  const [before, after] = AMPEL_EMAIL_PRIVACY_NOTE.split(label);
  return (
    <>
      {before}
      <Link href="/datenschutz">{label}</Link>
      {after}
    </>
  );
}

function shareMessage(ref: string, origin = ""): string {
  const link = `${origin}${ampelSharePath(ref)}`;
  return AMPEL_SHARE_KANZLEI.message.replaceAll("{link}", link);
}

function shownKey(code: string): string {
  return `gobd_ampel_shown:${code}`;
}

function emailLooksValid(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function AmpelPreview({ answers }: { answers: AmpelAnswerMap }) {
  const scored = scoreAmpelCheck(answers);
  if (!scored) return null;
  const color = AMPEL_RESULTS[scored.light].label;
  const openPoints = ampelNeinQuestions(answers).length;
  return (
    <section className={`ampel-banner ampel-preview ${scored.light}`} aria-live="polite" aria-label={`Ampel ${color}`}>
      <p className="ampel-kicker">{color}</p>
      <p className="ampel-preview-line">{ampelCheckPreviewLine(color, openPoints)}</p>
      <p className="hint ampel-preview-note">{AMPEL_CHECK_PREVIEW_NOTE}</p>
      <p>{AMPEL_CHECK_PREVIEW_DETAIL}</p>
    </section>
  );
}

function scrollBlockClearOfBanner(block: HTMLElement, anchorSelector: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  const anchor = block.querySelector(anchorSelector);
  const banner = document.querySelector(".consent-banner");
  const bannerHeight = banner instanceof HTMLElement ? banner.getBoundingClientRect().height : 0;
  const blockTop = block.getBoundingClientRect().top + window.scrollY;
  let top = Math.max(0, blockTop - 12);
  if (anchor instanceof HTMLElement) {
    const anchorBottom = anchor.getBoundingClientRect().bottom + window.scrollY;
    const visibleBottom = top + window.innerHeight - bannerHeight - 12;
    if (anchorBottom > visibleBottom) top += anchorBottom - visibleBottom;
  }
  window.scrollTo({ top, behavior });
}

export function AmpelCheck({ ctaPrice }: { ctaPrice?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = decodeAmpelAnswers(searchParams.get("a") ?? "");
  const [mode, setMode] = useState<"questions" | "email" | "result">(initial ? "email" : "questions");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AmpelAnswerMap>(initial ?? {});
  const [refName, setRefName] = useState(sanitizeAmpelRef(searchParams.get("ref") ?? ""));
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [fax, setFax] = useState("");
  const [pending, setPending] = useState(false);
  const [mailError, setMailError] = useState("");
  const [mailNotice, setMailNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const startedRef = useRef(false);
  const resultTrackedRef = useRef(false);
  const questionRef = useRef<HTMLElement>(null);
  const mailRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const scrollTarget = useRef<"question" | "mail" | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (mode === "questions") sendAmpelQuestionView(step + 1);
  }, [mode, step]);

  useEffect(() => {
    if (mode === "email") sendAmpelEmailView();
    else armAmpelEmailView();
  }, [mode]);

  const question = AMPEL_QUESTIONS[step];
  const encoded = useMemo(() => encodeAmpelAnswers(answers), [answers]);

  useEffect(() => {
    if (!encoded) return;
    try {
      if (sessionStorage.getItem(shownKey(encoded)) === "1") setMode("result");
    } catch {
      // Private mode keeps the email step.
    }
  }, [encoded]);

  useEffect(() => {
    if (mode !== "result" || resultTrackedRef.current) return;
    resultTrackedRef.current = true;
    trackAmpelResult();
  }, [mode]);

  const searchKey = searchParams.toString();

  useEffect(() => {
    const target = scrollTarget.current;
    if (!target) return;
    const node = target === "mail" ? mailRef.current : questionRef.current;
    if (!node) return;
    const selector = target === "mail" ? "#ampel-email" : ".ampel-choices";
    const run = () => {
      if (!node.isConnected) return;
      scrollBlockClearOfBanner(node, selector);
    };
    if (target === "question") {
      scrollTarget.current = null;
      run();
      return;
    }
    const timer = window.setTimeout(() => {
      if (scrollTarget.current !== "mail") return;
      scrollTarget.current = null;
      run();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [mode, step, searchKey]);

  function rememberAnswers(code: string) {
    const query = replaceCheckSearch(searchParams, { a: code, ref: refName });
    router.replace(query ? `${AMPEL_PATH}?${query}` : AMPEL_PATH);
  }

  function choose(answer: AmpelAnswer) {
    if (!question) return;
    sendAmpelStep({ event: "ampel_q_answer", n: step + 1 });
    if (!startedRef.current) {
      startedRef.current = true;
      trackAmpelStart();
    }
    const next = { ...answers, [question.id]: answer };
    setAnswers(next);
    if (step < AMPEL_QUESTIONS.length - 1) {
      scrollTarget.current = "question";
      setStep(step + 1);
      return;
    }
    const code = encodeAmpelAnswers(next);
    if (!code) return;
    setMailError("");
    scrollTarget.current = "mail";
    setMode("email");
    rememberAnswers(code);
  }

  function editAnswers() {
    resultTrackedRef.current = false;
    setMailError("");
    scrollTarget.current = "question";
    setMode("questions");
    setStep(Math.max(AMPEL_QUESTIONS.length - 1, 0));
  }

  function restart() {
    resultTrackedRef.current = false;
    scrollTarget.current = "question";
    setMode("questions");
    setStep(0);
    setAnswers({});
    setMailNotice("");
    setMailError("");
    setMarketing(false);
    const query = replaceCheckSearch(searchParams, { a: "", ref: refName });
    router.replace(query ? `${AMPEL_PATH}?${query}` : AMPEL_PATH);
  }

  async function copyShare() {
    const text = shareMessage(refName, window.location.origin);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function sendResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!encoded || pending) return;
    sendAmpelStep({ event: "ampel_submit_click", valid: emailLooksValid(email) });
    if (!email.trim()) {
      setMailError(AMPEL_CHECK_MAIL.emptyEmail);
      emailRef.current?.focus();
      return;
    }
    if (!emailLooksValid(email)) {
      setMailError(AMPEL_RESULT_MAIL.invalidEmail);
      emailRef.current?.focus();
      return;
    }
    setMailError("");
    setPending(true);
    const payload = {
      email,
      answers: encoded,
      ref: refName,
      marketing,
      fax_number: fax,
      ...submitVariantFields(window.location.search),
    };
    const showResult = (notice: string) => {
      try {
        sessionStorage.setItem(shownKey(encoded), "1");
      } catch {
        // The result still shows for this view.
      }
      setMailNotice(notice);
      setMode("result");
    };
    const hideResult = () => {
      try {
        sessionStorage.removeItem(shownKey(encoded));
      } catch {
        // The form is enough when the request itself was rejected.
      }
      setMailNotice("");
      setMode("email");
    };
    let leadAccepted = false;
    showResult(AMPEL_RESULT_MAIL.sending);
    try {
      const response = await fetch("/api/ampel/ergebnis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      let data: {
        ok?: boolean;
        error?: string;
        honeypot?: boolean;
        marketing?: string;
        mailed?: boolean;
        pending?: boolean;
        duplicate?: boolean;
        notice?: string;
        token?: string;
      } = {};
      try {
        data = (await response.json()) as typeof data;
      } catch {
        data = {};
      }
      if (response.status === 400 || data.honeypot) {
        noteAmpelSubmitResult(response.status);
        hideResult();
        if (!data.honeypot) setMailError(data.error || AMPEL_RESULT_MAIL.invalidEmail);
        return;
      }
      if (response.status === 429) {
        noteAmpelSubmitResult(response.status);
        showResult(data.notice || AMPEL_RESULT_MAIL.rateLimitedEmail);
        return;
      }
      if (data.duplicate) {
        noteAmpelSubmitResult(response.status);
        showResult(data.notice || AMPEL_RESULT_MAIL.alreadySent);
        return;
      }
      if (!response.ok || !data.ok) {
        noteAmpelSubmitResult(response.status);
        showResult(data.error || data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
        return;
      }
      if (data.pending) {
        if (!data.token) {
          noteAmpelSubmitResult(response.status, true);
          showResult(AMPEL_RESULT_MAIL.shownWithoutMail);
          return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        try {
          const follow = await fetch("/api/ampel/ergebnis/senden", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, send_token: data.token }),
            signal: controller.signal,
          });
          let sent: {
            ok?: boolean;
            notice?: string;
            marketing?: string;
            mailed?: boolean;
            duplicate?: boolean;
            error?: string;
          } = {};
          try {
            sent = (await follow.json()) as typeof sent;
          } catch {
            sent = {};
          }
          leadAccepted =
            follow.ok &&
            follow.status !== 403 &&
            follow.status !== 429 &&
            sent.ok !== false &&
            sent.duplicate !== true &&
            sent.mailed !== false;
          noteAmpelSubmitResult(follow.status, true);
          showResult(
            ampelSendStatusNotice({
              email,
              status: follow.status,
              ok: follow.ok,
              mailed: sent.mailed,
              duplicate: sent.duplicate,
              notice: sent.notice,
              error: sent.error,
              marketing: sent.marketing,
            }),
          );
        } catch (error) {
          const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
          if (aborted) noteAmpelSubmitResult(0, false, true);
          showResult(ampelSendStatusNotice({ email, aborted, status: 0, ok: false }));
        } finally {
          clearTimeout(timer);
        }
        return;
      }
      if (data.mailed === false) {
        noteAmpelSubmitResult(response.status);
        showResult(data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
        return;
      }
      leadAccepted = true;
      noteAmpelSubmitResult(response.status);
      showResult(data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
    } catch (error) {
      const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      if (aborted) noteAmpelSubmitResult(0, false, true);
      showResult(aborted ? AMPEL_RESULT_MAIL.sendInterrupted : AMPEL_RESULT_MAIL.offline);
    } finally {
      if (leadAccepted) trackAmpelCheckSubmit();
      setPending(false);
    }
  }

  return (
    <>
      <p className="kicker">{AMPEL_CHECK_KICKER}</p>
      <h1>{AMPEL_H1}</h1>
      <p className="lead ampel-lead">{AMPEL_CHECK_INTRO}</p>

      {mode === "questions" && question ? (
        <>
          <section ref={questionRef} className="card ampel-question" aria-labelledby="ampel-question-title">
            <p className="ampel-progress">
              Frage {step + 1} von {AMPEL_QUESTIONS.length}
            </p>
            <h2 id="ampel-question-title">{question.question}</h2>
            {question.hint ? <p className="hint ampel-question-hint">{question.hint}</p> : null}
            <div className="ampel-choices" role="group" aria-label="Antwort">
              <button
                type="button"
                className="btn ghost"
                aria-pressed={answers[question.id] === "ja"}
                onClick={() => choose("ja")}
              >
                Ja
              </button>
              <button
                type="button"
                className="btn ghost"
                aria-pressed={answers[question.id] === "nein"}
                onClick={() => choose("nein")}
              >
                Nein
              </button>
              {question.applicable === "optional" ? (
                <button
                  type="button"
                  className="btn ghost"
                  aria-pressed={answers[question.id] === "nicht_zutreffend"}
                  onClick={() => choose("nicht_zutreffend")}
                >
                  Trifft nicht zu
                </button>
              ) : null}
            </div>
            <details className="ampel-why" key={question.id}>
              <summary>{AMPEL_CHECK_WHY}</summary>
              <p>{question.explanation}</p>
              <p className="ampel-quelle">Quelle: {publicAmpelSource(question.source)}</p>
            </details>
            {step > 0 ? (
              <p className="actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    scrollTarget.current = "question";
                    setStep(step - 1);
                  }}
                >
                  Zurück
                </button>
              </p>
            ) : null}
          </section>
          <p className="hint ampel-orientierung">{AMPEL_CHECK_HINT}</p>
        </>
      ) : null}

      {mode === "email" && encoded ? (
        <div ref={mailRef} className="ampel-gate">
        <AmpelPreview answers={answers} />
        <form className="card ampel-mail" noValidate onSubmit={sendResult}>
          <h2>{AMPEL_CHECK_MAIL.heading}</h2>
          <p>{AMPEL_CHECK_MAIL.text}</p>
          <div className="ampel-honeypot" aria-hidden="true">
            <label htmlFor="ampel-fax">Fax</label>
            <input
              id="ampel-fax"
              name="fax_number"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={fax}
              onChange={(event) => setFax(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ampel-email">{AMPEL_CHECK_MAIL.label}</label>
            <input
              ref={emailRef}
              id="ampel-email"
              name="email"
              type="email"
              inputMode="email"
              enterKeyHint="send"
              autoComplete="email"
              required
              aria-invalid={mailError ? true : undefined}
              aria-describedby={mailError ? "ampel-email-error ampel-email-privacy" : "ampel-email-privacy"}
              placeholder={AMPEL_RESULT_MAIL.placeholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {mailError ? (
              <p id="ampel-email-error" className="field-error" role="alert">
                {mailError}
              </p>
            ) : null}
            <p id="ampel-email-privacy" className="hint">
              <EmailPrivacyNote />
            </p>
          </div>
          <p className="actions">
            <button className="btn ampel-submit" type="submit" disabled={pending}>
              {pending ? "Wird gesendet …" : AMPEL_CHECK_MAIL.button}
            </button>
          </p>
          <p className="hint ampel-mail-note">{AMPEL_CHECK_MAIL.note}</p>
          <div className="field ampel-consent">
            <label className="check" htmlFor="ampel-marketing">
              <input
                id="ampel-marketing"
                name="marketing"
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
              />
              <span>{AMPEL_MARKETING_CONSENT}</span>
            </label>
          </div>
          <p className="actions">
            <button type="button" className="ampel-text-btn" onClick={editAnswers}>
              Antworten ändern
            </button>
          </p>
        </form>
        </div>
      ) : null}

      {mode === "result" && encoded ? (
        <>
          {mailNotice ? <p className="card" role="status">{mailNotice}</p> : null}
          <AmpelResult answers={answers} />
          <p className="actions">
            <button type="button" className="btn ghost" onClick={restart}>
              Antworten ändern
            </button>
          </p>
          <AmpelCta price={ctaPrice} />
        </>
      ) : null}

      <aside className="card ampel-share" id="teilen">
        <h2>{AMPEL_SHARE_KANZLEI.headline}</h2>
        <p>{AMPEL_SHARE_KANZLEI.intro}</p>
        <div className="field">
          <label htmlFor="ampel-ref">Name der Kanzlei</label>
          <input
            id="ampel-ref"
            name="ref"
            value={refName}
            maxLength={80}
            onChange={(event) => setRefName(sanitizeAmpelRef(event.target.value))}
          />
        </div>
        <p className="ampel-share-message">{shareMessage(refName, origin)}</p>
        <p className="actions">
          <button type="button" className="btn ghost" onClick={copyShare}>
            {copied ? AMPEL_SHARE_KANZLEI.copied : AMPEL_SHARE_KANZLEI.button}
          </button>
        </p>
      </aside>
      <AmpelDisclaimer />
    </>
  );
}
