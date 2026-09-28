# GoBD Delivery — Content-Templates v3.0.0

Kundenwortlaut kommt aus diesem Ordner. Die Kapiteldateien sind das Delivery-v4-Markdown (`chapters/00-cover-freigabe.md` bis `chapters/B-begriffe.md`) als Zwischenadapter. `VERSION` und `bundle.json` bleiben 3.0.0, bis Delivery `chapter-schema.json` und `bundle.json` 4.0.0 liefert. Präsens nur bei bestätigter Angabe. Sonst Hinweis oder offener Punkt. Papierabschnitte nur bei Papier-/Scan-Token. Stripe, Stub und Regeln mit `customerFacing: false` erscheinen nicht in der Kunden-PDF.

Maßgeblich: `OUTLINE-v4.md`, `QUALITY-RULES-v3.md`, `FIXTURE-CHECKLIST-v3.md`, `sample-intake-partner-trust.json`.

Bundle neu bauen:

```bash
node content/delivery-templates/build-bundle.mjs
```

`identity.stripeSessionId`, `identity.stripeCustomerId` und `identity.stub` bleiben für Checkout und Webhook in der Identität. Sie stehen nicht im Kundendokument.
