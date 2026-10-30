"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AmpelCta, AmpelDisclaimer } from "@/components/ampel-result";
import { scoreAmpelCheck } from "@/lib/ampel-check-score";
import {
  AMPEL_CAP_NOTE,
  AMPEL_CHECK_HINT,
  AMPEL_CHECK_INTRO,
  AMPEL_CHECK_KICKER,
  AMPEL_CHECK_MAIL,
  AMPEL_CHECK_WHY,
  AMPEL_QUESTIONS,
  AMPEL_RESULTS,
  AMPEL_RESULT_MAIL,
  AMPEL_SHARE_KANZLEI,
  ampelSendStatusNotice,
  type AmpelAnswer,
} from "@/lib/ampel-questions";
import {
  ampelNeinQuestions,
  ampelSharePath,
  encodeAmpelAnswers,
  publicAmpelSource,
  sanitizeAmpelRef,
  type AmpelAnswerMap,
} from "@/lib/ampel-score";
import {
  noteAmpelReportSent,
  sendAmpelQuestionView,
  sendAmpelStep,
} from "@/lib/ampel-step-beacon";
import { submitVariantFields } from "@/lib/campaign-params";
import { AMPEL_V2_COPY, AMPEL_V2_SHORT_LABELS, ampelV2Einordnung, ampelV2Explanation } from "@/lib/ampel-v2-copy";
import { stripAnswerCodeFromSearch } from "@/lib/ampel-v2-flag";
import { trackAmpelCheckSubmit, trackAmpelReportConversion, trackAmpelResult, trackAmpelStart } from "@/lib/tracking";

/*
 * Ampel ohne E-Mail (Flag AMPEL_NO_EMAIL_ENABLED, Preview: ?ampel_v2=1).
 * - Antworten bleiben nur im React-State. Kein Antwortcode (Parameter a) in der URL, kein Storage.
 * - Die URL wird nie umgeschrieben (außer ein mitgebrachter Parameter a wird entfernt),
 *   daher bleiben gclid/gbraid/wbraid/utm_* und src/v für Absenden und Produktklick erhalten.
 * - Zusätzliche Schritte nur in der bestehenden cookielosen Zählung.
 */

function WithDseLink({ text }: { text: string }) {
  const label = "Datenschutzerklärung";
  const [before, after] = text.split(label);
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
  return AMPEL_V2_COPY.shareMessage.replaceAll("{link}", link);
}

