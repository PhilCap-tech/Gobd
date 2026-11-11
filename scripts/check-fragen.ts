/**
 * /fragen: 24 Welle-1 pages, index, sitemap section, FAQPage and breadcrumbs.
 *   npx tsx scripts/check-fragen.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, type Dirent } from "node:fs";
import path from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sitemap from "../app/sitemap";
import { BlogMarkdown } from "../lib/blog-markdown";
import { formatBlogDate, listPublishedPosts } from "../lib/blog";
import { listBranchenFooterLinks } from "../lib/branchen";
import { FRAGEN_GRUPPEN, FRAGEN_KURZLINKS } from "../lib/fragen-katalog";
import {
  FRAGEN_DISCLAIMER,
  FRAGEN_INDEX_H1,
  FRAGEN_INDEX_INTRO,
  bodyShowsKurzantwort,
  exactMetaDescription,
  fragenBodyForMarkdown,
  fragenZielLabel,
  groupFragenIndex,
  splitFragenDisclaimer,
  latestFragenStand,
  listFragenIndex,
  listFragenSeiten,
} from "../lib/fragen";
import {
  ORGANIZATION_ID,
  breadcrumbJsonLd,
  fragenCollectionJsonLd,
  fragenFaqJsonLd,
  type JsonLdNode,
} from "../lib/jsonld";
import { rewriteLegacyEffortClaims } from "../lib/offer-copy";
import { canonicalUrl } from "../lib/seo";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function source(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

function findNamed(dir: string, name: string): string[] {
  const hits: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === name) hits.push(full);
      else hits.push(...findNamed(full, name));
    } else if (entry.name === name) hits.push(full);
  }
  return hits;
}

function parseJsonLd(data: JsonLdNode): JsonLdNode {
  return JSON.parse(JSON.stringify(data).replace(/</g, "\\u003c")) as JsonLdNode;
}

const LABEL_WORD = /(?<![\p{L}\p{N}_])(?:GEO|LLM)(?![\p{L}\p{N}_])/iu;
const DU_PRONOUN =
  /(?<![\p{L}\p{N}_])(?:[Dd]u|[Dd]ich|[Dd]ir|[Dd]ein(?:en|em|er|es|e|s)?|[Ee]uch|[Ee]u(?:ren|rem|rer|res|er|re))(?![\p{L}\p{N}_])/u;

function assertClean(text: string, where: string) {
  ok(!LABEL_WORD.test(text), `${where} has no GEO or LLM label`);
  ok(!text.includes("# intern:"), `${where} does not render an internal note`);
  ok(DU_PRONOUN.exec(text) === null, `${where} has no du address`);
}

async function main() {
  ok(FRAGEN_INDEX_H1 === "Fragen zu GoBD und Verfahrensdokumentation", "index H1 is the approved wording");
  ok(
    FRAGEN_INDEX_INTRO ===
      "Hier beantworten wir häufige Fragen zu den GoBD und zur Verfahrensdokumentation, kurz und mit Verweisen auf ausführliche Beiträge. Die Antworten sind allgemeine Arbeitshilfen und ersetzen keine Steuerberatung.",
    "index intro is the approved wording",
  );
  ok(formatBlogDate("2026-11-11") === "11. November 2026", "stand renders as 11. November 2026");

  const files = readdirSync("content/fragen").filter((file) => file.endsWith(".md") || file.endsWith(".mdx"));
  ok(files.length === 24, "content/fragen has the 24 Welle-1 files");
  ok(findNamed(process.cwd(), "01-katalog.md").length === 0, "the internal catalog is not in the repo");
  ok(findNamed(process.cwd(), "02-erste-welle.md").length === 0, "the internal wave brief is not in the repo");
  ok(findNamed(process.cwd(), "_build").length === 0, "the draft build scripts are not in the repo");

  const seiten = await listFragenSeiten();
  ok(seiten.length === 24, "loader returns 24 pages");
  const repeated = `# Frage\n\n${FRAGEN_DISCLAIMER}\n\nDie Kurzantwort steht hier wortgleich.\n`;
  ok(
    bodyShowsKurzantwort(repeated, "Die Kurzantwort steht hier wortgleich."),
    "an identical body sentence counts as already shown",
  );
  ok(
    !bodyShowsKurzantwort(repeated, "Die Kurzantwort steht hier wortgleich. Ein zweiter Satz nicht."),
    "a longer kurzantwort is not treated as already shown",
  );
  ok(latestFragenStand(seiten) === "2026-11-11", "stand is 2026-11-11");

  const published = new Set((await listPublishedPosts()).map((post) => post.slug));
  const index = source("app/fragen/page.tsx");
  const article = source("app/fragen/[slug]/page.tsx");
  ok(index.includes("FRAGEN_INDEX_H1") && index.includes("FRAGEN_INDEX_INTRO"), "index renders the approved heading and intro");
  ok(index.includes('robots: { index: true, follow: true }'), "index robots are index,follow");
  ok(article.includes('robots: { index: true, follow: true }'), "article robots are index,follow");
  ok(index.includes("alternates: { canonical:"), "index sets a canonical");
  ok(article.includes("alternates: { canonical:"), "article sets a canonical");
  ok(!index.includes("fragenFaqJsonLd") && !index.includes("faqPageJsonLd"), "index does not emit FAQPage");
  ok(article.includes("fragenFaqJsonLd"), "article emits one FAQPage");
  ok(article.includes("Stand: {formatBlogDate(seite.stand)}"), "article shows the stand line");
  ok(article.includes("{seite.kurzantwort}"), "article prints the frontmatter kurzantwort");
  ok(article.includes("bodyShowsKurzantwort"), "article does not repeat a kurzantwort already in the body");
  ok(!article.includes("seite.quellen") && !article.includes(".quellen"), "article does not add a sources block");
  ok(!source("app/faq/page.tsx").includes("/fragen"), "/faq is unchanged");

  for (const seite of seiten) {
    ok(seite.welle === 1, `${seite.slug} is wave 1`);
    ok(seite.stand === "2026-11-11", `${seite.slug} stand`);
    ok(seite.route === `/fragen/${seite.slug}`, `${seite.slug} route`);
    ok(seite.body.startsWith(`# ${seite.frage}\n`), `${seite.slug} H1 is the question`);
    ok(seite.body.includes(FRAGEN_DISCLAIMER), `${seite.slug} has the Friseur disclaimer`);
    ok(fragenBodyForMarkdown(seite.body) === seite.body, `${seite.slug} body spacing is already valid`);
    ok(rewriteLegacyEffortClaims(seite.body) === seite.body, `${seite.slug} effort wording is not rewritten`);
    assertClean(`${seite.frage}\n${seite.kurzantwort}\n${seite.body}`, seite.slug);
    ok(!/[*#]|\[|\]\(/.test(seite.kurzantwort), `${seite.slug} kurzantwort is plain text`);

    const description = exactMetaDescription(seite.kurzantwort);
    ok(seite.kurzantwort.startsWith(description), `${seite.slug} meta description keeps the original words`);
    ok(description.length <= 160, `${seite.slug} meta description is about 155 characters (${description.length})`);
    if (seite.kurzantwort.length <= 160) {
      ok(description === seite.kurzantwort, `${seite.slug} short kurzantwort is not shortened`);
    }

    const { lead, rest } = splitFragenDisclaimer(seite.body);
    const showKurzantwort = !bodyShowsKurzantwort(seite.body, seite.kurzantwort);
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(BlogMarkdown, { source: fragenBodyForMarkdown(lead) }),
        showKurzantwort ? createElement("p", { className: "prose" }, seite.kurzantwort) : null,
        rest ? createElement(BlogMarkdown, { source: fragenBodyForMarkdown(rest) }) : null,
      ),
    );
    ok(html.includes("Keine Steuerberatung."), `${seite.slug} renders the disclaimer`);
    ok(!html.includes("# intern") && !html.includes("Intent „"), `${seite.slug} hides the internal note`);
    ok(html.split(seite.kurzantwort).length - 1 === 1, `${seite.slug} shows the kurzantwort once`);
    if (showKurzantwort) {
      ok(
        html.includes(`</blockquote><p class="prose">${seite.kurzantwort}</p>`),
        `${seite.slug} prints the frontmatter kurzantwort directly under the disclaimer`,
      );
    } else {
      ok(
        !html.includes(`</blockquote><p class="prose">${seite.kurzantwort}</p>`),
        `${seite.slug} does not repeat a kurzantwort the body already shows`,
      );
    }
    for (const line of seite.body.split("\n")) {
      if (!line.startsWith("## ")) continue;
      ok(html.includes(line.slice(3).trim()), `${seite.slug} renders heading ${line.slice(3).trim()}`);
    }
    for (const link of seite.interneLinks) {
      if (link.startsWith("/blog/")) {
        ok(published.has(link.slice("/blog/".length)), `${seite.slug} links a published post ${link}`);
      }
    }
    if (seite.slug !== "was-kostet-verfahrensdokumentation" && seite.slug !== "verfahrensdokumentation-erstellen-einfach") {
      ok(!seite.body.includes("99 €") && !seite.kurzantwort.includes("99 €"), `${seite.slug} states no product price`);
    }
    ok(!seite.body.includes("149 €") && !seite.kurzantwort.includes("149 €"), `${seite.slug} has no legacy price`);

    const faq = parseJsonLd(
      fragenFaqJsonLd({
        frage: seite.frage,
        antwort: seite.kurzantwort,
        dateModified: seite.stand,
        url: canonicalUrl(seite.route),
      }),
    );
    ok(faq["@type"] === "FAQPage", `${seite.slug} JSON-LD is FAQPage`);
    const questions = faq.mainEntity as JsonLdNode[];
    ok(questions.length === 1, `${seite.slug} FAQPage has one question`);
    ok(questions[0].name === seite.frage, `${seite.slug} question name is the frage`);
    const answer = questions[0].acceptedAnswer as JsonLdNode;
    ok(answer.text === seite.kurzantwort, `${seite.slug} acceptedAnswer is the kurzantwort`);
    ok(faq.dateModified === "2026-11-11", `${seite.slug} dateModified is stand`);
    const publisher = faq.publisher as JsonLdNode;
    ok(
      publisher["@type"] === "Organization" && publisher["@id"] === ORGANIZATION_ID && publisher.name === "IKAT GmbH",
      `${seite.slug} publisher is IKAT GmbH`,
    );
    const crumbs = parseJsonLd(
      breadcrumbJsonLd([
        { name: "Startseite", path: "/" },
        { name: "Fragen", path: "/fragen" },
        { name: seite.frage, path: seite.route },
      ]),
    );
    const crumbItems = crumbs.itemListElement as JsonLdNode[];
    ok(crumbs["@type"] === "BreadcrumbList" && crumbItems.length === 3, `${seite.slug} breadcrumb has three steps`);
    ok(crumbItems[1].name === "Fragen" && crumbItems[1].item === canonicalUrl("/fragen"), `${seite.slug} breadcrumb passes Fragen`);
    ok(crumbItems[2].name === seite.frage && crumbItems[2].item === canonicalUrl(seite.route), `${seite.slug} breadcrumb ends at the question`);
  }

  ok(
    seiten.some((seite) => seite.slug === "was-kostet-verfahrensdokumentation" && seite.body.includes("99 €")),
    "the price page keeps the stated prices",
  );

  const introMeta = exactMetaDescription(FRAGEN_INDEX_INTRO);
  ok(FRAGEN_INDEX_INTRO.startsWith(introMeta) && introMeta.length <= 160, "index meta description is a prefix of the intro");

  const entries = await listFragenIndex();
  ok(entries.length === 24 + FRAGEN_KURZLINKS.length, "index lists wave 1 and kurz+link rows");
  ok(FRAGEN_KURZLINKS.length === 51, "51 kurz+link rows");
  const slugs = new Set(seiten.map((seite) => seite.slug));
  for (const row of FRAGEN_KURZLINKS) {
    ok(!slugs.has(row.slug), `${row.slug} is not a thin /fragen page`);
    ok(row.hrefs.length >= 1 && row.hrefs.every((href) => href.startsWith("/") && !href.startsWith("/fragen/")), `${row.slug} links to an existing path`);
    assertClean(row.frage, row.slug);
  }
  const blogTitles = new Map((await listPublishedPosts()).map((post) => [post.slug, post.title]));
  const branchenLabels = new Map(listBranchenFooterLinks().map((link) => [link.href, link.label]));
  for (const entry of entries) {
    if (entry.kurzantwort === null) {
      ok(!entry.href.startsWith("/fragen/"), `${entry.slug} stays off /fragen`);
    } else {
      ok(entry.href === `/fragen/${entry.slug}`, `${entry.slug} links to its page`);
      ok(entry.moreHrefs.length === 0, `${entry.slug} has no extra index link`);
    }
    for (const href of entry.moreHrefs) {
      const label = fragenZielLabel(href, blogTitles, branchenLabels);
      ok(label !== href && !label.startsWith("/"), `${entry.slug} extra link uses the existing page title`);
    }
  }
  const groups = groupFragenIndex(entries);
  ok(groups.length === FRAGEN_GRUPPEN.length, "every group has a visible entry in this release");
  ok(
    groups.map((group) => group.title).join("|") === FRAGEN_GRUPPEN.map((group) => group.title).join("|"),
    "group headings are the approved titles",
  );
  const onlyGrundlagen = groupFragenIndex(entries.filter((entry) => entry.gruppe === "grundlagen-gobd"));
  ok(onlyGrundlagen.length === 1 && onlyGrundlagen[0].title === "Grundlagen der GoBD", "an empty group heading is omitted");

  const collection = parseJsonLd(
    fragenCollectionJsonLd({
      name: FRAGEN_INDEX_H1,
      dateModified: latestFragenStand(seiten),
      url: canonicalUrl("/fragen"),
      items: entries.map((entry) => ({ name: entry.frage, path: entry.href })),
    }),
  );
  ok(collection["@type"] === "CollectionPage", "index JSON-LD is a CollectionPage");
  ok(collection["@type"] !== "FAQPage", "index JSON-LD is not an FAQPage");
  const list = collection.mainEntity as JsonLdNode;
  ok(list["@type"] === "ItemList", "index main entity is an ItemList");
  const listItems = list.itemListElement as JsonLdNode[];
  ok(listItems.length === entries.length, "ItemList has one URL per visible question");
  ok(
    !listItems.some((item) => FRAGEN_KURZLINKS.some((row) => item.url === canonicalUrl(`/fragen/${row.slug}`))),
    "ItemList has no later-wave /fragen slug",
  );

  const sitemapEntries = await sitemap();
  const urls = sitemapEntries.map((entry) => entry.url);
  const fragenUrls = urls.filter((url) => url === canonicalUrl("/fragen") || url.includes("/fragen/"));
  ok(fragenUrls.length === 25, "sitemap section has the index and 24 articles");
  ok(urls.filter((url) => url === canonicalUrl("/fragen")).length === 1, "sitemap lists /fragen once");
  for (const seite of seiten) {
    const entry = sitemapEntries.find((item) => item.url === canonicalUrl(seite.route));
    ok(String(entry?.lastModified).slice(0, 10) === seite.stand, `sitemap lastmod is stand for ${seite.slug}`);
  }
  for (const row of FRAGEN_KURZLINKS) {
    ok(!urls.includes(canonicalUrl(`/fragen/${row.slug}`)), `sitemap omits later slug ${row.slug}`);
  }

  const header = source("components/site-header.tsx");
  const footer = source("components/site-footer.tsx");
  ok(header.indexOf('href="/blog"') !== -1 && header.indexOf('href="/blog"') < header.indexOf('href="/fragen"'), "header places Fragen next to Blog");
  ok(footer.indexOf('href="/blog"') !== -1 && footer.indexOf('href="/blog"') < footer.indexOf('href="/fragen"'), "footer places Fragen next to Blog");
  ok(footer.includes('href="/faq"'), "footer still links /faq");

  console.log("check-fragen: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
