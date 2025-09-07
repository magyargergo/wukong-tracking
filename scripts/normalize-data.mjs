import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const catsDir = path.join(root, 'data', 'categories');

function shortenName(name) {
  if (!name) return name;
  // Remove trailing parentheticals used for type hints, keep concise name
  let n = name.replace(/\s*\(([^)]*)\)\s*$/g, '').trim();
  // Collapse multiple spaces
  n = n.replace(/\s+/g, ' ').trim();
  // Keep within ~40 chars for UI brevity
  if (n.length > 40) n = n.slice(0, 40).trimEnd();
  return n;
}

function normalizeFile(filePath) {
  const arr = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const normalized = arr.map((it) => {
    const description = it.description || it.howToGet || it.notes || '';
    const name = shortenName(it.name);
    return { ...it, name, description };
  });
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
}

function run() {
  const files = fs.readdirSync(catsDir).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const p = path.join(catsDir, f);
    normalizeFile(p);
    console.log('Normalized', f);
  }
}

run();


