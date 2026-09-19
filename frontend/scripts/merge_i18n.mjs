// Folds all segement files in src/translations/parts/*.en.json and *.es.json
// into src/translations/en.json and es.json, then deletes the parts.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PARTS = path.join(ROOT, "src/translations/parts");

function load(f) { return JSON.parse(fs.readFileSync(f, "utf8")); }
function write(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 2) + "\n", "utf8"); }

function setNested(root, flat) {
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = val;
  }
}

if (!fs.existsSync(PARTS)) { console.log("No parts dir; nothing to merge."); process.exit(0); }

const en = load(path.join(ROOT, "src/translations/en.json"));
const es = load(path.join(ROOT, "src/translations/es.json"));
let count = 0;

for (const f of fs.readdirSync(PARTS)) {
  if (!/\.(en|es)\.json$/.test(f)) continue;
  const data = load(path.join(PARTS, f));
  const target = f.endsWith(".en.json") ? en : es;
  setNested(target, data);
  console.log(`merged ${f} (${Object.keys(data).length} flat keys)`);
  fs.rmSync(path.join(PARTS, f));
  count += Object.keys(data).length;
}

write(path.join(ROOT, "src/translations/en.json"), en);
write(path.join(ROOT, "src/translations/es.json"), es);
console.log(`Done. ${count} flat keys merged.`);