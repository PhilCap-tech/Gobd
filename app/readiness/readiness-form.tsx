"use client";

import { useState } from "react";

export function ReadinessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card">
        <h2>Danke, {name.trim()}.</h2>
        <p className="prose">Readiness-Check — kommt als Nächstes</p>
        <p className="hint">Keine Zahlung. Keine Kreditkarte. Kein Stripe.</p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="readiness-name">Name</label>
        <input
          id="readiness-name"
          name="name"
          autoComplete="name"
          placeholder="Max Mustermann"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="readiness-email">E-Mail</label>
        <input
          id="readiness-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="du@firma.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="readiness-company">Firma (optional)</label>
        <input
          id="readiness-company"
          name="company"
          autoComplete="organization"
          placeholder="Muster GmbH"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <button className="btn" type="submit">
        Readiness-Check vormerken
      </button>
      <p className="hint">Kostenlos. Keine Kreditkarte. Keine Zahlung.</p>
    </form>
  );
}
