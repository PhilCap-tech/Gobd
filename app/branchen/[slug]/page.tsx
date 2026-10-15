import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BranchenPage } from "@/components/branchen-page";
import {
  branchenPath,
  getBranchenSeite,
  listBranchenSeiten,
} from "@/lib/branchen";
import { canonicalUrl, withOgImage } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const seiten = await listBranchenSeiten();
  return seiten.map((seite) => ({ slug: seite.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const seite = await getBranchenSeite(slug);
  if (!seite) return { title: "Verfahrensdokumentation" };
  const canonical = canonicalUrl(branchenPath(seite.slug));
  return {
    title: { absolute: seite.metaTitle },
    description: seite.metaDescription,
    alternates: { canonical },
    robots: seite.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: withOgImage({
      title: seite.metaTitle,
      description: seite.metaDescription,
      url: canonical,
      locale: "de_DE",
      type: "website",
    }),
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const seite = await getBranchenSeite(slug);
  if (!seite) notFound();
  return <BranchenPage seite={seite} />;
}
