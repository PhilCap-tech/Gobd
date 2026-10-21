"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { sendAmpelConsentChoice } from "@/lib/ampel-step-beacon";
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
    <button type="button" className="footer-text-btn" onClick={openConsentBanner}>
      Cookie-Einstellungen
    </button>
  );
}
