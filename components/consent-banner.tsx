"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { sendAmpelConsentChoice } from "@/lib/ampel-step-beacon";
import {
  closeReopenedConsentBanner,
  getBannerOpen,
  openConsentBanner,
  saveConsent,
  subscribeBanner,
} from "@/lib/tracking";

/** Footer-Button, der den Banner erneut geöffnet hat (Fokus-Rückgabe nach Esc/Auswahl). */
let reopenTrigger: HTMLElement | null = null;

function returnFocusToTrigger() {
  const trigger = reopenTrigger;
  reopenTrigger = null;
  if (trigger && trigger.isConnected) trigger.focus();
}

/**
 * Nach dem Öffnen über „Cookie-Einstellungen“: Banner (im Dokumentfluss oben, überdeckt nichts)
 * in den Blick scrollen und den Fokus darauf setzen. Ohne Animation bei prefers-reduced-motion.
 */
export function revealConsentBanner(): boolean {
  const node = document.querySelector<HTMLElement>(".consent-banner");
  if (!node) return false;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  node.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  node.focus({ preventScroll: true });
  return true;
}

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
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("consent-pending", visible);
    document.body.classList.toggle("consent-open", visible);
    return () => {
      document.documentElement.classList.remove("consent-pending");
      document.body.classList.remove("consent-open");
    };
  }, [visible]);

  useEffect(() => {
    const node = bannerRef.current;
    if (!visible || !node) {
      document.documentElement.style.removeProperty("--consent-banner-height");
      return;
    }
    const apply = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--consent-banner-height", `${height}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--consent-banner-height");
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      className="consent-banner"
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
      tabIndex={-1}
      onKeyDown={(event) => {
        // Esc schließt nur den erneut geöffneten Banner (Erstbesuch: Entscheidung bleibt nötig).
        if (event.key !== "Escape" || !reopenTrigger) return;
        event.preventDefault();
        closeReopenedConsentBanner();
        returnFocusToTrigger();
      }}
    >
      <span id="consent-title" className="consent-title">
        Cookies
      </span>
      <div className="consent-banner-inner shell">
        <p id="consent-text">
          Wir nutzen essenzielle Cookies für den Betrieb. Google Analytics und Google Ads (inkl.
          Conversion-Messung) laden wir nur mit Ihrer Zustimmung. <Link href="/cookies">Details</Link>
        </p>
        <div className="consent-actions">
          <button
            type="button"
            className="btn consent-choice"
            onClick={() => {
              sendAmpelConsentChoice("reject");
              saveConsent(false);
              returnFocusToTrigger();
            }}
          >
            Ablehnen
          </button>
          <button
            type="button"
            className="btn consent-choice"
            onClick={() => {
              sendAmpelConsentChoice("accept");
              saveConsent(true);
              returnFocusToTrigger();
            }}
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
    <button
      type="button"
      className="footer-text-btn"
      onClick={(event) => {
        reopenTrigger = event.currentTarget;
        openConsentBanner();
        // Nach dem Rendern: in den Blick scrollen und fokussieren.
        requestAnimationFrame(() => {
          if (!revealConsentBanner()) requestAnimationFrame(() => void revealConsentBanner());
        });
      }}
    >
      Cookie-Einstellungen
    </button>
  );
}
