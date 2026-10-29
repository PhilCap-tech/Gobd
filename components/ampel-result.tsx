import Link from "next/link";
import { CampaignLink } from "@/components/campaign-link";
import {
  AMPEL_CAP_NOTE,
  AMPEL_CTA,
  AMPEL_DISCLAIMER,
  AMPEL_QUELLEN_PATH,
  AMPEL_RESULTS,
} from "@/lib/ampel-questions";
import {
  ampelNeinQuestions,
  publicAmpelSource,
  type AmpelAnswerMap,
} from "@/lib/ampel-score";
import { scoreAmpelCheck } from "@/lib/ampel-check-score";

export function AmpelResult({ answers }: { answers: AmpelAnswerMap }) {
  const scored = scoreAmpelCheck(answers);
  if (!scored) return null;
  const band = AMPEL_RESULTS[scored.light];
  const nein = ampelNeinQuestions(answers);
  return (
    <section className={`ampel-banner ${scored.light}`} aria-label={`Ampel ${band.label}`}>
      <p className="ampel-kicker">{band.label}</p>
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

/** `price`: vom Server (Preismodell v2), weil der Client PRICING_MODEL nicht kennt. */
export function AmpelCta({ price = AMPEL_CTA.price }: { price?: string } = {}) {
  return (
    <aside className="card ampel-cta">
      <h2>{AMPEL_CTA.headline}</h2>
      <p>{AMPEL_CTA.text}</p>
      <p className="ampel-price">{price}</p>
      <p className="actions">
        <CampaignLink className="btn" href="/checkout">
          {AMPEL_CTA.button}
        </CampaignLink>
        <Link className="btn ghost" href="/#ablauf">
          {AMPEL_CTA.secondary}
        </Link>
      </p>
    </aside>
  );
}

export function AmpelDisclaimer() {
  return (
    <p className="hint ampel-disclaimer">
      {AMPEL_DISCLAIMER}{" "}
      <Link href={AMPEL_QUELLEN_PATH}>Quellen & Methodik</Link>
    </p>
  );
}
