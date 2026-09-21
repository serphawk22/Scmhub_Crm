// Checks every src/translations/parts/*.en.json against its *.es.json twin for
// matching key sets (so no language drift within a cluster). Run before merging.
import fs from "node:fs";
import path from "node:path";

const PARTS = path.join(process.cwd(), "src/translations/parts");
if (!fs.existsSync(PARTS)) { console.log("No parts."); process.exit(0); }

const byLang = {};
for (const f of fs.readdirSync(PARTS)) {
  if (!/\.(en|es)\.json$/.test(f)) continue;
  const lang = f.endsWith(".en.json") ? "en" : "es";
  const data = JSON.parse(fs.readFileSync(path.join(PARTS, f), "utf8"));
  byLang[lang] = { file: f, keys: Object.keys(data) };
}

let errs = 0;
if (byLang.en || byLang.es) {
  const enK = new Set(byLang.en?.keys || []);
  const esK = new Set(byLang.es?.keys || []);
  const onlyEn = [...enK].filter((k) => !esK.has(k));
  const onlyEs = [...esK].filter((k) => !enK.has(k));
  if (onlyEn.length) { errs += onlyEn.length; console.error(`es missing: ${onlyEn.slice(0, 30)}`); }
  if (onlyEs.length) { errs += onlyEs.length; console.error(`en missing: ${onlyEs.slice(0, 30)}`); }
}

console.log(errs ? `${errs} parity problem(s).` : "Parts parity OK.");
process.exit(errs ? 1 : 0);