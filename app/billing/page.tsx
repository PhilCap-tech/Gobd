import type { Metadata } from "next";
import { redirectToStripePortalOrAccount } from "@/lib/portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abo-Portal",
  robots: { index: false, follow: false },
};

export default async function BillingPage() {
  await redirectToStripePortalOrAccount();
}
