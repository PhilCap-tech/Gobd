# GoBD Delivery — Content-Templates v3.0.0

Kundenwortlaut kommt aus diesem Ordner (Delivery v3). Präsens nur bei bestätigter Angabe. Sonst Hinweis oder offener Punkt. Papierabschnitte nur bei Papier-/Scan-Token. Stripe, Stub und Regeln mit `customerFacing: false` erscheinen nicht in der Kunden-PDF.

Maßgeblich: `QUALITY-RULES-v3.md`, `OUTLINE-v3.md`, `FIXTURE-CHECKLIST-v3.md`, `sample-intake-partner-trust.json`.

Bundle neu bauen:

```bash
node content/delivery-templates/build-bundle.mjs
```

`identity.stripeSessionId`, `identity.stripeCustomerId` und `identity.stub` bleiben für Checkout und Webhook in der Identität. Sie stehen nicht im Kundendokument.
