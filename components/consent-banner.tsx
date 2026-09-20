"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  getBannerOpen,
  openConsentBanner,
  saveConsent,
  subscribeBanner,
} from "@/lib/tracking";

function useClientReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ConsentBanner() {
  const ready = useClientReady();
  const open = useSyncExternalStore(
    subscribeBanner,
    getBannerOpen,
    () => false,
  );
  const visible = ready && open;

  useEffect(() => {
    document.body.classList.toggle("consent-open", visible);
    return () => document.body.classList.remove("consent-open");
  }, [visible]);

  if (!visible) return null;

  return (
    <aside
      className="consent-banner"
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
    >
      <div className="consent-banner-inner">
        <div>
          <h2 id="consent-title">Cookies</h2>
          <p id="consent-text">
            Essenzielle Cookies brauchen wir für den Betrieb (z. B. Login und
            Stripe-Checkout). Optionales Marketing (Google-Tag, Meta Pixel)
            läuft nur, wenn du zustimmst. Ohne Zustimmung laden wir diese Tags
            nicht.
            {" "}
            <Link href="/cookies">Cookie-Hinweis</Link>
          </p>
        </div>
        <div className="consent-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => saveConsent(false)}
          >
            Nur essenziell
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => saveConsent(true)}
          >
            Marketing erlauben
          </button>
        </div>
      </div>
    </aside>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" className="footer-text-btn" onClick={openConsentBanner}>
      Cookie-Einstellungen
    </button>
  );
}
