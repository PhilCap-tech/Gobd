export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_SETUP_ID &&
      process.env.STRIPE_PRICE_MONTHLY_ID,
  );
}

export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );
}

export function getSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_TAB || "intakes";
}
