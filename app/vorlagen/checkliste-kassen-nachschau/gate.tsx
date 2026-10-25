"use client";

import { useEffect } from "react";
import { VorlagenGate } from "@/components/vorlagen-gate";
import { MAGNET_GATE_INTRO } from "@/lib/vorlagen/copy";
import { sendMagnetView } from "@/lib/vorlagen/step-beacon";

export function ChecklisteGate() {
  useEffect(() => {
    sendMagnetView("checkliste-kassen-nachschau");
  }, []);
  return <VorlagenGate magnet="checkliste-kassen-nachschau" intro={MAGNET_GATE_INTRO} />;
}
