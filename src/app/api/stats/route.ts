import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const totals = await pool.query(`
      SELECT COUNT(*)::int AS "totalRows",
             COALESCE(SUM(quantity),0)::int AS "totalUnits",
             COALESCE(SUM(COALESCE(price,0)*COALESCE(quantity,0)),0)::float AS "totalValue",
             COUNT(DISTINCT set_name)::int AS "totalSets",
             COUNT(DISTINCT rarity)::int AS "totalRarities"
      FROM cards
    `);
    const topSets = await pool.query(`
      SELECT set_name AS name, COUNT(*)::int AS rows, COALESCE(SUM(quantity),0)::int AS units, COALESCE(SUM(COALESCE(price,0)*COALESCE(quantity,0)),0)::float AS value
      FROM cards GROUP BY set_name ORDER BY value DESC LIMIT 8
    `);
    const rarities = await pool.query(`
      SELECT COALESCE(NULLIF(rarity,''),'Unknown') AS name, COUNT(*)::int AS rows, COALESCE(SUM(quantity),0)::int AS units
      FROM cards GROUP BY rarity ORDER BY rows DESC LIMIT 10
    `);
    const topCards = await pool.query(`
      SELECT id, card_name AS "cardName", set_name AS "setName", card_number AS "cardNumber", rarity, price, quantity, variant, condition, image_url AS "imageUrl"
      FROM cards ORDER BY COALESCE(price,0)*COALESCE(quantity,0) DESC LIMIT 6
    `);
    const recent = await pool.query(`
      SELECT id, card_name AS "cardName", set_name AS "setName", card_number AS "cardNumber", rarity, price, quantity, variant, condition, image_url AS "imageUrl", created_at AS "createdAt"
      FROM cards ORDER BY id DESC LIMIT 8
    `);
    const reqStats = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status='pending')::int AS pending,
             COUNT(*) FILTER (WHERE status='accepted')::int AS accepted,
             COALESCE(SUM(total_value) FILTER (WHERE status IN ('pending','accepted')),0)::float AS pipeline
      FROM sale_requests
    `);

    return NextResponse.json({
      totals: totals.rows[0],
      topSets: topSets.rows,
      rarities: rarities.rows,
      topCards: topCards.rows,
      recent: recent.rows,
      requests: reqStats.rows[0],
    });
  } catch (e) {
    console.error("GET /api/stats failed", e);
    return NextResponse.json({ error: "stats failed" }, { status: 500 });
  }
}
