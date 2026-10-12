"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname() || "";
  const partner = pathname.startsWith("/steuerberater");
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
      aria-label="Cookies"
      aria-describedby="consent-text"
    >
      <div className="consent-banner-inner shell">
        <p id="consent-text">
          {partner ? (
            <>
              Essenzielle Cookies brauchen wir für den Betrieb (zum Beispiel
              die Anmeldung). Optionales Marketing (Google Ads inklusive
              Conversion-Messung, Google Analytics, Meta Pixel) läuft nur,
              wenn Sie zustimmen. Ohne Zustimmung laden wir diese Tags nicht
              und senden keine Anzeigenanfrage.
            </>
          ) : (
            <>
              Essenzielle Cookies brauchen wir für den Betrieb (z. B. Login und
              Stripe-Checkout). Optionales Marketing (Google Ads inklusive
              Conversion-Messung, Google Analytics, Meta Pixel) läuft nur,
              wenn Sie zustimmen. Ohne Zustimmung laden wir diese Tags nicht
              und senden keine Anzeigenanfrage.
            </>
          )}
          {" "}
          <Link href="/cookies">Cookie-Hinweis</Link>
        </p>
        <div className="consent-actions">
          <button
            type="button"
            className="btn consent-choice"
            onClick={() => saveConsent(false)}
          >
            Ablehnen
          </button>
          <button
            type="button"
            className="btn consent-choice"
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