function emailLooksValid(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function AmpelResultNoEmail({ answers }: { answers: AmpelAnswerMap }) {
  const scored = scoreAmpelCheck(answers);
  if (!scored) return null;
  const band = AMPEL_RESULTS[scored.light];
  const nein = ampelNeinQuestions(answers);
  return (
    <section className={`ampel-banner ${scored.light}`} aria-label={`Ampel ${band.label}`}>
      <p className="ampel-kicker">{band.label}</p>
      <h2>{band.headline}</h2>
      <p>{ampelV2Einordnung(scored.light, nein.map((question) => question.id))}</p>
      {scored.capped ? <p className="ampel-cap">{AMPEL_CAP_NOTE}</p> : null}
      {nein.length > 0 ? (
        <div className="ampel-nein">
          <h3>{AMPEL_V2_COPY.neinHeading}</h3>
          <ul>
            {nein.map((question) => (
              <li key={question.id}>
                <strong>{AMPEL_V2_SHORT_LABELS[question.id] ?? question.question}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="hint">{AMPEL_V2_COPY.disclaimerShort}</p>
    </section>
  );
}

export function AmpelCheckV2({ ctaPrice }: { ctaPrice?: string } = {}) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"questions" | "result">("questions");
  const [sent, setSent] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AmpelAnswerMap>({});
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
  const resultViewRef = useRef(false);
  const offerViewRef = useRef(false);
  const questionRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const offerRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same pattern as the flag-off flow
    setOrigin(window.location.origin);
    const next = stripAnswerCodeFromSearch(window.location.search);
    if (next != null) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${next}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if (mode === "questions") sendAmpelQuestionView(step + 1);
  }, [mode, step]);

  const question = AMPEL_QUESTIONS[step];
  const encoded = useMemo(() => encodeAmpelAnswers(answers), [answers]);

  useEffect(() => {
    if (mode !== "result" || resultViewRef.current) return;
    resultViewRef.current = true;
    sendAmpelStep({ event: "ampel_result_view" });
    trackAmpelResult();
    resultRef.current?.scrollIntoView({ block: "start" });
  }, [mode]);

  useEffect(() => {
    if (mode !== "result" || sent || offerViewRef.current) return;
    const node = offerRef.current;
    if (!node) return;
    const fire = () => {
      if (offerViewRef.current) return;
      offerViewRef.current = true;
      sendAmpelStep({ event: "ampel_report_offer_view" });
    };
    if (typeof IntersectionObserver === "undefined") {
      fire();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        fire();
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode, sent]);

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
      setStep(step + 1);
      questionRef.current?.scrollIntoView({ block: "start" });
      return;
    }
    if (!encodeAmpelAnswers(next)) return;
    setMailError("");
    setMode("result");
  }

  function restart() {
    resultViewRef.current = false;
    offerViewRef.current = false;
    setMode("questions");
    setSent(false);
    setStep(0);
    setAnswers({});
    setMailNotice("");
    setMailError("");
    setMarketing(false);
  }

  function onProductClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest("a") : null;
    if (!target) return;
    const href = target.getAttribute("href") ?? "";
    if (href.startsWith("/checkout")) sendAmpelStep({ event: "ampel_product_click" });
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
    sendAmpelStep({ event: "ampel_report_submit", valid: emailLooksValid(email) });
    if (!email.trim()) {
      setMailError(AMPEL_V2_COPY.offerEmptyEmail);
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
    // Same request as the flag-off flow: same API, same double opt-in, same fields.
    const payload = {
      email,
      answers: encoded,
      ref: refName,
      marketing,
      fax_number: fax,
      flow: "bericht",
      ...submitVariantFields(window.location.search),
    };
    const showResult = (notice: string) => {
      setMailNotice(notice);
      setSent(true);
    };
    const hideResult = () => {
      setMailNotice("");
      setSent(false);
    };
    let leadAccepted = false;
    setMailNotice(AMPEL_RESULT_MAIL.sending);
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
        noteAmpelReportSent(response.status);
        hideResult();
        if (!data.honeypot) setMailError(data.error || AMPEL_RESULT_MAIL.invalidEmail);
        return;
      }
      if (response.status === 429) {
        noteAmpelReportSent(response.status);
        showResult(data.notice || AMPEL_RESULT_MAIL.rateLimitedEmail);
        return;
      }
      if (data.duplicate) {
        noteAmpelReportSent(response.status);
        showResult(data.notice || AMPEL_RESULT_MAIL.alreadySent);
        return;
      }
      if (!response.ok || !data.ok) {
        noteAmpelReportSent(response.status);
        showResult(data.error || data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
        return;
      }
      if (data.pending) {
        if (!data.token) {
          noteAmpelReportSent(response.status, true);
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
          noteAmpelReportSent(follow.status, true);
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
          if (aborted) noteAmpelReportSent(0, false, true);
          showResult(ampelSendStatusNotice({ email, aborted, status: 0, ok: false }));
        } finally {
          clearTimeout(timer);
        }
        return;
      }
      if (data.mailed === false) {
        noteAmpelReportSent(response.status);
        showResult(data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
        return;
      }
      leadAccepted = true;
      noteAmpelReportSent(response.status);
      showResult(data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
    } catch (error) {
      const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      if (aborted) noteAmpelReportSent(0, false, true);
      showResult(aborted ? AMPEL_RESULT_MAIL.sendInterrupted : AMPEL_RESULT_MAIL.offline);
    } finally {
      if (leadAccepted) {
        trackAmpelCheckSubmit();
        // Ads-Conversion ampel_report_sent: nur nach angenommenem Versand (2xx) und nur mit Marketing-Einwilligung.
        trackAmpelReportConversion(scoreAmpelCheck(answers)?.light ?? "");
      }
      setPending(false);
    }
  }

  return (
    <>
      <p className="kicker">{AMPEL_CHECK_KICKER}</p>
      <h1>{AMPEL_V2_COPY.h1}</h1>
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
              <p>{ampelV2Explanation(question.id, question.explanation)}</p>
              <p className="ampel-quelle">Quelle: {publicAmpelSource(question.source)}</p>
            </details>
            {step > 0 ? (
              <p className="actions">
                <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
                  Zurück
                </button>
              </p>
            ) : null}
          </section>
          <p className="hint ampel-orientierung">{AMPEL_CHECK_HINT}</p>
        </>
      ) : null}

      {mode === "result" && encoded ? (
        <div ref={resultRef} className="ampel-v2-result" data-ampel-variant="ohne-email">
          <AmpelResultNoEmail answers={answers} />
          {sent ? (
            <section className="card ampel-mail" role="status">
              <h2>{AMPEL_V2_COPY.sentHeading}</h2>
              {mailNotice ? <p>{mailNotice}</p> : null}
              <p>{AMPEL_V2_COPY.sentText}</p>
            </section>
          ) : (
            <form ref={offerRef} className="card ampel-mail ampel-report-offer" noValidate onSubmit={sendResult}>
              <h2>{AMPEL_V2_COPY.offerHeading}</h2>
              <p>{AMPEL_V2_COPY.offerIntro}</p>
              <ul>
                {AMPEL_V2_COPY.offerBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
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
                  <WithDseLink text={AMPEL_V2_COPY.emailPrivacyNote} />
                </p>
              </div>
              <div className="field ampel-consent">
                <label className="check" htmlFor="ampel-marketing">
                  <input
                    id="ampel-marketing"
                    name="marketing"
                    type="checkbox"
                    checked={marketing}
                    onChange={(event) => setMarketing(event.target.checked)}
                  />
                  <span>
                    <WithDseLink text={AMPEL_V2_COPY.marketingConsent} />
                  </span>
                </label>
              </div>
              <p className="actions">
                <button className="btn ampel-submit" type="submit" disabled={pending}>
                  {pending ? "Wird gesendet …" : AMPEL_V2_COPY.offerButton}
                </button>
              </p>
            </form>
          )}
          <p className="actions">
            <button type="button" className="btn ghost" onClick={restart}>
              Antworten ändern
            </button>
          </p>
          <div onClickCapture={onProductClick}>
            <AmpelCta price={ctaPrice} />
          </div>
        </div>
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
      <p className="hint">{AMPEL_V2_COPY.disclaimerLong}</p>
      <AmpelDisclaimer />
    </>
  );
}
