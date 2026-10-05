import { permanentRedirect } from "next/navigation";
import { isBereichId } from "@/lib/bereiche";
import { redirectForBereichMuster } from "@/lib/module-muster";

type Params = { params: Promise<{ bereich: string }> };

export default async function MusterBereichRedirect({ params }: Params) {
  const { bereich } = await params;
  if (!isBereichId(bereich)) {
    permanentRedirect("/muster");
  }
  permanentRedirect(redirectForBereichMuster(bereich));
}
