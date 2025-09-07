#!/usr/bin/env node
// Node >= 18 (ESM). No external deps.
// Verification-aware aggregator for Wukong collectibles.
// - Resilient fetch, caching, aliasing, de-dupe, provenance
// - Strict Spells/Transformations/Weapons whitelists
// - Noise filtering, auto-fix name variants
// - JSON output + verification report

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { load as loadHtml } from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- CONFIG PATHS ----------
const root = path.resolve(process.cwd());
const dataDir = path.join(root, "data");
const catsDir = path.join(dataDir, "categories");
const cacheDir = path.join(dataDir, ".cache");
const outCombinedPath = path.join(dataDir, "wukongData.json");
const expectedCountsPath = path.join(dataDir, "expectedCounts.json");
const aliasesPath = path.join(dataDir, "aliases.json"); // optional
const verifyReportPath = path.join(dataDir, "wukong_verification_report.json");

// ---------- INPUT SOURCES ----------
const targets = {
  Spirits: [
    "https://www.powerpyx.com/black-myth-wukong-all-spirits-locations/",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  Spells: [
    "https://www.powerpyx.com/black-myth-wukong-all-spell-locations/",
    "https://www.ign.com/wikis/black-myth-wukong",
    "https://game8.co/games/Black-Myth-Wukong/archives/468355" // list of 8 spells
  ],
  Transformations: [
    "https://www.powerpyx.com/black-myth-wukong-all-spell-locations/",
    "https://www.ign.com/wikis/black-myth-wukong",
    "https://www.gamespot.com/gallery/black-myth-wukong-transformations-guide/2900-5704/"
  ],
  Weapons: [
    "https://www.powerpyx.com/black-myth-wukong-all-weapon-locations-staffs-and-spears/",
    "https://psnprofiles.com/trophy/28916-black-myth-wukong/30-staffs-and-spears",
    "https://game8.co/games/Black-Myth-Wukong/archives/468396"
  ],
  Armor: [
    "https://www.powerpyx.com/black-myth-wukong-all-armor-locations/",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  Curios: [
    "https://www.powerpyx.com/black-myth-wukong-all-curios-locations/",
    "https://game8.co/games/Black-Myth-Wukong/archives/468720",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  Vessels: [
    "https://www.powerpyx.com/black-myth-wukong-all-vessel-locations/",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  Gourds: [
    "https://www.powerpyx.com/black-myth-wukong-all-gourd-locations/",
    "https://game8.co/games/Black-Myth-Wukong/archives/468711",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  Drinks: [
    "https://www.powerpyx.com/black-myth-wukong-all-drinks-locations/",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  Soaks: [
    "https://www.powerpyx.com/black-myth-wukong-all-soaks-locations/",
    "https://game8.co/games/Black-Myth-Wukong/archives/468469",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  Seeds: [
    "https://www.powerpyx.com/black-myth-wukong-all-seed-locations/",
    "https://blackmythwukong.wiki.fextralife.com/Seeds",
    "https://psnprofiles.com/trophy/28916-black-myth-wukong/35-seeds-to-sow",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  MeditationSpots: [
    "https://www.powerpyx.com/black-myth-wukong-all-meditation-spots-locations/",
    "https://game8.co/games/Black-Myth-Wukong/archives/470912",
    "https://www.gamespot.com/gallery/black-myth-wukong-meditation-spots-guide/2900-5702/",
    "https://www.ign.com/wikis/black-myth-wukong"
  ],
  Formulas: [
    "https://www.powerpyx.com/black-myth-wukong-all-formula-locations-tattered-pages/",
    "https://game8.co/games/Black-Myth-Wukong/archives/468470",
    "https://www.ign.com/wikis/black-myth-wukong"
  ]
};

// ---------- CLI OPTIONS ----------
const argv = parseArgs(process.argv.slice(2), {
  boolean: ["strict", "dry-run", "save-html", "no-trim", "verify-only", "list-missing", "fix-names"],
  string: ["category", "concurrency"],
  default: { concurrency: "4" }
});
const ONLY_CATEGORY = argv.category || null;
const STRICT = !!argv["strict"];
const DRY_RUN = !!argv["dry-run"];
const SAVE_HTML = !!argv["save-html"];
const NO_TRIM = !!argv["no-trim"];
const VERIFY_ONLY = !!argv["verify-only"];
const LIST_MISSING = !!argv["list-missing"];
const FIX_NAMES = !!argv["fix-names"];
const FORMATS = new Set(["json"]);
const CONCURRENCY = Math.max(1, Number(argv.concurrency) || 4);

// ---------- UTIL ----------
function parseArgs(args, spec) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const isBool = (spec.boolean || []).includes(key);
      const isString = (spec.string || []).includes(key);
      if (isBool) out[key] = true;
      else if (isString) { out[key] = args[i + 1]; i++; }
      else out[key] = true;
    } else out._.push(a);
  }
  if (spec.default) Object.assign(out, { ...spec.default, ...out });
  return out;
}

function slugify(category, name) {
  return `${category}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function simplify(text) {
  return String(text).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’"“”]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function shortenName(name) {
  if (!name) return "";
  let n = String(name);
  for (let k = 0; k < 3; k++) {
    n = n.replace(/^\s*(?:(?:\d+|[ivxlcdm]+|[A-Za-z])[\.\)]|[\-–—•+])\s+/i, "");
  }
  n = n.replace(/[:\-–—]\s*$/g, "");
  n = n.replace(/\s*\(([^)]*)\)\s*$/g, "");
  n = n.replace(/\s+/g, " ").trim();
  if (!NO_TRIM && n.length > 60) n = n.slice(0, 60).trimEnd();
  return n;
}
function ensureDirs() {
  for (const p of [dataDir, catsDir, cacheDir]) if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function hash(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

// Known canonical lists (from our investigation)
// Spells (8 non-transformations) — Game8
const WL_SPELLS = [
  "Immobilize","Cloud Step","Rock Solid","A Pluck of Many",
  "Ring of Fire","Spell Binder","Somersault Cloud","Life-Saving Strand"
];
// Transformations (10) — GameSpot
const WL_TRANSFORMS = [
  "Red Tides","Azure Dust","Ashen Slumber","Ebon Flow","Hoarfrost",
  "Umbral Abyss","Violet Hail","Golden Lining","Dark Thunder","Azure Dome"
];
// Weapons (20) — names reconciled vs PowerPyx tally & Game8 item pages
const WL_WEAPONS = [
  "Adept Spine-Shooting Fuban Staff","Bishui Beast Staff","Bronze Cloud Staff","Chitin Staff",
  "Chu-Bai Spear","Cloud-Patterned Stone Staff","Dark Iron Staff","Golden Loong Staff",
  "Jingubang","Kang-Jin Staff","Loongwreathe Staff","Rat Sage Staff","Spider Celestial Staff",
  "Spikeshaft Staff","Staff of Blazing Karma","Stormflash Loong Staff","Tri-Point Double-Edged Spear",
  "Twin Serpents Staff","Visionary Centipede Staff","Wind Bear Staff"
];
// Gourds (11) — PowerPyx canonical counting
const WL_GOURDS = [
  "Trailblazer’s Scarlet Gourd",
  "Old Gourd",
  "Plaguebane Gourd",
  "Jade Lotus Gourd",
  "Fiery Gourd",
  "Xiang River Goddess Gourd",
  "Stained Jade Gourd",
  "Qing-Tian Gourd",
  "Immortal Blessing Gourd",
  "Supreme Gourd",
  "Multi-Glazed Gourd"
];

const CATEGORY_WHITELIST = {
  Spells: WL_SPELLS,
  Transformations: WL_TRANSFORMS,
  Weapons: WL_WEAPONS,
  Gourds: WL_GOURDS
};
const CATEGORY_WHITELIST_SIMPLIFIED = Object.fromEntries(
  Object.entries(CATEGORY_WHITELIST).map(([k, arr]) => [k, new Set(arr.map(simplify))])
);
const FALLBACK_SOURCES = {
  Spells: [
    "https://www.powerpyx.com/black-myth-wukong-all-spell-locations/",
    "https://game8.co/games/Black-Myth-Wukong/archives/468355"
  ],
  Transformations: [
    "https://www.gamespot.com/gallery/black-myth-wukong-transformations-guide/2900-5704/",
    "https://www.powerpyx.com/black-myth-wukong-all-spell-locations/"
  ],
  Weapons: [
    "https://www.powerpyx.com/black-myth-wukong-all-weapon-locations-staffs-and-spears/",
    "https://game8.co/games/Black-Myth-Wukong/archives/468396",
    "https://psnprofiles.com/trophy/28916-black-myth-wukong/30-staffs-and-spears"
  ],
  Gourds: [
    "https://www.powerpyx.com/black-myth-wukong-all-gourd-locations/",
    "https://game8.co/games/Black-Myth-Wukong/archives/468711"
  ]
};

// Deny-list for guide noise, trophies, materials, headers, etc.
const DENY_PATTERNS = [
  /^game tools$/i, /^site interface$/i, /^before$/i, /^after$/i, /^new game\+?$/i,
  /^drinks$/i, /^gourds$/i, /^soaks$/i,
  /^awaken wine worms?$/i, /^luojia fragrant vines?$/i, /^old[-\s]?rattle[-\s]?drum$/i,
  /^brewer'?s bounty$/i, /^a curious collection$/i, /^scenic seeker$/i,
  /^chen loong questline$/i, /^treasure hunter side questline$/i, /^master of magic$/i,
  /^recommended use:?$/i, /^staffs and spears$/i, /^secret ending$/i,
  /^other gourd items$/i, /^what can you do as a free member\??$/i
];

// ---------- FETCH ----------
async function fetchHtml(url, { timeoutMs = 15000, maxRetries = 3 } = {}) {
  const key = hash(url);
  const cacheFile = path.join(cacheDir, `${key}.html`);
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, "utf-8");
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; WukongTrackerBot/1.1)",
          "accept": "text/html,*/*;q=0.9"
        },
        redirect: "follow",
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) {
        if (res.status === 429 || String(res.status).startsWith("5")) {
          await new Promise(r => setTimeout(r, 500 * attempt));
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      if (SAVE_HTML) fs.writeFileSync(cacheFile, text, "utf-8");
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastErr?.message || lastErr}`);
}

// ---------- PARSING ----------
function pickContentRoot($) {
  return ($("main .entry-content").first().length ? $("main .entry-content").first()
    : $(".entry-content, article, .post, main, #content").first());
}
function isLikelyName(text) {
  let cleaned = String(text).replace(/^\d+\.?\s*/, "")
    .replace(/^[#*\-–]\s*/, "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return false;
  if (/locations|guide|trophy|objective|chapter|mission|video|map|reward|requirements?|area|boss|walkthrough/i.test(cleaned)) return false;
  if (/^note:|^tip:|requirements?:|^how to|get|unlock|location/i.test(cleaned)) return false;
  if (cleaned.split(" ").length > 14) return false;
  return true;
}
function extractItems($) {
  const byKey = new Map();
  const root = pickContentRoot($);
  const canonicalUrl = $('link[rel="canonical"]').attr("href") || "";
  const title = ($("title").first().text() || "").trim();

  // Tables
  root.find("table").each((_, tbl) => {
    $(tbl).find("tr").each((__, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 1) {
        const name = $(tds[0]).text().trim();
        if (!name) return;
        let description = "";
        let href = $(tds[0]).find("a[href]").attr("href") || "";
        if (tds.length > 1) {
          description = Array.from(tds).slice(1).map(td => $(td).text().trim()).filter(Boolean).join("\n");
        }
        if (!byKey.has(name)) byKey.set(name, { name, description, href });
      }
    });
  });
  // Headings + blocks
  root.find("h2, h3, h4, h5, strong, b").toArray().forEach(h => {
    const raw = $(h).text().trim();
    if (!raw || !isLikelyName(raw)) return;
    const hHref = $(h).find("a[href]").attr("href") || "";
    if (!byKey.has(raw)) byKey.set(raw, { name: raw, description: "", href: hHref });
    const parts = [];
    let el = $(h).next();
    while (el && el.length) {
      if (el.is("h2, h3, h4, h5, strong, b")) break;
      if (el.is("p, ul, ol, li")) {
        const t = el.text().trim();
        if (t) parts.push(t);
      }
      el = el.next();
    }
    const merged = parts.join("\n");
    const cur = byKey.get(raw);
    if (merged && cur && (!cur.description || merged.length > cur.description.length)) cur.description = merged;
  });
  // List items
  root.find("li").each((_, el) => {
    const txt = $(el).text().trim();
    if (!txt || !isLikelyName(txt)) return;
    const href = $(el).find("a[href]").attr("href") || "";
    if (!byKey.has(txt)) byKey.set(txt, { name: txt, description: "", href });
  });

  const pageUrl = canonicalUrl || "";
  return Array.from(byKey.values()).map(r => ({
    rawName: r.name,
    name: r.name,
    description: r.description || "",
    href: r.href || pageUrl,
    pageTitle: title
  }));
}

// ---------- NORMALIZATION ----------
function loadAliases() {
  if (!fs.existsSync(aliasesPath)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(aliasesPath, "utf-8"));
    const out = {};
    for (const [k, v] of Object.entries(j)) out[simplify(k)] = String(v);
    return out;
  } catch { return {}; }
}
function canonicalizeName(raw, aliases) {
  const simp = simplify(raw);
  if (aliases[simp]) return aliases[simp];
  // Built-in fixes for known variants/typos we saw in the wild
  const fixed = raw
    .replace(/\bGolden Loong Stand\b/i, "Golden Loong Staff")
    .replace(/\bBronze Clad Staff\b/i, "Bronze Cloud Staff")
    .replace(/\bCloud[-\s]?Patterned\b/i, "Cloud-Patterned");
  const base = fixed.replace(/\s+/g, " ").trim().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
  return base;
}
function scoreConfidence(v) {
  let score = 0;
  for (const s of v.sources) {
    if (/powerpyx\.com/.test(s)) score += 3;
    else if (/game8\.co/.test(s)) score += 3;
    else if (/ign\.com/.test(s)) score += 2;
    else if (/gamespot\.com|fextralife\.com|psnprofiles\.com/.test(s)) score += 2;
    else score += 1;
  }
  score += (v.hits || 0) * 0.5;
  return score;
}

function scoreSourceForItem(itemName, url) {
  const u = String(url || "");
  const sName = simplify(itemName).replace(/\s+/g, "-");
  let score = 0;
  if (/powerpyx\.com/.test(u)) score += 50;
  else if (/game8\.co/.test(u)) score += 40;
  else if (/gamespot\.com/.test(u)) score += 30;
  else if (/ign\.com/.test(u)) score += 20;
  else if (/fextralife\.com|psnprofiles\.com/.test(u)) score += 10;
  else score += 5;
  if (/#/.test(u)) score += 6;
  if (u.toLowerCase().includes(sName)) score += 8;
  if (u.toLowerCase().includes(encodeURIComponent(sName))) score += 4;
  // prefer shorter, cleaner URLs slightly
  score += Math.max(0, 10 - Math.floor(u.length / 50));
  return score;
}

// ---------- BUILD ----------
function buildItems(category, recs, aliases, globalSources = []) {
  const merged = new Map();
  for (const r of recs) {
    // Skip IGN hub parsing
    // (handled at fetch: we don't parse hub at all)

    // Deny-list
    const rawShort = shortenName(r.name);
    if (DENY_PATTERNS.some(rx => rx.test(rawShort))) continue;

    // Category hints to avoid cross-contamination on mixed pages
    const mark = `${r.rawName} ${r.description}`.toLowerCase();
    if (category === "Transformations" && !/transformation/.test(mark)) {
      // allow if on whitelist later
    }
    if (category === "Spells" && /transformation/.test(mark)) continue;

    const short = shortenName(r.name);
    if (!isLikelyName(short)) continue;

    const canonical = canonicalizeName(short, aliases);
    const key = simplify(canonical);

    // Apply whitelist when defined
    const wl = CATEGORY_WHITELIST_SIMPLIFIED[category];
    if (wl && !wl.has(key)) {
      // permit flow if we'll fix by whitelist fallback later
      continue;
    }

    const prev = merged.get(key) || {
      id: slugify(category, canonical),
      name: canonical, category,
      description: "",
      sources: new Set(), hits: 0, pages: new Set()
    };
    prev.hits += 1;
    if (r.description && r.description.length > (prev.description?.length || 0)) prev.description = r.description;
    if (r.href) prev.sources.add(r.href);
    if (r.pageTitle) prev.pages.add(r.pageTitle);
    merged.set(key, prev);
  }

  // Attach hub sources to all
  for (const v of merged.values()) for (const s of globalSources) v.sources.add(s);

  const items = Array.from(merged.values()).map(v => ({
    id: v.id, name: v.name, category: v.category,
    description: v.description,
    sources: Array.from(v.sources).sort((a, b) => scoreSourceForItem(v.name, b) - scoreSourceForItem(v.name, a)),
    confidence: scoreConfidence(v)
  }));

  items.sort((a, b) => (b.confidence - a.confidence) || a.name.localeCompare(b.name));
  return items;
}

// ---------- IO ----------
function writeJsonIfChanged(file, obj) {
  const next = JSON.stringify(obj, null, 2);
  const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  if (prev.trim() === next.trim()) return false;
  fs.writeFileSync(file, next, "utf-8");
  return true;
}
function toCSV(items) { /* removed (JSON only) */ }

// small concurrency controller
async function mapLimit(list, limit, worker) {
  const ret = [];
  let i = 0; const active = new Set();
  async function spawn() {
    if (i >= list.length) return;
    const idx = i++;
    const p = (async () => worker(list[idx], idx))().then(v => (ret[idx] = v)).finally(() => active.delete(p));
    active.add(p);
    if (active.size >= limit) await Promise.race(active);
    return spawn();
  }
  const starters = Array(Math.min(limit, list.length)).fill(0).map(spawn);
  await Promise.all(starters.concat(Array.from(active)));
  return ret;
}

// ---------- MAIN ----------
async function run() {
  ensureDirs();

  if (!fs.existsSync(expectedCountsPath)) {
    console.error(`Missing ${expectedCountsPath}. Aborting.`);
    process.exit(1);
  }
  const expectedCounts = JSON.parse(fs.readFileSync(expectedCountsPath, "utf-8"));

  // verify-only mode: check existing files & print report, no fetching
  if (VERIFY_ONLY) {
    const report = verifyExisting(expectedCounts);
    if (!DRY_RUN) writeJsonIfChanged(verifyReportPath, report);
    console.log(`Verification report ${DRY_RUN ? "(dry-run) " : ""}written to ${verifyReportPath}`);
    if (STRICT && report._errors?.length) process.exit(2);
    return;
  }

  const aliases = loadAliases();
  const categories = Object.entries(targets).filter(([cat]) => !ONLY_CATEGORY || ONLY_CATEGORY === cat);

  for (const [category, urls] of categories) {
    console.log(`\n=== ${category} ===`);
    const list = Array.isArray(urls) ? urls : [urls];

    const results = await mapLimit(list, CONCURRENCY, async (url) => {
      try {
        console.log(`GET ${url}`);
        const html = await fetchHtml(url);
        const $ = loadHtml(html);
        const isIgnHub = /ign\.com\/wikis\/black-myth-wukong/.test(url);
        const recs = isIgnHub ? [] : extractItems($).map((r) => ({
          rawName: r.rawName,
          name: FIX_NAMES ? canonicalizeName(r.name, aliases) : r.name,
          description: (r.description || "").replace(/[“”]/g, '"').replace(/[’]/g, "'"),
          href: r.href,
          pageTitle: r.pageTitle
        }));
        const ignHub = isIgnHub ? [url] : [];
        return { url, recs, ignHub };
      } catch (e) {
        console.warn(`  ! ${url} → ${e.message}`);
        return { url, recs: [], ignHub: [] };
      }
    });

    const allRecs = results.flatMap(r => r.recs);
    const ignHubs = results.flatMap(r => r.ignHub);

    let items = buildItems(category, allRecs, aliases, ignHubs);

    // Whitelist fallback for strict categories
    const wl = CATEGORY_WHITELIST[category];
    if (wl && items.length < wl.length) {
      console.warn(`  Using whitelist fallback for ${category}: ${items.length}/${wl.length} scraped.`);
      const sources = FALLBACK_SOURCES[category] || [];
      items = wl.map((name) => ({
        id: slugify(category, name), name, category,
        description: "", sources, confidence: 99
      }));
    }

    // Enforce expected count thresholds
    const expected = expectedCounts[category] || 0;
    const threshold = Math.floor(expected * 0.5);
    const cropped = expected > 0 && items.length > expected ? items.slice(0, expected) : items;

    console.log(`Found ${items.length} (${cropped.length} kept) vs expected ${expected} (threshold ${threshold}).`);

    if (items.length < threshold) {
      const msg = `Skipped writing ${category}: only ${items.length} < threshold ${threshold}.`;
      if (STRICT) { console.error(msg); process.exitCode = 2; }
      else { console.warn(msg); }
      continue;
    }

    // Write per-category JSON
    if (FORMATS.has("json") && !DRY_RUN) {
      const outFile = path.join(catsDir, `${category}.json`);
      const changed = writeJsonIfChanged(outFile, cropped);
      console.log(`${changed ? "Wrote" : "Unchanged"}: ${outFile}`);
    }
  }

  // Build combined dataset and a verification report for everything we wrote
  if (FORMATS.has("json")) {
    const combined = buildCombined(expectedCounts);
    if (combined) {
      if (!DRY_RUN) {
        const changed = writeJsonIfChanged(outCombinedPath, combined);
        console.log(`${changed ? "Wrote" : "Unchanged"}: ${outCombinedPath}`);
      } else {
        console.log(`(dry-run) Would write combined dataset to ${outCombinedPath}`);
      }
    }
    const report = verifyExisting(expectedCounts);
    if (!DRY_RUN) writeJsonIfChanged(verifyReportPath, report);
    console.log(`Verification report ${DRY_RUN ? "(dry-run) " : ""}written to ${verifyReportPath}`);
    if (STRICT && report._errors?.length) process.exit(2);
  }
}

function buildCombined(expectedCounts) {
  if (!fs.existsSync(catsDir)) return null;
  const files = fs.readdirSync(catsDir).filter(f => f.endsWith(".json"));
  if (files.length === 0) return null;

  const items = files.flatMap((f) => {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(catsDir, f), "utf-8"));
      return arr.map((x) => ({
        id: x.id, name: x.name, category: x.category,
        description: x.description || "", sources: x.sources || [],
        confidence: x.confidence ?? undefined
      }));
    } catch { return []; }
  });

  const bundle = {
    schemaVersion: 3,
    lastUpdated: new Date().toISOString(),
    expectedCounts,
    items
  };

  const byCat = {};
  for (const it of items) byCat[it.category] = (byCat[it.category] || 0) + 1;

  const warnings = [];
  for (const [cat, exp] of Object.entries(expectedCounts)) {
    const got = byCat[cat] || 0;
    if (exp && got && got < Math.floor(exp * 0.5)) warnings.push(`${cat}: ${got}/${exp}`);
  }
  if (warnings.length) console.warn("Low coverage warnings:", warnings.join(", "));
  return bundle;
}

// ---------- VERIFICATION ----------
function verifyExisting(expectedCounts) {
  const report = {
    timestamp: new Date().toISOString(),
    expectedCounts,
    perCategory: [],
    anomalies: [],
    _errors: []
  };
  if (!fs.existsSync(catsDir)) return report;

  const files = fs.readdirSync(catsDir).filter(f => f.endsWith(".json"));
  const wlMap = { Spells: new Set(WL_SPELLS.map(simplify)), Transformations: new Set(WL_TRANSFORMS.map(simplify)), Weapons: new Set(WL_WEAPONS.map(simplify)) };
  const deny = DENY_PATTERNS;

  for (const f of files) {
    const cat = f.replace(/\.json$/,"");
    const arr = JSON.parse(fs.readFileSync(path.join(catsDir, f), "utf-8"));
    const names = arr.map(x => shortenName(x.name)).map(canonicalizeForVerify);
    const unique = Array.from(new Set(names.map(simplify)));
    const expected = expectedCounts[cat] || 0;

    const noise = names.filter(n => deny.some(rx => rx.test(n)));
    const wl = wlMap[cat];
    let missing = [], extras = [];
    if (wl) {
      const seen = new Set(unique.map(simplify));
      missing = Array.from(wl).filter(w => !seen.has(w));
      extras  = unique.filter(n => !wl.has(simplify(n)));
    }

    report.perCategory.push({
      category: cat,
      file: f,
      count: unique.length,
      expected,
      noise: noise.slice(0, 10),
      missing: LIST_MISSING ? missing : undefined,
      extras: LIST_MISSING ? extras : undefined
    });

    // strict mismatches
    if (expected && unique.length !== expected) {
      report._errors.push(`${cat}: got ${unique.length} but expected ${expected}`);
    }
    if (wl && (missing.length || extras.length)) {
      report._errors.push(`${cat}: whitelist mismatch (missing ${missing.length}, extras ${extras.length})`);
    }
  }
  return report;
}
function canonicalizeForVerify(n) {
  return n.replace(/\bGolden Loong Stand\b/i, "Golden Loong Staff")
          .replace(/\bBronze Clad Staff\b/i, "Bronze Cloud Staff")
          .replace(/\bCloud[-\s]?Patterned\b/i, "Cloud-Patterned")
          .trim();
}

// ---------- RUN ----------
run().catch((e) => { console.error(e); process.exit(1); });
