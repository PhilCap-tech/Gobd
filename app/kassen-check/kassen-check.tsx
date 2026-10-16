"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AMPEL_MARKETING_CONSENT,
  AMPEL_RESULT_MAIL,
  ampelSendStatusNotice,
  type AmpelAnswer,
} from "@/lib/ampel-questions";
import {
  decodeAmpelAnswers,
  encodeAmpelAnswers,
  publicAmpelSource,
  sanitizeAmpelRef,
  type AmpelAnswerMap,
} from "@/lib/ampel-score";
import { scoreKassen } from "@/lib/kassen-check-score";
import { trackLeadSubmit } from "@/lib/tracking";
import {
  KASSEN_CHECK_PATH,
  KASSEN_CTA_SECONDARY,
  KASSEN_CTA_SOFT,
  KASSEN_DISCLAIMER,
  KASSEN_H1,
  KASSEN_INTRO,
  kassenOffersNotApplicable,
  KASSEN_OPT_IN,
  KASSEN_QUESTIONS,
  KASSEN_RESULTS,
  KASSEN_SENT_NOTICE,
  KASSEN_WEITER,
} from "@/lib/kassen-check-questions";

function emailLooksValid(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function WeiterHinweis() {
  const readiness = "Readiness-Check";
  const ampel = "Ampel-Check";
  const [before, rest] = KASSEN_WEITER.split(readiness);
  const [middle, after] = (rest ?? "").split(ampel);
  return (
    <p>
      {before}
      <Link href={KASSEN_CTA_SOFT}>{readiness}</Link>
      {middle}
      <Link href={KASSEN_CTA_SECONDARY}>{ampel}</Link>
      {after}
    </p>
  );
}

export function KassenCheck() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = decodeAmpelAnswers(searchParams.get("a") ?? "", KASSEN_QUESTIONS);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AmpelAnswerMap>(initial ?? {});
  const [showResult, setShowResult] = useState(Boolean(initial));
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [fax, setFax] = useState("");
  const [pending, setPending] = useState(false);
  const [mailError, setMailError] = useState("");
  const [mailNotice, setMailNotice] = useState("");
  const refName = sanitizeAmpelRef(searchParams.get("ref") ?? "");

  const question = KASSEN_QUESTIONS[step];
  const encoded = useMemo(() => encodeAmpelAnswers(answers, KASSEN_QUESTIONS), [answers]);
  const scored = encoded ? scoreKassen(answers) : null;
  const band = scored ? KASSEN_RESULTS[scored.light] : null;

  function remember(code: string) {
    const params = new URLSearchParams();
    params.set("a", code);
    if (refName) params.set("ref", refName);
    router.replace(`${KASSEN_CHECK_PATH}?${params.toString()}`);
  }

  function choose(answer: AmpelAnswer) {
    if (!question) return;
    const next = { ...answers, [question.id]: answer };
    setAnswers(next);
    if (step < KASSEN_QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }
    const code = encodeAmpelAnswers(next, KASSEN_QUESTIONS);
    if (!code) return;
    setMailError("");
    setShowResult(true);
    remember(code);
  }

  function editAnswers() {
    setMailError("");
    setShowResult(false);
    setStep(Math.max(KASSEN_QUESTIONS.length - 1, 0));
  }

  async function sendResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!encoded || pending) return;
    if (!emailLooksValid(email)) {
      setMailError(AMPEL_RESULT_MAIL.invalidEmail);
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
    };
    let leadAccepted = false;
    setMailNotice(AMPEL_RESULT_MAIL.sending);
    try {
      const response = await fetch("/api/kassen-check/ergebnis", {
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
      if (data.honeypot) {
        setMailNotice(KASSEN_SENT_NOTICE);
        return;
      }
      if (response.status === 400) {
        setMailNotice("");
        setMailError(data.error || AMPEL_RESULT_MAIL.invalidEmail);
        return;
      }
      if (response.status === 429) {
        setMailNotice(data.notice || AMPEL_RESULT_MAIL.rateLimitedEmail);
        return;
      }
      if (data.duplicate) {
        setMailNotice(data.notice || AMPEL_RESULT_MAIL.alreadySent);
        return;
      }
      if (!response.ok || !data.ok) {
        setMailNotice(data.error || data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
        return;
      }
      if (data.pending) {
        if (!data.token) {
          setMailNotice(AMPEL_RESULT_MAIL.shownWithoutMail);
          return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        try {
          const follow = await fetch("/api/kassen-check/ergebnis/senden", {
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
          setMailNotice(
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
          setMailNotice(ampelSendStatusNotice({ email, aborted, status: 0, ok: false }));
        } finally {
          clearTimeout(timer);
        }
        return;
      }
      if (data.mailed === false) {
        setMailNotice(data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
        return;
      }
      leadAccepted = true;
      setMailNotice(data.notice || AMPEL_RESULT_MAIL.shownWithoutMail);
    } catch (error) {
      const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      setMailNotice(aborted ? AMPEL_RESULT_MAIL.sendInterrupted : AMPEL_RESULT_MAIL.offline);
    } finally {
      if (leadAccepted) trackLeadSubmit({ value: 1, currency: "EUR" });
      setPending(false);
    }
  }

  return (
    <>
      <h1>{KASSEN_H1}</h1>
      <p className="lead">{KASSEN_INTRO}</p>

      {!showResult && question ? (
        <section className="card ampel-question" aria-labelledby="kassen-question-title">
          <p className="ampel-progress">
            Frage {step + 1} von {KASSEN_QUESTIONS.length}
          </p>
          <h2 id="kassen-question-title">{question.question}</h2>
          <p>{question.explanation}</p>
          <p className="ampel-quelle">Quelle: {publicAmpelSource(question.source)}</p>
          <div className="ampel-choices" role="group" aria-label="Antwort">
            <button
              type="button"
              className="btn"
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
            {kassenOffersNotApplicable(question) ? (
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
          {step > 0 ? (
            <p className="actions">
              <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
                Zurück
              </button>
            </p>
          ) : null}
        </section>
      ) : null}

      {showResult && band && encoded ? (
        <>
          {mailNotice ? (
            <p className="card" role="status">
              {mailNotice}
            </p>
          ) : null}
          <section className={`ampel-banner ${scored?.light ?? "gelb"}`} aria-labelledby="kassen-result-title">
            <h2 id="kassen-result-title">{band.headline}</h2>
            <p>{band.text}</p>
          </section>
          <p className="hint">{KASSEN_DISCLAIMER}</p>
          <WeiterHinweis />
          <form className="card ampel-mail" noValidate onSubmit={sendResult}>
            <h2>{KASSEN_OPT_IN.heading}</h2>
            <p>{KASSEN_OPT_IN.text}</p>
            <div className="ampel-honeypot" aria-hidden="true">
              <label htmlFor="kassen-fax">Fax</label>
              <input
                id="kassen-fax"
                name="fax_number"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={fax}
                onChange={(event) => setFax(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="kassen-email">{KASSEN_OPT_IN.field}</label>
              <input
                id="kassen-email"
                name="email"
                type="email"
                autoComplete="email"
                aria-describedby="kassen-email-hint"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p id="kassen-email-hint" className="hint">
                {KASSEN_OPT_IN.hintBefore}
                <Link href="/datenschutz">{KASSEN_OPT_IN.hintLink}</Link>
                {KASSEN_OPT_IN.hintAfter}
              </p>
            </div>
            <div className="field">
              <label className="check" htmlFor="kassen-marketing">
                <input
                  id="kassen-marketing"
                  name="marketing"
                  type="checkbox"
                  checked={marketing}
                  onChange={(event) => setMarketing(event.target.checked)}
                />
                <span>{AMPEL_MARKETING_CONSENT}</span>
              </label>
            </div>
            {mailError ? (
              <p className="hint" role="alert">
                {mailError}
              </p>
            ) : null}
            <p className="actions">
              <button className="btn" type="submit" disabled={pending}>
                {pending ? "Wird gesendet …" : KASSEN_OPT_IN.button}
              </button>
              <button type="button" className="btn ghost" onClick={editAnswers}>
                Antworten ändern
              </button>
            </p>
          </form>
        </>
      ) : null}
    </>
  );
}
