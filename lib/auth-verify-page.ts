/**
 * Bestätigungsseite für Aufrufe, die wie ein Link-Scanner aussehen.
 * Kein externes Asset. Der Token steht nur im versteckten Formularfeld.
 */

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildVerifyInterstitial(input: { token: string; next: string | null }): string {
  const nextField = input.next
    ? `<input type="hidden" name="next" value="${escapeAttr(input.next)}">`
    : "";
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="referrer" content="same-origin">
<title>Anmeldung</title>
</head>
<body>
<p>Bitte bestätigen Sie die Anmeldung.</p>
<form method="post" action="/auth/verify">
<input type="hidden" name="token" value="${escapeAttr(input.token)}">
${nextField}
<button type="submit">Anmelden</button>
</form>
</body>
</html>`;
}

export const VERIFY_INTERSTITIAL_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "same-origin",
  "X-Robots-Tag": "noindex",
  "Content-Security-Policy": "default-src 'none'; form-action 'self'; base-uri 'none'",
} as const;
