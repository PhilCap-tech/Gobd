import type { ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const token = /(\*\*[^*]+?\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let part = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const raw = match[0];
    const key = `${keyPrefix}-${part++}`;
    if (raw.startsWith("**") && raw.endsWith("**")) {
      nodes.push(<strong key={key}>{raw.slice(2, -2)}</strong>);
    } else {
      const link = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = link[2];
        const external = /^https?:\/\//.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            {...(external ? { rel: "noreferrer" } : {})}
          >
            {link[1]}
          </a>,
        );
      }
    }
    last = match.index + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isQuoteBlock(block: string): boolean {
  return block.split("\n").every((line) => line.trim().startsWith(">"));
}

function isUnorderedListBlock(block: string): boolean {
  return block.split("\n").every((line) => /^-\s+/.test(line));
}

function isChecklistBlock(block: string): boolean {
  return block.split("\n").every((line) => /^- \[[ xX]\]\s+/.test(line));
}

function isOrderedListBlock(block: string): boolean {
  return block.split("\n").every((line) => /^\d+\.\s+/.test(line));
}

function renderList(
  lines: string[],
  key: string,
  ordered: boolean,
): ReactNode {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag key={key} className="prose-list">
      {lines.map((line, i) => (
        <li key={`${key}-${i}`}>
          {renderInline(
            line.replace(ordered ? /^\d+\.\s+/ : /^-\s+/, ""),
            `${key}-${i}`,
          )}
        </li>
      ))}
    </Tag>
  );
}

function renderChecklist(lines: string[], key: string): ReactNode {
  return (
    <ul key={key} className="prose-list blog-checklist">
      {lines.map((line, i) => {
        const item = line.match(/^- \[([ xX])\]\s+(.*)$/);
        const checked = item?.[1] !== " ";
        return (
          <li key={`${key}-${i}`}>
            <span className="blog-check" aria-hidden="true">
              {checked ? "☑" : "☐"}
            </span>
            {renderInline(item?.[2] ?? line, `${key}-${i}`)}
          </li>
        );
      })}
    </ul>
  );
}

function renderQuote(block: string, key: string): ReactNode {
  const text = block
    .split("\n")
    .map((line) => line.replace(/^\s*>\s?/, ""))
    .join("\n")
    .trim();
  return (
    <blockquote key={key} className="blog-quote">
      <p>{renderInline(text, key)}</p>
    </blockquote>
  );
}

function renderMixedBlock(block: string, key: string): ReactNode[] {
  const lines = block.split("\n");
  const nodes: ReactNode[] = [];
  let buffer: string[] = [];
  let list: string[] = [];
  let ordered: string[] = [];
  let part = 0;

  const flushParagraph = () => {
    if (!buffer.length) return;
    nodes.push(
      <p key={`${key}-p-${part++}`} className="prose">
        {renderInline(buffer.join(" "), `${key}-p-${part}`)}
      </p>,
    );
    buffer = [];
  };
  const flushList = () => {
    if (list.length) {
      nodes.push(
        isChecklistBlock(list.join("\n"))
          ? renderChecklist(list, `${key}-cl-${part++}`)
          : renderList(list, `${key}-ul-${part++}`, false),
      );
      list = [];
    }
    if (ordered.length) {
      nodes.push(renderList(ordered, `${key}-ol-${part++}`, true));
      ordered = [];
    }
  };

  for (const line of lines) {
    if (/^- \[[ xX]\]\s+/.test(line) || /^-\s+/.test(line)) {
      flushParagraph();
      if (ordered.length) {
        nodes.push(renderList(ordered, `${key}-ol-${part++}`, true));
        ordered = [];
      }
      list.push(line);
    } else if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (list.length) {
        nodes.push(
          isChecklistBlock(list.join("\n"))
            ? renderChecklist(list, `${key}-cl-${part++}`)
            : renderList(list, `${key}-ul-${part++}`, false),
        );
        list = [];
      }
      ordered.push(line);
    } else {
      flushList();
      buffer.push(line);
    }
  }
  flushParagraph();
  flushList();
  return nodes;
}

function renderBlocks(body: string): ReactNode[] {
  return body.split(/\n{2,}/).flatMap((block, index) => {
    const key = `b-${index}`;
    const trimmed = block.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("### ")) {
      return [<h3 key={key}>{trimmed.slice(4).trim()}</h3>];
    }
    if (trimmed.startsWith("## ")) {
      return [<h2 key={key}>{trimmed.slice(3).trim()}</h2>];
    }
    if (trimmed.startsWith("# ")) {
      return [];
    }
    if (isQuoteBlock(trimmed)) {
      return [renderQuote(trimmed, key)];
    }
    if (isChecklistBlock(trimmed)) {
      return [renderChecklist(trimmed.split("\n"), key)];
    }
    if (isOrderedListBlock(trimmed)) {
      return [renderList(trimmed.split("\n"), key, true)];
    }
    if (isUnorderedListBlock(trimmed)) {
      return [renderList(trimmed.split("\n"), key, false)];
    }
    if (
      trimmed
        .split("\n")
        .some((line) => /^-\s+/.test(line) || /^\d+\.\s+/.test(line))
    ) {
      return renderMixedBlock(trimmed, key);
    }
    return [
      <p key={key} className="prose">
        {renderInline(trimmed.replace(/\n/g, " "), key)}
      </p>,
    ];
  });
}

export function BlogMarkdown({ source }: { source: string }) {
  return <>{renderBlocks(source)}</>;
}
