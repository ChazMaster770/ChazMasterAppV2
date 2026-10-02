import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { resolveCardImage } from "@/lib/pokemon-tcg";
import { isAdminRequest } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const res = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE image_url IS NOT NULL AND image_url <> '')::int AS "withImages",
             COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '')::int AS "withoutImages"
      FROM cards
    `);
    return NextResponse.json(res.rows[0]);
  } catch (e) {
    console.error("backfill status failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// POST { limit?: number } — resolves images for cards missing them, in batches.
// Call repeatedly from the UI until remaining = 0.
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    let limit = 12;
    try {
      const body = await req.json();
      if (body && Number.isFinite(Number(body.limit))) {
        limit = Math.max(1, Math.min(40, Number(body.limit)));
      }
    } catch {
      // no body
    }

    const rows = await pool.query(
      `SELECT id, card_name AS "cardName", set_name AS "setName", card_number AS "cardNumber"
       FROM cards WHERE image_url IS NULL OR image_url = '' ORDER BY id ASC LIMIT $1`,
      [limit]
    );

    const hasKey = !!process.env.POKEMONTCG_API_KEY;
    const pause = hasKey ? 150 : 600; // be polite to free tier

    let updated = 0;
    let failed = 0;
    const details: { id: number; name: string; ok: boolean; image?: string }[] = [];

    for (const row of rows.rows) {
      try {
        const found = await resolveCardImage(row.cardName, row.setName || "", row.cardNumber || "");
        if (found) {
          await pool.query(`UPDATE cards SET image_url = $1, updated_at = NOW() WHERE id = $2`, [found.small, row.id]);
          updated++;
          details.push({ id: row.id, name: row.cardName, ok: true, image: found.small });
        } else {
          failed++;
          details.push({ id: row.id, name: row.cardName, ok: false });
        }
      } catch {
        failed++;
        details.push({ id: row.id, name: row.cardName, ok: false });
      }
      await delay(pause);
    }

    const remaining = await pool.query(
      `SELECT COUNT(*)::int AS c FROM cards WHERE image_url IS NULL OR image_url = ''`
    );

    return NextResponse.json({
      ok: true,
      processed: rows.rows.length,
      updated,
      failed,
      remaining: remaining.rows[0]?.c ?? 0,
      hasApiKey: hasKey,
      details,
    });
  } catch (e) {
    console.error("backfill failed", e);
    return NextResponse.json({ error: "backfill failed" }, { status: 500 });
  }
}
