import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { load } from "cheerio";
import { fileURLToPath } from "url";
import { dirname } from "path";

type Chapter = 1|2|3|4|5|6|"Secret"|"NG+";

interface Item {
  id: string;
  name: string;
  category: string;
  chapter?: Chapter;
  missable?: boolean;
  ngPlusOnly?: boolean;
  description?: string;
  notes?: string;
  sources?: string[];
}

interface CliArgs {
  apply: boolean;
  target?: string; // category file or directory
  include?: string; // comma-separated ids to include
  source?: string; // optional: force source URL
  concurrency?: number; // number of items to process in parallel
  cleanCache?: boolean; // remove cached HTML after finishing
  verifyCounts?: boolean; // verify category item counts against expectedCounts.json
}

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(dirname(thisFile), "..");
const dataDir = path.resolve(repoRoot, "data", "categories");
const cacheDir = path.resolve(repoRoot, ".cache", "scrapes");

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { apply: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a.startsWith("--target=")) args.target = a.slice("--target=".length);
    else if (a.startsWith("--include=")) args.include = a.slice("--include=".length);
    else if (a.startsWith("--source=")) args.source = a.slice("--source=".length);
    else if (a.startsWith("--concurrency=")) {
      const v = Number(a.slice("--concurrency=".length));
      if (Number.isFinite(v) && v > 0) args.concurrency = Math.floor(v);
    }
    else if (a === "--clean-cache" || a === "--cleanup") {
      args.cleanCache = true;
    }
    else if (a === "--verify-counts") {
      args.verifyCounts = true;
    }
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: pnpm enrich [--apply] [--target=path] [--include=id1,id2] [--source=url]\n\n` +
    `Examples:\n` +
    `  pnpm enrich --target=data/categories/Spirits.json\n` +
    `  pnpm enrich --include=spirits-wandering-wight --source=https://example.com/page\n` +
    `  pnpm enrich --concurrency=6 --target=data/categories\n` +
    `  pnpm enrich --clean-cache --apply --target=data/categories\n` +
    `  pnpm enrich --verify-counts --target=data/categories\n` +
    `  pnpm enrich --apply --target=data/categories\n`);
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

