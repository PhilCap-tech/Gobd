import { writeFileSync } from "fs";
import { MODULE, modulFragen } from "../lib/module/katalog";
import { CATALOG_STEPS } from "../lib/intake-catalog";

type Field = { key: string; type: string; options?: string[]; label?: string };
const all: Array<{ modul: string; nr: number; titel: string; id: string; prompt: string; fields: Field[] }> = [];
for (const m of MODULE) {
  for (const q of modulFragen(m)) {
    all.push({ modul: m.id, nr: m.nr, titel: m.titel, id: q.id, prompt: q.prompt, fields: q.fields as Field[] });
  }
}
for (const step of CATALOG_STEPS) {
  for (const q of step.questions) {
    if (all.some((a) => a.id === q.id)) continue;
    all.push({ modul: "catalog", nr: 0, titel: step.title, id: q.id, prompt: q.prompt, fields: q.fields as Field[] });
  }
}
writeFileSync("/tmp/all-qs.json", JSON.stringify(all, null, 2));
console.log("questions", all.length);
