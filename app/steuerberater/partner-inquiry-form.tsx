"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { PARTNER_INQUIRY_HONEYPOT_FIELD } from "@/lib/partner-inquiry";

type Fields = {
  name: string;
  kanzlei: string;
  email: string;
  mandantenZahl: string;
  message: string;
  companyWebsite: string;
};

const INITIAL: Fields = {
  name: "",
  kanzlei: "",
  email: "",
  mandantenZahl: "",
  message: "",
  companyWebsite: "",
};

export function PartnerInquiryForm() {
  const [form, setForm] = useState<Fields>(INITIAL);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  function patch(partial: Partial<Fields>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/partner-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          kanzlei: form.kanzlei,
          email: form.email,
          mandantenZahl: form.mandantenZahl,
          message: form.message,
          [PARTNER_INQUIRY_HONEYPOT_FIELD]: form.companyWebsite,
        }),
      });
      let data: { error?: string; ok?: boolean } = {};
      try {
        const text = await response.text();
        if (text.trim()) data = JSON.parse(text) as typeof data;
      } catch {
        data = {};
      }
      if (!response.ok || !data.ok) {
        setError(
          data.error ||
            "Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="banner ok" role="status">
        Vielen Dank. Wir haben Ihre Anfrage erhalten und melden uns per E-Mail.
      </p>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="partner-name">Name</label>
        <input
          id="partner-name"
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="partner-kanzlei">Kanzlei</label>
        <input
          id="partner-kanzlei"
          name="kanzlei"
          autoComplete="organization"
          required
          maxLength={120}
          value={form.kanzlei}
          onChange={(event) => patch({ kanzlei: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="partner-email">E-Mail</label>
        <input
          id="partner-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={form.email}
          onChange={(event) => patch({ email: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="partner-mandanten">Grobe Mandanten-Zahl</label>
        <input
          id="partner-mandanten"
          name="mandantenZahl"
          inputMode="numeric"
          required
          min={1}
          max={100000}
          step={1}
          placeholder="z. B. 40"
          value={form.mandantenZahl}
          onChange={(event) => patch({ mandantenZahl: event.target.value })}
        />
        <p className="hint">Ungefähre Anzahl als ganze Zahl, keine Mandantenliste.</p>
      </div>
      <div className="field">
        <label htmlFor="partner-message">Nachricht</label>
        <textarea
          id="partner-message"
          name="message"
          required
          maxLength={4000}
          rows={5}
          value={form.message}
          onChange={(event) => patch({ message: event.target.value })}
        />
      </div>
      <div hidden aria-hidden="true">
        <label htmlFor="partner-company-website">Website</label>
        <input
          id="partner-company-website"
          name={PARTNER_INQUIRY_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.companyWebsite}
          onChange={(event) => patch({ companyWebsite: event.target.value })}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Wird gesendet…" : "Anfrage senden"}
        </button>
      </div>
      <p className="hint">
        Mit dem Absenden gehen Name, Kanzlei, E-Mail, Mandanten-Zahl und Nachricht
        an{" "}
        <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>.
        Die Anfrage ist unverbindlich. Auf dieser Seite gibt es keinen Bestellweg.
        Hinweise zur Verarbeitung stehen in der{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </form>
  );
}
