# Erzeugt lib/retention-mail-texts.ts 1:1 aus der Legal-Datei (Box-Pfad). Nur lokal ausführen.
import re, json, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else "/workspace/gobd-ops/preismodell-2026-11/legal/v3/loeschhinweis-mails.md"
src = open(SRC).read()
footer = re.search(r'\*\*Fußzeile für alle Mails:\*\*\n\n> (.+)\n', src).group(1)
def section(prefix):
    i = src.index("\n" + prefix) + 1
    line_end = src.index("\n", i)
    rest = src[line_end + 1:]
    cuts = [x for x in [rest.find("\n---"), rest.find("\n### "), rest.find("\n## ")] if x >= 0]
    body = rest[:min(cuts)].strip("\n") if cuts else rest.strip("\n")
    m = re.match(r'\*\*Betreff:\*\* (.+)\n\n', body)
    return {"subject": m.group(1), "body": body[m.end():].rstrip()}
T = {k: section(h) for k, h in [("a7", "### a-7"), ("b", "### b-30 / b-7"), ("bN", "### b-30N"),
                               ("c", "### c-30 / c-7"), ("cN", "### c-30N"), ("d0", "### d-0"),
                               ("e7", "### e-7 "), ("e7N", "### e-7N")]}
ts = '''/**
 * Löschhinweis-Mails v3, Wortlaut 1:1 aus Legal `legal/v3/loeschhinweis-mails.md`
 * (freigegeben Philip 28.10. 18:33 MEZ, approvals.md Z. 462; d) neu 28.10.).
 * Erzeugt mit scripts/gen-retention-mail-texts.py. Nicht von Hand ändern:
 * check:retention vergleicht mit der Legal-Datei, wenn sie vorliegt.
 */
export const LEGAL_MAIL_FOOTER = %s;

export type LegalMailId = "a7" | "b" | "bN" | "c" | "cN" | "d0" | "e7" | "e7N";

export const LEGAL_MAILS: Record<LegalMailId, { subject: string; body: string }> = %s;
''' % (json.dumps(footer, ensure_ascii=False), json.dumps(T, ensure_ascii=False, indent=2))
open("lib/retention-mail-texts.ts", "w").write(ts)
