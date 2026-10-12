import { accessForRows, type LifecycleAccess } from "@/lib/kuendigung";
import { listLifecycleByEmail } from "@/lib/kuendigung-store";

const OPEN: LifecycleAccess = {
  writesOpen: true,
  downloadsOpen: true,
  writeMessage: "",
  downloadMessage: "",
};

async function accessForEmail(email: string): Promise<LifecycleAccess> {
  const normalized = email.trim();
  if (!normalized) return OPEN;
  try {
    return accessForRows(await listLifecycleByEmail(normalized));
  } catch (error) {
    console.error("[kuendigung] Lifecycle lesen fehlgeschlagen", error);
    return OPEN;
  }
}

export async function subscriptionWriteDenial(
  email: string | null | undefined,
): Promise<string | null> {
  const access = await accessForEmail(email ?? "");
  return access.writesOpen ? null : access.writeMessage;
}

export async function subscriptionDownloadDenial(email: string): Promise<string | null> {
  const access = await accessForEmail(email);
  return access.downloadsOpen ? null : access.downloadMessage;
}
