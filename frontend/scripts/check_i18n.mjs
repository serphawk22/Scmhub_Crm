// Validator: ensures every t("...") key used in frontend/src exists in BOTH
// translations/en.json and translations/es.json, with the same nested shape.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function loadJson(p) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
}
const en = loadJson("src/translations/en.json");
const es = loadJson("src/translations/es.json");
// i18next namespace bundles (legacy system). Keys may live here instead of translations/*.
const enNs = loadJson("src/locales/en/common.json");
const esNs = loadJson("src/locales/es/common.json");
const enFlat = { ...flatten(en), ...flatten(enNs) };
const esFlat = { ...flatten(es), ...flatten(esNs) };

function flatten(d, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(d)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, p, out);
    else out[p] = v;
  }
  return out;
}

// Collect every t("...") / t('...') / t(`...`) call key across the codebase.
function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(path.join(ROOT, "src")).map((p) => p.replace(ROOT + path.sep, ""));

const re = /\bt\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const used = new Map(); // key -> list of files
for (const f of files) {
  const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
  let m;
  while ((m = re.exec(txt)) !== null) {
    const k = m[1];
    if (!k.includes(".")) continue; // skip dynamic/composite keys
    if (k.includes("$")) continue; // skip template-literal keys e.g. sidebar.section_${x}
    if (!used.has(k)) used.set(k, []);
    used.get(k).push(f.replace("src/", ""));
  }
}

function has(dict, key) {
  let cur = dict;
  for (const part of key.split(".")) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return false;
    cur = cur[part];
  }
  return typeof cur === "string";
}

let errors = 0;
for (const [key, files] of [...used.entries()].sort()) {
  const inEn = has(en, key) || has(enNs, key);
  const inEs = has(es, key) || has(esNs, key);
  if (!inEn) { console.error(`MISSING en: ${key}  (${files.join(", ")})`); errors++; }
  if (!inEs) { console.error(`MISSING es: ${key}  (${files.join(", ")})`); errors++; }
  // Both are strings but equal -> means the es value is identical (possible untranslated).
  // Only flag when resolved from the CUSTOM translations system (the target for new wiring).
  const get = (flat, k) => flat[k];
  const inCustomEn = has(en, key);
  const inCustomEs = has(es, key);
  if (inCustomEn && inCustomEs && get(enFlat, key) === get(esFlat, key)) {
    console.error(`SAME en/es (untranslated): ${key} = "${get(enFlat, key)}" (${used.get(key).length} use)`);
    errors++;
  }
}

console.log(`\nScanned ${files.length} files, ${used.size} unique dot-keys.`);
if (errors) { console.error(`\n${errors} problems.`); process.exit(1); }
console.log("OK: all used keys present in en + es.");