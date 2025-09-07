import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const srcFile = path.join(root, 'data', 'wukongData.json');
const outDir = path.join(root, 'data');
const catsDir = path.join(outDir, 'categories');

if (!fs.existsSync(srcFile)) {
  console.error('Source data/wukongData.json not found.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(srcFile, 'utf-8'));
const { expectedCounts, items } = raw;

if (!fs.existsSync(catsDir)) fs.mkdirSync(catsDir, { recursive: true });

// Write expectedCounts
fs.writeFileSync(
  path.join(outDir, 'expectedCounts.json'),
  JSON.stringify(expectedCounts, null, 2),
  'utf-8'
);

// Group items by category and write each
const byCat = {};
for (const it of items) {
  const cat = it.category;
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(it);
}

for (const cat of Object.keys(expectedCounts)) {
  const list = byCat[cat] || [];
  const file = path.join(catsDir, `${cat}.json`);
  fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf-8');
}

console.log('Split complete: wrote expectedCounts.json and category files in data/categories');


