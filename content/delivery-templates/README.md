# Delivery-Templates v1

Single source: `bundle.json`. The PDF builder fills placeholders locally from Intake + Checkout identity. There is no live Delivery HTTP API in v1.

## Placeholders

| Token | Source |
| --- | --- |
| `{{identity.email}}` `{{identity.company}}` `{{identity.stripeSessionId}}` `{{identity.stripeCustomerId}}` | CheckoutIdentity |
| `{{answers.branchen}}` … camelCase IntakeAnswers | Intake; arrays joined with `", "` |
| empty string / empty array | `nicht angegeben` |
| `{{openPointsTable}}` | evaluated `openPointsRules` |
| `{{generatedAt}}` | render time (`de-DE`) |
| `{{disclaimer}}` | `bundle.disclaimer` |
| `{{documentId}}` `{{bundleVersion}}` | document meta |

## Open-point rules

If `always` is true, the item is always listed. Otherwise `field` is read from `answers`; empty string or empty array includes the item. Severity: `low` \| `medium` \| `high`.

## PDF order

Cover → chapters in bundle order (01–06) → disclaimer footer.

No GoBD legal prose beyond this file.
