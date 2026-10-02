import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [sets, rarities, conditions, variants] = await Promise.all([
      pool.query(`SELECT DISTINCT set_name AS v, COUNT(*)::int AS c FROM cards WHERE set_name IS NOT NULL AND set_name <> '' GROUP BY set_name ORDER BY set_name ASC LIMIT 500`),
      pool.query(`SELECT DISTINCT rarity AS v, COUNT(*)::int AS c FROM cards WHERE rarity IS NOT NULL AND rarity <> '' GROUP BY rarity ORDER BY c DESC LIMIT 100`),
      pool.query(`SELECT DISTINCT condition AS v, COUNT(*)::int AS c FROM cards WHERE condition IS NOT NULL AND condition <> '' GROUP BY condition ORDER BY c DESC LIMIT 50`),
      pool.query(`SELECT DISTINCT variant AS v, COUNT(*)::int AS c FROM cards WHERE variant IS NOT NULL AND variant <> '' GROUP BY variant ORDER BY c DESC LIMIT 50`),
    ]);
    return NextResponse.json({
      sets: sets.rows,
      rarities: rarities.rows,
      conditions: conditions.rows,
      variants: variants.rows,
    });
  } catch (e) {
    console.error("filters failed", e);
    return NextResponse.json({ sets: [], rarities: [], conditions: [], variants: [] });
  }
}
