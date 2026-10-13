import {
  breadcrumbJsonLd,
  type Crumb,
  type JsonLdNode,
} from "@/lib/jsonld";

export function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function CrumbJsonLd({ items }: { items: Crumb[] }) {
  return <JsonLd data={breadcrumbJsonLd(items)} />;
}
