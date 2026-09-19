import { redirect } from "next/navigation";

export default async function MeineDokumentePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string" && first.trim()) {
      qs.set(key, first);
    }
  }
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  redirect(`/account${suffix}`);
}
