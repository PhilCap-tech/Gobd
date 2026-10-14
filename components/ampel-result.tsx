import Link from "next/link";
import {
  AMPEL_CAP_NOTE,
  AMPEL_CTA,
  AMPEL_DISCLAIMER,
  AMPEL_RESULTS,
} from "@/lib/ampel-questions";
import {
  ampelNeinQuestions,
  publicAmpelSource,
  scoreAmpel,
  type AmpelAnswerMap,
} from "@/lib/ampel-score";

export function AmpelResult({ answers }: { answers: AmpelAnswerMap }) {
  const scored = scoreAmpel(answers);
  if (!scored) return null;
  const band = AMPEL_RESULTS[scored.light];
  const nein = ampelNeinQuestions(answers);
  return (
    <section className={`ampel-banner ${scored.light}`} aria-label={`Ampel ${band.label}`}>
      <p className="ampel-kicker">{band.label}</p>
      <p className="ampel-score">
        {scored.score} von 100
      </p>
      <h2>{band.headline}</h2>
      <p>{band.text}</p>
      {scored.capped ? <p className="ampel-cap">{AMPEL_CAP_NOTE}</p> : null}
      {nein.length > 0 ? (
        <div className="ampel-nein">
          <h3>Mit Nein beantwortet</h3>
          <ul>
            {nein.map((question) => (
              <li key={question.id}>
                <strong>{question.question}</strong>
                <span>{question.explanation}</span>
                <span className="ampel-quelle">Quelle: {publicAmpelSource(question.source)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <h3>Hinweise</h3>
      <ul>
        {band.hints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>
    </section>
  );
}

export function AmpelCta() {
  return (
    <aside className="card ampel-cta">
      <h2>{AMPEL_CTA.headline}</h2>
      <p>{AMPEL_CTA.text}</p>
      <p className="ampel-price">{AMPEL_CTA.price}</p>
      <p className="actions">
        <Link className="btn" href="/checkout">
          {AMPEL_CTA.button}
        </Link>
        <Link className="btn ghost" href="/#ablauf">
          {AMPEL_CTA.secondary}
        </Link>
      </p>
    </aside>
  );
}

export function AmpelDisclaimer() {
  return <p className="hint ampel-disclaimer">{AMPEL_DISCLAIMER}</p>;
}
