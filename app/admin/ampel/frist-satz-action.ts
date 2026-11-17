"use server";

import { isAmpelAdminEmail } from "@/lib/ampel-admin";
import { getSessionEmail } from "@/lib/auth";
import { deniedFristSatzView, scanFristSatzForAdmin } from "@/lib/frist-satz";
import { createFristSatzIo } from "@/lib/frist-satz-sources";
import type { FristSatzView } from "@/lib/frist-satz-view";

function formText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** Button on the existing admin page. Reads only, and only after this POST. */
export async function scanFristSatzAction(
  _prev: FristSatzView,
  formData: FormData,
): Promise<FristSatzView> {
  const now = new Date();
  const email = await getSessionEmail();
  if (!isAmpelAdminEmail(email)) return deniedFristSatzView(now);
  return scanFristSatzForAdmin(
    email,
    { mode: formText(formData.get("mode")), cursor: formText(formData.get("cursor")) },
    createFristSatzIo(),
    now,
  );
}
