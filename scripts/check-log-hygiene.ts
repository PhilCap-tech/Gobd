/**
 * Log-Hygiene (Datenschutz, CoS 26.10. 16:49): kein console.* in app/ oder
 * lib/ darf ein rohes Fehlerobjekt (err/error/e/cause oder die Variable eines
 * catch-Blocks), dessen message/stack/response/body oder ein Adressfeld
 * (email, to, replyTo, customerEmail) ausgeben. Fehler laufen über
 * `logError` (lib/log-error.ts): nur Name, Status/Code und Kontext.
 * Statische Prüfung per TypeScript-AST, ohne Netz.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { errorLogFields, logError } from "@/lib/log-error";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const ERROR_NAMES = new Set(["err", "error", "e", "cause"]);
const MAIL_NAMES = new Set(["email", "to", "replyTo", "customerEmail"]);
const LEAKY_PROPS = new Set(["message", "stack", "response", "body", "cause", "errors", "raw", "data", "config"]);
const STRINGIFIERS = new Set(["String", "stringify", "inspect", "format"]);

/**
 * Ausnahmen (Datei → Begründung). Leer halten, wenn möglich.
 * lib/log-error.ts: der Helfer selbst gibt nur das bereinigte Feldobjekt aus.
 */
const ALLOWLIST: Record<string, string> = {};

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

function catchBindings(node: ts.Node): Set<string> {
  const names = new Set<string>();
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (ts.isCatchClause(current) && current.variableDeclaration && ts.isIdentifier(current.variableDeclaration.name)) {
      names.add(current.variableDeclaration.name.text);
    }
  }
  return names;
}

export function findLogLeaks(file: string, source: string): string[] {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "console"
    ) {
      const call = node;
      const caught = catchBindings(call);
      const isErrorName = (name: string) => ERROR_NAMES.has(name) || caught.has(name);
      const reasons = new Set<string>();
      const scan = (n: ts.Node) => {
        if (ts.isIdentifier(n)) {
          const p = n.parent;
          if (ts.isPropertyAccessExpression(p) && p.name === n) {
            // x.error / x.email als Wert
            const used = !(ts.isPropertyAccessExpression(p.parent) && p.parent.expression === p) &&
              !(ts.isCallExpression(p.parent) && p.parent.expression === p);
            if (used && n.text === "error") reasons.add(`rohes Fehlerobjekt ${p.getText()}`);
            if (used && MAIL_NAMES.has(n.text)) reasons.add(`Adressfeld ${p.getText()}`);
            if (LEAKY_PROPS.has(n.text) && ts.isIdentifier(p.expression) && isErrorName(p.expression.text)) {
              reasons.add(`Fehlerdetail ${p.getText()}`);
            }
            return;
          }
          if (ts.isPropertyAssignment(p) && p.name === n) {
            if (MAIL_NAMES.has(n.text)) reasons.add(`Adressfeld ${n.text}:`);
            return;
          }
          if (ts.isShorthandPropertyAssignment(p)) {
            if (MAIL_NAMES.has(n.text)) reasons.add(`Adressfeld { ${n.text} }`);
            if (isErrorName(n.text)) reasons.add(`rohes Fehlerobjekt { ${n.text} }`);
            return;
          }
          if (MAIL_NAMES.has(n.text) && !(ts.isPropertyAccessExpression(p) && p.expression === n)) {
            reasons.add(`Adresse ${n.text}`);
          }
          if (isErrorName(n.text)) {
            if (ts.isPropertyAccessExpression(p) && p.expression === n) return; // error.name (Detail oben geprüft)
            if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) return;
            if (ts.isTypeOfExpression(p)) return;
            if (ts.isConditionalExpression(p) && p.condition === n) return;
            if (ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return;
            if (ts.isCallExpression(p) && p !== call) {
              const callee = p.expression;
              const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
              if (STRINGIFIERS.has(name)) reasons.add(`Fehler als Text ${p.getText()}`);
              return; // an Bereiniger übergeben (z. B. sheetsStatusCode(error))
            }
            reasons.add(`rohes Fehlerobjekt ${n.text}`);
            return;
          }
        }
        ts.forEachChild(n, scan);
      };
      call.arguments.forEach(scan);
      if (reasons.size) {
        const { line } = sf.getLineAndCharacterOfPosition(call.getStart());
        found.push(`${line + 1}: ${[...reasons].join("; ")}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function main() {
  const problems: string[] = [];
  for (const dir of ["app", "lib"]) {
    for (const file of files(path.join(root, dir))) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      if (ALLOWLIST[rel]) continue;
      for (const hit of findLogLeaks(file, readFileSync(file, "utf8"))) problems.push(`${rel}:${hit}`);
    }
  }
  // Selbsttest der Regeln.
  const sample = [
    'try {} catch (boom) { console.error("[x]", boom); }',
    'console.error("[x]", error);',
    'console.warn("[x]", err.message);',
    'console.info("[x]", { email });',
    'console.info("[x]", { to: input.to });',
    'console.error("[x]", result.error);',
    'console.info(`[x] ${email}`);',
    'console.error("[x]", String(error));',
  ].join("\n");
  const sampleHits = findLogLeaks("sample.ts", sample);
  if (sampleHits.length !== 8) {
    console.error("check-log-hygiene: Selbsttest erkennt nicht alle Muster", sampleHits);
    process.exit(1);
  }
  const clean = 'console.error("[x]", error instanceof Error ? error.name : "error"); console.info("[x]", { sent: true, stub: false });';
  if (findLogLeaks("clean.ts", clean).length) {
    console.error("check-log-hygiene: Selbsttest meldet sauberen Code");
    process.exit(1);
  }
  // Helfer: nur Name, Status, Code.
  const stripeLike = Object.assign(new Error("No such customer: kunde@example.com"), {
    name: "StripeInvalidRequestError",
    statusCode: 404,
    code: "resource_missing",
    raw: { message: "kunde@example.com" },
  });
  const fields = errorLogFields(stripeLike);
  const expect = JSON.stringify({ name: "StripeInvalidRequestError", status: 404, code: "resource_missing" });
  if (JSON.stringify(fields) !== expect) {
    console.error("check-log-hygiene: errorLogFields Stripe", fields);
    process.exit(1);
  }
  const gaxios = { name: "GaxiosError", code: "403", response: { status: 403, data: { error: "x@y.de" } } };
  if (JSON.stringify(errorLogFields(gaxios)) !== JSON.stringify({ name: "GaxiosError", status: 403 })) {
    console.error("check-log-hygiene: errorLogFields Google", errorLogFields(gaxios));
    process.exit(1);
  }
  if (errorLogFields({ name: "a@b.de", code: "x@y" }).name !== "Error" || "code" in errorLogFields({ code: "x@y" })) {
    console.error("check-log-hygiene: Adresse in name/code nicht gefiltert");
    process.exit(1);
  }
  const captured: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => captured.push(JSON.stringify(args));
  try {
    logError("[test]", stripeLike, { extra: { documentId: "doc-1", owner: "kunde@example.com" } });
  } finally {
    console.error = original;
  }
  const line = captured.join("\n");
  if (line.includes("@") || line.includes("No such") || !line.includes("doc-1") || !line.includes("resource_missing")) {
    console.error("check-log-hygiene: logError gibt mehr als Name/Status/Code aus", line);
    process.exit(1);
  }

  if (problems.length) {
    console.error("check-log-hygiene: Logs mit Fehlerobjekt oder Adresse (logError aus lib/log-error.ts nutzen):");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`check-log-hygiene: ok (Ausnahmen: ${Object.keys(ALLOWLIST).length})`);
}

main();
