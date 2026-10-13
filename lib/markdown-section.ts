/** Plain text of one `##` section. Used so llms.txt and FAQ JSON-LD
 * follow the markdown on main instead of a second, hand-written copy.
 */
export function markdownToPlain(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[^\w])\*([^*\n]+)\*(?=[^\w]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Body of an h2 section, without the heading line and without a trailing `---`. */
export function markdownH2Section(source: string, heading: string): string {
  const lines = source.split(/\r?\n/);
  const target = `## ${heading}`;
  const start = lines.findIndex((line) => line.trim() === target);
  if (start < 0) {
    throw new Error(`Abschnitt fehlt: ${heading}`);
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ") || line.trim() === "---") {
      end = i;
      break;
    }
  }
  const plain = markdownToPlain(lines.slice(start + 1, end).join("\n"));
  if (!plain) {
    throw new Error(`Abschnitt leer: ${heading}`);
  }
  return plain;
}

/** First non-empty plain line that contains `needle`. */
export function plainLineContaining(source: string, needle: string): string {
  const line = markdownToPlain(source)
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.includes(needle));
  if (!line) {
    throw new Error(`Satz fehlt: ${needle}`);
  }
  return line;
}
