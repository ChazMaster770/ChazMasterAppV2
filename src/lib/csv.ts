// CSV parsing + header mapping for CardUploader exports
import Papa from "papaparse";

export type NormalizedCardRow = {
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  price: number;
  quantity: number;
  buyPct: number;
  buyPrice: number;
  variant: string;
  condition: string;
  tcg: string;
  tcgplayerId: string;
  productId: string;
};

export const TARGET_FIELDS: { key: keyof NormalizedCardRow; label: string; aliases: string[] }[] = [
  { key: "cardName", label: "Card Name", aliases: ["cardname", "card name", "name", "card", "productname"] },
  { key: "setName", label: "Set", aliases: ["set", "setname", "set name", "expansion", "set_name"] },
  { key: "cardNumber", label: "Card Number", aliases: ["cardnum", "card num", "cardnumber", "card number", "number", "cardno", "card no", "no", "#", "num"] },
  { key: "rarity", label: "Rarity", aliases: ["rarity"] },
  { key: "price", label: "Price", aliases: ["price", "marketprice", "market price", "tcgplayerprice", "market", "value"] },
  { key: "quantity", label: "Quantity", aliases: ["quantity", "qty", "count", "amount", "stock"] },
  { key: "buyPct", label: "Buy %", aliases: ["buy%", "buy %", "buypct", "buy pct", "buypercent"] },
  { key: "buyPrice", label: "Buy Price", aliases: ["buyprice", "buy price"] },
  { key: "variant", label: "Variant", aliases: ["variant", "pricevariant", "price variant", "foil", "finish", "printing", "edition", "holo"] },
  { key: "condition", label: "Condition", aliases: ["condition", "cond", "grade", "tcgcondition"] },
  { key: "tcg", label: "TCG", aliases: ["tcg", "game", "category"] },
  { key: "tcgplayerId", label: "TCGplayer ID", aliases: ["tcgplayer", "tcgplayerid", "tcgplayer id", "tcgid"] },
  { key: "productId", label: "Product ID", aliases: ["productid", "product id", "tcgplayerproductid", "product_id", "id"] },
];

function normHeader(h: string): string {
  return (h || "").toString().trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").replace(/[^\w\s%#]/g, "").trim();
}

export function autoMapHeaders(headers: string[]): Record<string, keyof NormalizedCardRow | ""> {
  const map: Record<string, keyof NormalizedCardRow | ""> = {};
  const used = new Set<string>();
  for (const h of headers) {
    const n = normHeader(h);
    const nNoSpace = n.replace(/\s/g, "");
    let found: keyof NormalizedCardRow | "" = "";
    for (const field of TARGET_FIELDS) {
      if (used.has(field.key)) continue;
      for (const alias of field.aliases) {
        const a = normHeader(alias);
        const aNoSpace = a.replace(/\s/g, "");
        if (n === a || nNoSpace === aNoSpace || n.includes(a) || (a.length > 3 && aNoSpace.includes(nNoSpace) && nNoSpace.length > 2)) {
          found = field.key;
          break;
        }
      }
      if (found) break;
    }
    // positional fallback for CardUploader layout: Card Name, Set, Card Num, Rarity, Price, Quantity, Buy %, Buy Price, ...
    if (!found) {
      const idx = headers.indexOf(h);
      const positional: (keyof NormalizedCardRow)[] = ["cardName", "setName", "cardNumber", "rarity", "price", "quantity", "buyPct", "buyPrice", "variant", "condition", "tcg", "tcgplayerId", "productId"];
      if (idx < positional.length && !used.has(positional[idx])) {
        // only apply positional if headers look like carduploader (first header contains card)
        const first = normHeader(headers[0] || "");
        if (first.includes("card") || first.includes("name")) {
          found = positional[idx];
        }
      }
    }
    if (found) used.add(found);
    map[h] = found;
  }
  return map;
}

export function parseCsvText(csvText: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = (res.meta.fields || []).map((h) => (h || "").trim()).filter(Boolean);
        resolve({ headers, rows: res.data });
      },
      error: (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
    });
  });
}

function toNum(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const s = String(v).replace(/[$,\s%]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v: unknown, fallback = 1): number {
  const n = toNum(v, fallback);
  const i = Math.round(n);
  return Number.isFinite(i) && i >= 0 ? i : fallback;
}

export function normalizeRows(
  rawRows: Record<string, string>[],
  headerMap: Record<string, keyof NormalizedCardRow | "">
): NormalizedCardRow[] {
  const reverse: Record<string, string> = {};
  for (const [header, field] of Object.entries(headerMap)) {
    if (field) reverse[field] = header;
  }
  const out: NormalizedCardRow[] = [];
  for (const r of rawRows) {
    const get = (field: keyof NormalizedCardRow): string => {
      const h = reverse[field];
      if (!h) return "";
      return (r[h] ?? "").toString().trim();
    };
    const cardName = get("cardName");
    if (!cardName) continue;
    out.push({
      cardName,
      setName: get("setName") || "Unknown Set",
      cardNumber: get("cardNumber") || "",
      rarity: get("rarity") || "Common",
      price: toNum(get("price"), 0),
      quantity: Math.max(1, toInt(get("quantity"), 1)),
      buyPct: toNum(get("buyPct"), 0),
      buyPrice: toNum(get("buyPrice"), 0),
      variant: get("variant") || "Normal",
      condition: get("condition") || "NM",
      tcg: get("tcg") || "pokemon",
      tcgplayerId: get("tcgplayerId") || "",
      productId: get("productId") || "",
    });
  }
  return out;
}

export const SAMPLE_CSV = `Card Name,Set,Card Num,Rarity,Price,Quantity,Buy %,Buy Price,Variant,Condition,TCG,TCGplayer ID,Product ID
Meditite,Rebel Clash,97,Common,0.04,1,,0.04,Normal,NM,pokemon,4410915,213185
Galarian Farfetch'd,Rebel Clash,94,Common,0.06,1,,0.06,Normal,NM,pokemon,4410885,213182
Dreepy,Rebel Clash,89,Common,0.12,1,,0.12,Normal,NM,pokemon,4410835,213175
Milcery,Rebel Clash,86,Common,0.24,1,,0.24,Normal,NM,pokemon,4410805,213172
Palossand,Rebel Clash,82,Uncommon,0.07,1,,0.07,Normal,NM,pokemon,4410765,213168
Sandygast,Rebel Clash,81,Common,0.19,1,,0.19,Normal,NM,pokemon,4410755,213167
Galarian Corsola,Rebel Clash,78,Common,0.09,1,,0.09,Reverse Holo,NM,pokemon,4410725,213164
Natu,Rebel Clash,76,Common,0.06,1,,0.06,Normal,NM,pokemon,4410705,213162
Toxel,Rebel Clash,68,Common,0.05,1,,0.05,Normal,NM,pokemon,4410635,213152
Charjabug,Rebel Clash,65,Uncommon,0.11,1,,0.11,Normal,NM,pokemon,4410605,213148
Helioptile,Rebel Clash,63,Common,0.04,1,,0.04,Normal,NM,pokemon,4410585,213146
Pikachu,Scarlet & Violet Promos,027,Promo,4.99,2,,4.99,Holo,NM,pokemon,530211,306123
Charizard ex,Obsidian Flames,125,Double Rare,28.50,1,,28.50,Holo,NM,pokemon,540112,312884
Mewtwo,Vivid Voltage,30,Holo Rare,2.10,3,,2.10,Holo,LP,pokemon,220114,178221
`;