async function fetchWithCache(url: string): Promise<string> {
  ensureDir(cacheDir);
  const key = sha1(url);
  const file = path.join(cacheDir, `${key}.html`);
  if (fs.existsSync(file)) {
    return fs.readFileSync(file, "utf8");
  }
  const res = await fetch(url, { headers: { "user-agent": "wukong-tracker-bot/1.0" } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const html = await res.text();
  fs.writeFileSync(file, html, "utf8");
  return html;
}

type ExtractResult = { chapter?: Chapter; missable?: boolean; ngPlusOnly?: boolean; description?: string; notes?: string };

type AreaMapEntry = { name: string; aliases?: string[]; chapter: Chapter; secret?: boolean };

function loadAreasMap(): AreaMapEntry[] {
  const file = path.resolve(repoRoot, "data", "areas-map.json");
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as AreaMapEntry[];
    return parsed;
  } catch {
    return [];
  }
}

function inferFromTextByAreas(text: string, areas: AreaMapEntry[]): Partial<ExtractResult> {
  const lower = text.toLowerCase();
  for (const area of areas) {
    const tokens = [area.name, ...(area.aliases ?? [])].map(s => s.toLowerCase()).filter(Boolean);
    for (const token of tokens) {
      if (!token) continue;
      if (lower.includes(token)) {
        const inferred: Partial<ExtractResult> = { chapter: area.chapter };
        if (area.secret) inferred.missable = true;
        return inferred;
      }
    }
  }
  return {};
}

function detectNgPlusOnly(text: string): boolean {
  const t = text.toLowerCase();
  if (/(^|\b)(ng\+|new\s*game\+)(\b|[^a-z0-9])/i.test(t)) {
    if (/(only|exclusive|exclusively|requires|must)/i.test(t)) return true;
    if (/after\s+entering\s+(a\s+)?new\s+cycle/i.test(t)) return true;
  }
  if (/dlc\s+only/i.test(t)) return false;
  return false;
}

function extractFromHtml(html: string, areas: AreaMapEntry[]): ExtractResult {
  const $ = load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const result: ExtractResult = {};

  const chapMatch = text.match(/Chapter\s+(Secret|NG\+|[1-6])/i);
  if (chapMatch) {
    const v = chapMatch[1];
    if (/^\d$/.test(v)) result.chapter = Number(v) as Chapter;
    else if (/secret/i.test(v)) result.chapter = "Secret";
    else result.chapter = "NG+";
  }

  const missableMatch = text.match(/\bmissable\b[:\-\s]*?(yes|no|true|false)/i);
  if (missableMatch) {
    const v = missableMatch[1].toLowerCase();
    result.missable = v === "yes" || v === "true";
  } else if (/\b(unmissable|automatically unlocked|story-related)\b/i.test(text)) {
    result.missable = false;
  }

  const descCandidate = $("meta[name='description']").attr("content") || $("p").first().text();
  if (descCandidate) result.description = descCandidate.trim().slice(0, 800);

  const notesCandidate = $("h2:contains('Notes'), h3:contains('Notes')").next("p").first().text();
  if (notesCandidate) result.notes = notesCandidate.trim().slice(0, 800);

  // Area-based inference as fallback
  if (result.chapter === undefined || result.missable === undefined) {
    const areaInf = inferFromTextByAreas(text, areas);
    if (result.chapter === undefined && areaInf.chapter !== undefined) result.chapter = areaInf.chapter as Chapter;
    if (result.missable === undefined && areaInf.missable !== undefined) result.missable = areaInf.missable;
  }

  // NG+ detection from page text
  if (detectNgPlusOnly(text)) result.ngPlusOnly = true;

  return result;
}

function isIgnUrl(url: string): boolean {
  if (!url) return false;
  return /ign\.com\/wikis\/black-myth-wukong\//i.test(url);
}

function extractFromIgn(html: string, areas: AreaMapEntry[]): ExtractResult {
  const $ = load(html);
  const root = $("main, article, #content, body").first();
  const visibleText = root.text().replace(/\s+/g, " ").trim();
  const result: ExtractResult = {};

  // Chapter detection (explicit mentions like "Chapter 3"). IGN pages often list multiple chapters in nav; prefer the last mention in content.
  const chapAll = Array.from(visibleText.matchAll(/Chapter\s+(Secret|NG\+|[1-6])/gi));
  if (chapAll.length > 0) {
    const v = chapAll[chapAll.length - 1][1];
    if (/^\d$/.test(v)) result.chapter = Number(v) as Chapter;
    else if (/secret/i.test(v)) result.chapter = "Secret";
    else result.chapter = "NG+";
  }

  // Secret area phrasing
  if (/\bchapter'?s\s+secret\s+area\b/i.test(visibleText) || /\bsecret\s+(area|chamber|room)\b/i.test(visibleText)) {
    result.missable = true;
  }

  // Area-based inference from entire article
  const areaInf = inferFromTextByAreas(visibleText, areas);
  if (result.chapter === undefined && areaInf.chapter !== undefined) result.chapter = areaInf.chapter as Chapter;
  if (result.missable === undefined && areaInf.missable !== undefined) result.missable = areaInf.missable;

  // Prefer a concise, human description from first summary paragraph
  const firstPara = root.find("p").first().text().trim();
  if (firstPara && (!result.description || result.description.length < 60)) {
    result.description = firstPara.slice(0, 800);
  }

  // Notes from Location / Where to Find sections
  let notes = "";
  root.find("h2, h3").each((_: number, el: any) => {
    const title = $(el).text().trim().toLowerCase();
    if (/(where to find|location|locations|how to get)/.test(title)) {
      const segTexts: string[] = [];
      let sib = $(el).next();
      while (sib.length && !/H2|H3/.test(sib.prop("tagName") || "")) {
        if (sib.is("p, ul, ol")) segTexts.push(sib.text().replace(/\s+/g, " ").trim());
        sib = sib.next();
      }
      const combined = segTexts.filter(Boolean).join(" \u2022 ");
      if (!notes && combined) notes = combined.slice(0, 800);
    }
  });
  if (!notes) {
    // Fallback: any paragraph mentioning "found" or "dropped"
    const p = root.find("p").filter((_: number, e: any) => /\b(found|dropped|located|obtain|defeat|boss)\b/i.test($(e).text())).first().text();
    if (p) notes = p.replace(/\s+/g, " ").trim().slice(0, 800);
  }
  if (notes) result.notes = notes;

  // NG+ detection from IGN page text
  if (detectNgPlusOnly(visibleText)) result.ngPlusOnly = true;

  return result;
}

function normalizeNameForSlug(name: string): string {
  // Replace fancy quotes with ascii
  let s = name
    .replace(/[’‘‛ʻ´`]/g, "'")
    .replace(/[“”]/g, '"');
  // Keep letters, numbers, spaces, hyphens, apostrophes, parentheses
  s = s.replace(/[^A-Za-z0-9\s\-()'']/g, " ");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function buildIgnSlugCandidates(name: string): string[] {
  const base = normalizeNameForSlug(name);
  const withUnderscores = base.replace(/\s+/g, "_");
  const removedParens = base.replace(/[()]/g, "").replace(/\s+/g, "_");
  const removedApostrophes = base.replace(/'/g, "").replace(/\s+/g, "_");
  const removedBoth = base.replace(/[()']/g, "").replace(/\s+/g, "_");
  const unique = new Set<string>([
    withUnderscores,
    removedParens,
    removedApostrophes,
    removedBoth,
  ]);
  return Array.from(unique);
}

function buildIgnUrlFromName(name: string): string[] {
  const slugs = buildIgnSlugCandidates(name);
  return slugs.map(slug => `https://www.ign.com/wikis/black-myth-wukong/${encodeURI(slug)}`);
}

function loadJson(filePath: string): Item[] {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function saveJson(filePath: string, items: Item[]) {
  const content = JSON.stringify(items, null, 2) + "\n";
  fs.writeFileSync(filePath, content, "utf8");
}

function collectCategoryFiles(target?: string): string[] {
  const absTarget = target ? path.resolve(repoRoot, target) : dataDir;
  const stat = fs.statSync(absTarget);
  if (stat.isDirectory()) {
    return fs.readdirSync(absTarget)
      .filter(f => f.endsWith(".json"))
      .map(f => path.join(absTarget, f));
  }
  return [absTarget];
}

function gitDiffOfStringAgainstFile(newContent: string, filePath: string): string {
  // Write to a temp file and diff
  const tmp = path.join(repoRoot, ".tmp.diff." + path.basename(filePath));
  fs.writeFileSync(tmp, newContent, "utf8");
  try {
    const quotedOld = `"${filePath.replace(/"/g, '\\"')}"`;
    const quotedNew = `"${tmp.replace(/"/g, '\\"')}"`;
    const cmd = `git --no-pager diff --no-index -- ${quotedOld} ${quotedNew}`;
    const out = execSync(cmd, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    return out.toString();
  } catch (e: any) {
    // git diff returns non-zero when differences exist; still capture stdout if any
    const out = e.stdout?.toString?.() ?? "";
    return out;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function reorderKeysPreservingOriginal(original: Item, merged: Item): Item {
  const ordered: any = {};
  const originalKeys = Object.keys(original);
  for (const k of originalKeys) {
    if ((merged as any).hasOwnProperty(k)) {
      ordered[k] = (merged as any)[k];
    } else {
      ordered[k] = (original as any)[k];
    }
  }
  const appendedKeysOrder = [
    "chapter","missable","ngPlusOnly","dlc",
    "description","howToGet","notes","sources",
    "confidence","verified","lastScrapedAt"
  ];
  const mergedKeys = new Set(Object.keys(merged));
  for (const k of appendedKeysOrder) {
    if (!originalKeys.includes(k) && mergedKeys.has(k)) {
      ordered[k] = (merged as any)[k];
      mergedKeys.delete(k);
    }
  }
  // Append any remaining new keys deterministically (alphabetical)
  const rest = Array.from(mergedKeys).filter(k => !originalKeys.includes(k)).sort();
  for (const k of rest) {
    ordered[k] = (merged as any)[k];
  }
  return ordered as Item;
}

async function enrichItems(items: Item[], includeIds: Set<string>, forcedSource?: string): Promise<Item[]> {
  const updated: Item[] = new Array(items.length);
  const areas = loadAreasMap();
  // Concurrency-limited item processing, preserving original order
  const pool = createPool(globalCliArgs.concurrency ?? 4);
  const results: Promise<void>[] = [];
  items.forEach((item, index) => {
    results.push(pool(async () => {
      if (includeIds.size > 0 && !includeIds.has(item.id)) {
        updated[index] = item;
        return;
      }
      const sources = forcedSource ? [forcedSource] : (item.sources ?? []);
      let merged = { ...item } as Item;
      const ignCandidates = buildIgnUrlFromName(item.name);
      const candidateUrls = [...sources];
      for (const u of ignCandidates) {
        if (!candidateUrls.includes(u)) candidateUrls.push(u);
      }

      for (const url of candidateUrls) {
        try {
          const html = await fetchWithCache(url);
          const ext = isIgnUrl(url) ? extractFromIgn(html, areas) : extractFromHtml(html, areas);
          if (ext.chapter !== undefined) merged.chapter = ext.chapter;
          if (ext.missable !== undefined) merged.missable = ext.missable;
          if (ext.ngPlusOnly !== undefined) merged.ngPlusOnly = ext.ngPlusOnly;
          if (ext.description && (!merged.description || merged.description.length < 60)) merged.description = ext.description;
          if (ext.notes && (!merged.notes || merged.notes.length < 30)) merged.notes = ext.notes;
          if ((ext.chapter !== undefined || ext.missable !== undefined || ext.notes || ext.description)) {
            const existing = new Set(merged.sources ?? []);
            if (!existing.has(url)) merged.sources = [...existing, url];
          }
        } catch (err) {
          // Continue with other sources
        }
      }

      if (forcedSource) {
        const existing = new Set(merged.sources ?? []);
        if (!existing.has(forcedSource)) {
          merged.sources = [...existing, forcedSource];
        }
      }
      if (areas.length > 0) {
        const combined = `${merged.description ?? ""} ${merged.notes ?? ""}`;
        const areaInf = inferFromTextByAreas(combined, areas);
        if (merged.chapter === undefined && areaInf.chapter !== undefined) merged.chapter = areaInf.chapter as Chapter;
        if (merged.missable === undefined && areaInf.missable !== undefined) merged.missable = areaInf.missable;
        if (merged.ngPlusOnly === undefined && detectNgPlusOnly(combined)) merged.ngPlusOnly = true;
      }
      if (merged.missable === undefined) merged.missable = false;
      // Reorder keys to match original to minimize diffs
      const ordered = reorderKeysPreservingOriginal(item, merged);
      updated[index] = ordered;
    }));
  });
  await Promise.all(results);
  return updated;
}

// Simple concurrency pool utility
function createPool(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const runNext = () => {
    if (active >= limit) return;
    const fn = queue.shift();
    if (!fn) return;
    fn();
  };
  return function<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const exec = () => {
        active++;
        task().then(resolve, reject).finally(() => {
          active--;
          runNext();
        });
      };
      if (active < limit) {
        exec();
      } else {
        queue.push(exec);
      }
    });
  };
}

let globalCliArgs: CliArgs;

async function main() {
  const args = parseArgs(process.argv);
  globalCliArgs = args;
  const includeIds = new Set<string>();
  if (args.include) args.include.split(",").map(s => s.trim()).filter(Boolean).forEach(id => includeIds.add(id));

  const files = collectCategoryFiles(args.target);
  if (files.length === 0) {
    console.error("No files found to process.");
    process.exit(1);
  }

  let hadDiff = false;

  for (const file of files) {
    const originalItems = loadJson(file);
    const nextItems = await enrichItems(originalItems, includeIds, args.source);
    const nextContent = JSON.stringify(nextItems, null, 2) + "\n";
    const diff = gitDiffOfStringAgainstFile(nextContent, file);
    if (diff.trim().length > 0) {
      hadDiff = true;
      console.log(`\n\n=== Diff for ${path.relative(repoRoot, file)} ===`);
      console.log(diff);
      if (args.apply) {
        saveJson(file, nextItems);
        console.log(`Applied changes to ${path.relative(repoRoot, file)}`);
      }
    } else {
      console.log(`No changes for ${path.relative(repoRoot, file)}`);
    }
  }

  if (!args.apply) {
    console.log("\nDry run complete. Re-run with --apply to write changes.");
    if (!hadDiff) console.log("No diffs detected.");
  }

  // Optional cache cleanup
  if (args.cleanCache) {
    try {
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        console.log(`Cache cleaned: ${path.relative(repoRoot, cacheDir)}`);
      }
    } catch (err) {
      console.error(`Failed to clean cache: ${String(err)}`);
    }
  }

  // Optional counts verification
  if (args.verifyCounts) {
    const ok = verifyExpectedCounts();
    if (!ok) {
      process.exitCode = 1;
    }
  }
}

function verifyExpectedCounts(): boolean {
  const expectedFile = path.resolve(repoRoot, "data", "expectedCounts.json");
  if (!fs.existsSync(expectedFile)) {
    console.error("expectedCounts.json not found under data/");
    return false;
  }
  let ok = true;
  try {
    const expected = JSON.parse(fs.readFileSync(expectedFile, "utf8")) as Record<string, number>;
    for (const [category, expectedCount] of Object.entries(expected)) {
      const filePath = path.resolve(dataDir, `${category}.json`);
      if (!fs.existsSync(filePath)) {
        console.error(`Missing file for category ${category}: ${path.relative(repoRoot, filePath)}`);
        ok = false;
        continue;
      }
      try {
        const items = JSON.parse(fs.readFileSync(filePath, "utf8")) as Item[];
        const found = Array.isArray(items) ? items.length : 0;
        if (found !== expectedCount) {
          const delta = found - expectedCount;
          const sign = delta > 0 ? "+" : "";
          console.error(`Count mismatch ${category}: expected ${expectedCount}, found ${found} (${sign}${delta}) in ${path.relative(repoRoot, filePath)}`);
          ok = false;
        }
      } catch (e) {
        console.error(`Failed to read ${path.relative(repoRoot, filePath)}: ${String(e)}`);
        ok = false;
      }
    }
  } catch (e) {
    console.error(`Failed to read expectedCounts.json: ${String(e)}`);
    return false;
  }
  if (ok) {
    console.log("All category counts match expectedCounts.json");
  }
  return ok;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


