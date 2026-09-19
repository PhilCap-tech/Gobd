"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  READINESS_ARCHIV,
  READINESS_BELEGE,
  READINESS_BRANCHES,
  READINESS_DOKUMENTATION,
} from "@/lib/readiness";

export function ReadinessForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [branche, setBranche] = useState("");
  const [belege, setBelege] = useState("");
  const [dokumentation, setDokumentation] = useState("");
  const [archiv, setArchiv] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          branche,
          belege,
          dokumentation,
          archiv,
        }),
      });
      let data: { error?: string; documentId?: string } = {};
      try {
        const text = await response.text();
        if (text.trim()) {
          data = JSON.parse(text) as typeof data;
        }
      } catch {
        data = {};
      }
      if (!response.ok || !data.documentId) {
        setError(data.error || "Absenden fehlgeschlagen.");
        return;
      }
      router.push(`/readiness/success?id=${encodeURIComponent(data.documentId)}`);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
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
      <div className="field">
        <label htmlFor="readiness-branche">Branche</label>
        <select
          id="readiness-branche"
          name="branche"
          value={branche}
          onChange={(e) => setBranche(e.target.value)}
          required
        >
          <option value="">Bitte wählen</option>
          {READINESS_BRANCHES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="readiness-belege">Wie führst du deine Belege?</label>
        <select
          id="readiness-belege"
          name="belege"
          value={belege}
          onChange={(e) => setBelege(e.target.value)}
          required
        >
          <option value="">Bitte wählen</option>
          {READINESS_BELEGE.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="readiness-dokumentation">
          Hast du bereits eine Verfahrensdokumentation?
        </label>
        <select
          id="readiness-dokumentation"
          name="dokumentation"
          value={dokumentation}
          onChange={(e) => setDokumentation(e.target.value)}
          required
        >
          <option value="">Bitte wählen</option>
          {READINESS_DOKUMENTATION.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="readiness-archiv">Wo archivierst du Belege?</label>
        <select
          id="readiness-archiv"
          name="archiv"
          value={archiv}
          onChange={(e) => setArchiv(e.target.value)}
          required
        >
          <option value="">Bitte wählen</option>
          {READINESS_ARCHIV.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Erzeuge PDF…" : "PDF kostenlos erhalten"}
      </button>
      <p className="hint">Kostenlos. Keine Kreditkarte. Keine Zahlung.</p>
      <p className="disclaimer" role="note">
        Keine Steuerberatung und kein Steuerberatungsersatz. Keine Zusicherung
        der GoBD-Konformität. Du erhältst eine branchenbezogene Arbeitshilfe —
        keine fertige Verfahrensdokumentation.
      </p>
    </form>
  );
}
