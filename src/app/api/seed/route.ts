import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { isAdminRequest } from "@/lib/admin";

// Demo seed matching the CardUploader Rebel Clash screenshot + a few hits
const SEED = [
  ["Meditite", "Rebel Clash", "97", "Common", 0.04, 4, "Normal", "NM", "4410915", "213185"],
  ["Galarian Farfetch'd", "Rebel Clash", "94", "Common", 0.06, 6, "Normal", "NM", "4410885", "213182"],
  ["Dreepy", "Rebel Clash", "89", "Common", 0.12, 8, "Normal", "NM", "4410835", "213175"],
  ["Milcery", "Rebel Clash", "86", "Common", 0.24, 5, "Normal", "NM", "4410805", "213172"],
  ["Palossand", "Rebel Clash", "82", "Uncommon", 0.07, 3, "Normal", "NM", "4410765", "213168"],
  ["Sandygast", "Rebel Clash", "81", "Common", 0.19, 7, "Normal", "NM", "4410755", "213167"],
  ["Galarian Corsola", "Rebel Clash", "78", "Common", 0.09, 4, "Reverse Holo", "NM", "4410725", "213164"],
  ["Natu", "Rebel Clash", "76", "Common", 0.06, 9, "Normal", "NM", "4410705", "213162"],
  ["Toxel", "Rebel Clash", "68", "Common", 0.05, 12, "Normal", "NM", "4410635", "213152"],
  ["Charjabug", "Rebel Clash", "65", "Uncommon", 0.11, 5, "Normal", "NM", "4410605", "213148"],
  ["Helioptile", "Rebel Clash", "63", "Common", 0.04, 10, "Normal", "NM", "4410585", "213146"],
  ["Pikachu", "Scarlet & Violet Promos", "027", "Promo", 4.99, 2, "Holo", "NM", "530211", "306123"],
  ["Charizard ex", "Obsidian Flames", "125", "Double Rare", 28.5, 1, "Holo", "NM", "540112", "312884"],
  ["Mewtwo", "Vivid Voltage", "30", "Holo Rare", 2.1, 3, "Holo", "LP", "220114", "178221"],
  ["Gengar", "Lost Origin", "66", "Holo Rare", 1.85, 2, "Holo", "NM", "480221", "289114"],
  ["Umbreon V", "Evolving Skies", "94", "Ultra Rare", 12.4, 1, "Holo", "NM", "250881", "201445"],
  ["Rayquaza VMAX", "Evolving Skies", "111", "Secret Rare", 34.99, 1, "Holo", "NM", "250999", "201612"],
  ["Eevee", "Prismatic Evolutions", "074", "Common", 0.45, 15, "Normal", "NM", "610552", "355201"],
  ["Snorlax", "Scarlet & Violet 151", "143", "Holo Rare", 1.25, 4, "Holo", "NM", "560118", "331902"],
  ["Mew ex", "Scarlet & Violet 151", "151", "Double Rare", 18.75, 1, "Holo", "NM", "560201", "332010"],
] as const;

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const count = await pool.query(`SELECT COUNT(*)::int AS c FROM cards`);
    if ((count.rows[0]?.c ?? 0) > 0) {
      return NextResponse.json({ ok: true, skipped: true, message: "Collection already has cards" });
    }
    for (const [name, set, num, rarity, price, qty, variant, cond, tcgId, prodId] of SEED) {
      await pool.query(
        `INSERT INTO cards (card_name, set_name, card_number, rarity, price, quantity, variant, condition, tcg, tcgplayer_id, product_id, source_file) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pokemon',$9,$10,'demo-seed')`,
        [name, set, num, rarity, price, qty, variant, cond, tcgId, prodId]
      );
    }
    return NextResponse.json({ ok: true, seeded: SEED.length });
  } catch (e) {
    console.error("seed failed", e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
