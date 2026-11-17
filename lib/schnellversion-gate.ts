import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { parseSvArm, SV_ARM_COOKIE } from "@/lib/schnellversion-assign";
import { schnellversionOffered } from "@/lib/schnellversion-flag";

/** Flag aus: 404. Ohne Testarm: zurück auf die Startseite. */
export async function requireSchnellversionTest(): Promise<void> {
  if (!schnellversionOffered()) notFound();
  const jar = await cookies();
  if (parseSvArm(jar.get(SV_ARM_COOKIE)?.value) !== "test") redirect("/");
}
