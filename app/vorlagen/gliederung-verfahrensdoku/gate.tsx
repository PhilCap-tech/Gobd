"use client";

import { useEffect } from "react";
import { VorlagenGate } from "@/components/vorlagen-gate";
import { MAGNET_GATE_INTRO } from "@/lib/vorlagen/copy";
import { sendMagnetView } from "@/lib/vorlagen/step-beacon";

export function GliederungGate() {
  useEffect(() => {
    sendMagnetView("gliederung-verfahrensdoku");
  }, []);
  return <VorlagenGate magnet="gliederung-verfahrensdoku" intro={MAGNET_GATE_INTRO} />;
}
