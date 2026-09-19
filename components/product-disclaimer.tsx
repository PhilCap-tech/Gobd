import { LegalMarkdown } from "@/lib/legal-markdown";
import { produktDisclaimerMarkdown } from "@/lib/legal-content";

export function ProductDisclaimer({
  className = "disclaimer product-disclaimer",
}: {
  className?: string;
}) {
  return (
    <div className={className} role="note">
      <LegalMarkdown source={produktDisclaimerMarkdown} />
    </div>
  );
}
