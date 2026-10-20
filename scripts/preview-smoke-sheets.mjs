/**
 * The preview smoke removes Sheets credentials so it cannot write the shared
 * production sheet. On Vercel a membership read then answers 503 with the
 * sheets retry copy and never reaches Blob. A real Sheets outage keeps the
 * credentials and must still fail the build.
 */
export const PREVIEW_SHEETS_RETRY_MESSAGE = "Bitte versuchen Sie es in einem Moment erneut.";

export function previewSmokeSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim(),
  );
}

export function previewSmokeSheetsClosed(result) {
  return (
    !previewSmokeSheetsConfigured() &&
    result?.status === 503 &&
    result?.json?.error === PREVIEW_SHEETS_RETRY_MESSAGE
  );
}
