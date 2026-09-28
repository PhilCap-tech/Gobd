# GoBD Delivery — Content-Templates v3.0.0

Kundenwortlaut kommt aus diesem Ordner (Delivery bundle 4.0.0, Outline v4). Präsens nur bei bestätigter Angabe. Sonst Hinweis oder offener Punkt. Kapitel 6 nur bei Papier, dem Wort Post oder Scan. Ausgangskapitel nur bei genanntem Ausgang. Stripe, Stub und Regeln mit `customerFacing: false` erscheinen nicht in der Kunden-PDF.

Maßgeblich: `OUTLINE-v4.md`, `QUALITY-RULES-v3.md`, `FIXTURE-CHECKLIST-v3.md`, `sample-intake-partner-trust.json`.

Bundle neu bauen:

```bash
node content/delivery-templates/build-bundle.mjs
```

`identity.stripeSessionId`, `identity.stripeCustomerId` und `identity.stub` bleiben für Checkout und Webhook in der Identität. Sie stehen nicht im Kundendokument.
