import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Neues Preismodell (28.10.): Einstieg aus Mail bzw. Login. Gekauft wird im
 * Konto (Karte mit Knopf, POST /api/checkout); ohne Anmeldung erst zum Login.
 */
export default async function Page() {
  const email = await getSessionEmail();
  if (!email) redirect("/login?next=" + encodeURIComponent("/checkout/jahrespaket"));
  redirect("/account#frist");
}
