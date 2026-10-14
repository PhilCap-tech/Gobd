"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AmpelCta, AmpelDisclaimer, AmpelResult } from "@/components/ampel-result";
import {
  AMPEL_EMAIL_PRIVACY_NOTE,
  AMPEL_H1,
  AMPEL_INTRO,
  AMPEL_MARKETING_CONSENT,
  AMPEL_QUESTIONS,
  AMPEL_RESULT_MAIL,
  AMPEL_SHARE_KANZLEI,
  type AmpelAnswer,
} from "@/lib/ampel-questions";
import {
  AMPEL_PATH,
  ampelSharePath,
  decodeAmpelAnswers,
  encodeAmpelAnswers,
  publicAmpelSource,
  sanitizeAmpelRef,
  type AmpelAnswerMap,
} from "@/lib/ampel-score";
import { trackAmpelResult, trackAmpelStart, trackLeadSubmit } from "@/lib/tracking";

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

export function AmpelCheck() {
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

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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

  function rememberAnswers(code: string) {
    const params = new URLSearchParams();
    params.set("a", code);
    if (refName) params.set("ref", refName);
    router.replace(`${AMPEL_PATH}?${params.toString()}`);
  }

  function choose(answer: AmpelAnswer) {
    if (!question) return;
    if (!startedRef.current) {
      startedRef.current = true;
      trackAmpelStart();
    }
    const next = { ...answers, [question.id]: answer };
    setAnswers(next);
    if (step < AMPEL_QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }
    const code = encodeAmpelAnswers(next);
    if (!code) return;
    setMailError("");
    setMode("email");
    rememberAnswers(code);
  }

  function editAnswers() {
    resultTrackedRef.current = false;
    setMailError("");
    setMode("questions");
    setStep(Math.max(AMPEL_QUESTIONS.length - 1, 0));
  }

  function restart() {
    resultTrackedRef.current = false;
    setMode("questions");
    setStep(0);
    setAnswers({});
    setMailNotice("");
    setMailError("");
    setMarketing(false);
    const params = new URLSearchParams();
    if (refName) params.set("ref", refName);
    const query = params.toString();
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
    if (!emailLooksValid(email)) {
      setMailError(AMPEL_RESULT_MAIL.invalidEmail);
      return;
    }
    setMailError("");
    setPending(true);
    try {
      const response = await fetch("/api/ampel/ergebnis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          answers: encoded,
          ref: refName,
          marketing,
          fax_number: fax,
        }),
      });
      let data: {
        ok?: boolean;
        error?: string;
        honeypot?: boolean;
        marketing?: string;
      } = {};
      try {
        data = (await response.json()) as typeof data;
      } catch {
        data = {};
      }
      if (!response.ok || !data.ok || data.honeypot) {
        if (!data.honeypot) {
          setMailError(data.error || AMPEL_RESULT_MAIL.sendFailed);
        }
        return;
      }
      trackLeadSubmit({ value: 1, currency: "EUR" });
      try {
        sessionStorage.setItem(shownKey(encoded), "1");
      } catch {
        // The result still shows for this view.
      }
      setMailNotice(
        data.marketing === "started"
          ? `${AMPEL_RESULT_MAIL.sent} ${AMPEL_RESULT_MAIL.doiSuccess}`
          : AMPEL_RESULT_MAIL.sent,
      );
      setMode("result");
    } catch {
      setMailError("Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p className="kicker">Kostenlos · etwa 2 Minuten</p>
      <h1>{AMPEL_H1}</h1>
      <p className="lead">{AMPEL_INTRO}</p>

      {mode === "questions" && question ? (
        <section className="card ampel-question" aria-labelledby="ampel-question-title">
          <p className="ampel-progress">
            Frage {step + 1} von {AMPEL_QUESTIONS.length}
          </p>
          <h2 id="ampel-question-title">{question.question}</h2>
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
          {step > 0 ? (
            <p className="actions">
              <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
                Zurück
              </button>
            </p>
          ) : null}
        </section>
      ) : null}

      {mode === "email" && encoded ? (
        <form className="card ampel-mail" noValidate onSubmit={sendResult}>
          <h2>{AMPEL_RESULT_MAIL.label}</h2>
          <p>Tragen Sie Ihre E-Mail-Adresse ein. Das Ergebnis erscheint danach auf dieser Seite, das PDF senden wir Ihnen zu.</p>
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
            <label htmlFor="ampel-email">E-Mail-Adresse</label>
            <input
              id="ampel-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-describedby="ampel-email-privacy"
              placeholder={AMPEL_RESULT_MAIL.placeholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p id="ampel-email-privacy" className="hint">
              <EmailPrivacyNote />
            </p>
          </div>
          <div className="field">
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
          {mailError ? (
            <p className="hint" role="alert">
              {mailError}
            </p>
          ) : null}
          <p className="actions">
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Wird gesendet …" : AMPEL_RESULT_MAIL.button}
            </button>
            <button type="button" className="btn ghost" onClick={editAnswers}>
              Antworten ändern
            </button>
          </p>
        </form>
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
          <AmpelCta />
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
