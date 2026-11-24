"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import home from "@/app/home.module.css";
import { HeroStartCtas } from "@/components/hero-start-ctas";
import { onConsentChange, postSvEvent, postSvVisit, syncSvArm } from "@/components/schnellversion-browser";
import { CTA_START, CTA_START_MICRO } from "@/lib/offer-copy";
import { SV_BUY_LABEL, SV_HERO_NOTE } from "@/lib/schnellversion-copy";
import type { SvArm } from "@/lib/schnellversion-assign";

const HERO_MICRO = "zzgl. 19 % USt · nur für Unternehmen · Keine Steuer- oder Rechtsberatung.";

/**
 * Gleicher Hero-Block wie die Startseite, plus Button nur im Testarm
 * und nur nach Einwilligung. Vor der Einwilligung bleibt der Block leer
 * von der Schnellversion: kein Cookie, kein zusätzlicher Button.
 */
export function SchnellversionHeroCtas() {
  const [arm, setArm] = useState<SvArm | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    function sync() {
      const next = syncSvArm();
      setArm(next);
      if (!next || sent.current) return;
      sent.current = true;
      void postSvEvent({ name: "sv_home_view", arm: next });
      if (next === "test") void postSvEvent({ name: "sv_block_view", arm: next });
    }
    sync();
    void postSvVisit();
    return onConsentChange(sync);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (!href.startsWith("/checkout")) return;
      if (!link.textContent?.includes(CTA_START)) return;
      const current = syncSvArm();
      if (!current) return;
      void postSvEvent({ name: "fragebogen_start", arm: current });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <HeroStartCtas
        extra={
          arm === "test" ? (
            <Link
              className={`btn ${home.btnSec}`}
              href="/schnellversion"
              onClick={() => {
                void postSvEvent({ name: "sv_click", arm: "test" });
              }}
            >
              {SV_BUY_LABEL}
            </Link>
          ) : null
        }
      />
      <p className={home.startMicro}>{CTA_START_MICRO}</p>
      <p className={home.micro}>{HERO_MICRO}</p>
      {arm === "test" ? <p className={home.svNote}>{SV_HERO_NOTE}</p> : null}
    </>
  );
}
