// Pokémon TCG API (pokemontcg.io) image resolver
// Docs: https://pokemontcg.io — GET https://api.pokemontcg.io/v2/cards?q=name:charizard
// Free tier works without key; set POKEMONTCG_API_KEY env for higher limits.
//
// NOTE: the public API is occasionally flaky (500/502 on complex queries),
// so we use simple queries + retries + client-side scoring for reliability.

export type TcgImageResult = {
  small: string;
  large: string;
  apiId: string;
  name: string;
  setName: string;
  number: string;
  rarity: string;
};

type ApiCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: { name?: string; id?: string };
  images?: { small?: string; large?: string };
};

function apiKey(): string | undefined {
  return process.env.POKEMONTCG_API_KEY || undefined;
}

function esc(v: string): string {
  return v.replace(/"/g, "").trim();
}

// Normalize set names: CardUploader vs pokemontcg.io differences
export function normalizeSetName(set: string): string {
  const s = (set || "").trim();
  const low = s.toLowerCase();
  if (!s) return s;
  if (low.includes("151")) return "151";
  if (low === "sv promos" || low === "scarlet & violet promos" || low === "scarlet violet promos" || low === "svp") {
    return "Scarlet & Violet Black Star Promos";
  }
  if (low === "swsh promos" || low === "sword & shield promos") return "SWSH Black Star Promos";
  if (low === "sm promos" || low === "sun & moon promos") return "SM Black Star Promos";
  if (low.includes("black star promos") && low.includes("svp")) return "Scarlet & Violet Black Star Promos";
  if (low.includes("prismatic evolutions")) return "Prismatic Evolutions";
  if (low.includes("obsidian flames")) return "Obsidian Flames";
  if (low.includes("rebel clash")) return "Rebel Clash";
  if (low.includes("evolving skies")) return "Evolving Skies";
  if (low.includes("vivid voltage")) return "Vivid Voltage";
  if (low.includes("lost origin")) return "Lost Origin";
  return s;
}

function stripLeadingZeros(n: string): string {
  const t = (n || "").trim();
  if (!t) return "";
  const m = t.match(/^0+(\d+.*)$/);
  return m ? m[1] : t;
}

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[&']/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function setScore(want: string, got: string): number {
  if (!want || !got) return 0;
  const w = want.toLowerCase().trim();
  const g = got.toLowerCase().trim();
  if (w === g) return 12;
  if (g.includes(w) || w.includes(g)) return 8;
  const wt = new Set(tokens(w));
  const gt = new Set(tokens(g));
  let overlap = 0;
  for (const t of wt) if (gt.has(t)) overlap++;
  if (overlap === 0) return 0;
  return Math.min(8, overlap * 3);
}

function nameScore(want: string, got: string): number {
  const w = (want || "").toLowerCase().trim();
  const g = (got || "").toLowerCase().trim();
  if (!w || !g) return 0;
  if (w === g) return 12;
  const strip = (s: string) =>
    s
      .replace(/\s+(ex|gx|v|vmax|vstar|v-union|star|prime|legend|break|lv\.?x)\s*$/i, "")
      .replace(/^(galarian|hisuian|alolan|paldean)\s+/i, "")
      .trim();
  if (strip(w) === strip(g)) return 9;
  if (g.includes(w) || w.includes(g)) return 6;
  const wt = tokens(w);
  const gt = new Set(tokens(g));
  const hit = wt.filter((t) => gt.has(t)).length;
  return Math.min(6, hit * 2);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function queryApiOnce(q: string, pageSize: number, page = 1, orderBy = ""): Promise<ApiCard[] | null> {
  let url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}&select=id,name,number,set,images,rarity`;
  if (orderBy) url += `&orderBy=${encodeURIComponent(orderBy)}`;
  const headers: Record<string, string> = {};
  const key = apiKey();
  if (key) headers["X-Api-Key"] = key;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) return null; // retryable
    if (!res.ok) return [];
    const text = await res.text();
    if (!text) return null;
    const json = JSON.parse(text) as { data?: ApiCard[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return null; // network/timeout — retryable
  } finally {
    clearTimeout(timer);
  }
}

// Retry wrapper with exponential backoff for the flaky public API
async function queryApi(q: string, pageSize = 20, page = 1, tries = 3, orderBy = ""): Promise<ApiCard[]> {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const res = await queryApiOnce(q, pageSize, page, orderBy);
    if (res !== null) return res;
    if (attempt < tries) await sleep(700 * attempt + Math.random() * 400);
  }
  return [];
}

function baseName(name: string): string {
  return name
    .replace(/\s+(ex|gx|v|vmax|vstar|v-union|star|prime|legend|break|lv\.?x)\s*$/i, "")
    .replace(/^(galarian|hisuian|alolan|paldean)\s+/i, "")
    .trim();
}

function scoreCandidate(
  c: ApiCard,
  wantName: string,
  wantSet: string,
  wantNumRaw: string,
  wantNumStripped: string
): number {
  let score = 0;
  score += nameScore(wantName, c.name);
  if (wantNumStripped && c.number) {
    const gotNum = stripLeadingZeros(c.number);
    if (gotNum.toLowerCase() === wantNumStripped.toLowerCase() || c.number.toLowerCase() === wantNumRaw.toLowerCase()) {
      score += 14;
    }
  }
  score += setScore(wantSet, c.set?.name || "");
  return score;
}

export async function resolveCardImage(
  cardName: string,
  setName: string,
  cardNumber: string
): Promise<TcgImageResult | null> {
  const name = esc(cardName || "");
  if (!name) return null;
  const setNorm = normalizeSetName(setName || "");
  const numRaw = (cardNumber || "").trim();
  const numStripped = stripLeadingZeros(numRaw);

  const bestRef: { current: { card: ApiCard; score: number } | null } = { current: null };
  const consider = (list: ApiCard[]) => {
    for (const c of list) {
      if (!c.images?.small) continue;
      const score = scoreCandidate(c, name, setNorm || setName, numRaw, numStripped);
      if (!bestRef.current || score > bestRef.current.score) bestRef.current = { card: c, score };
    }
  };
  const bestScore = () => bestRef.current?.score ?? -1;

  // Strategy: simple queries only (wildcard+number combos 500/502 often).
  // 1) Precise: name + number (no set filter — score set locally).
  //    Try full name and base name (without ex/V/VMAX suffixes).
  if (numRaw) {
    const namesToTry = [name];
    const base = baseName(name);
    if (base && base.toLowerCase() !== name.toLowerCase()) namesToTry.push(base);
    const numsToTry = [numRaw];
    if (numStripped && numStripped !== numRaw) numsToTry.push(numStripped);
    for (const n of namesToTry) {
      for (const nm of numsToTry) {
        consider(await queryApi(`name:"${n}" number:${nm}`, 12));
        if (bestScore() >= 32 && bestRef.current) return toResult(bestRef.current.card);
        await sleep(200);
      }
    }
  }

  // 2) Broad: all printings of this name, score locally (handles set mismatches).
  //    Newest first (user's bulk is modern), then oldest-first for vintage.
  if (bestScore() < 26) {
    consider(await queryApi(`name:"${name}"`, 60, 1, 3, "-set.releaseDate"));
    if (bestScore() < 20) {
      await sleep(250);
      consider(await queryApi(`name:"${name}"`, 60, 1, 2));
    } else if (bestScore() < 26 && name.split(/\s+/).length <= 2) {
      // page 2 (newest-first) for very common names (Pikachu etc.)
      await sleep(250);
      consider(await queryApi(`name:"${name}"`, 60, 2, 2, "-set.releaseDate"));
    }
  }

  // 3) Fuzzy: first-word wildcard for punctuated names (Farfetch'd, Mr. Mime…)
  if (bestScore() < 12) {
    const first = tokens(name)[0];
    if (first && first.length >= 3) {
      await sleep(250);
      consider(await queryApi(`name:${first}*`, 40, 1, 3, "-set.releaseDate"));
    }
  }

  if (!bestRef.current || bestRef.current.score < 8) return null;
  return toResult(bestRef.current.card);
}

function toResult(c: ApiCard): TcgImageResult {
  return {
    small: c.images!.small!,
    large: c.images!.large || c.images!.small!,
    apiId: c.id,
    name: c.name,
    setName: c.set?.name || "",
    number: c.number,
    rarity: c.rarity || "",
  };
}
