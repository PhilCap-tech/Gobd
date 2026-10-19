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
    document.documentElement.classList.toggle("consent-pending", visible);
    document.body.classList.toggle("consent-open", visible);
    return () => {
      document.documentElement.classList.remove("consent-pending");
      document.body.classList.remove("consent-open");
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="consent-banner"
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
    >
      <span id="consent-title" className="consent-title">
        Cookies
      </span>
      <div className="consent-banner-inner shell">
        <p id="consent-text">
          {partner
            ? "Essenzielle Cookies brauchen wir für den Betrieb (zum Beispiel die Anmeldung). "
            : "Essenzielle Cookies brauchen wir für den Betrieb (zum Beispiel Anmeldung und Stripe-Checkout). "}
          {
            "Optionales Marketing laden wir nur, wenn Sie zustimmen. Das sind Google Analytics 4 (Mess-ID G-RJ4KLBP1SF) und Google Ads (Konto AW-586367190, einschließlich Conversion-Messung). Ein Meta-Pixel laden wir nur, wenn eine Pixel-ID konfiguriert ist; derzeit ist keine hinterlegt. Ohne Zustimmung laden wir diese Tags nicht und senden keine Anzeigenanfrage."
          }{" "}
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
    </div>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" className="footer-text-btn" onClick={openConsentBanner}>
      Cookie-Einstellungen
    </button>
  );
}
