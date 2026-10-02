import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { isAdminRequest } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = {
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

function clean(s: unknown, max = 200): string {
  if (s === null || s === undefined) return "";
  return String(s).slice(0, max).trim();
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function keyOf(r: Row): string {
  return [r.cardName, r.setName, r.cardNumber, r.variant, r.condition].map((s) => s.toLowerCase()).join("\u0001");
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const res = await pool.query(`SELECT id, filename, row_count AS "rowCount", new_cards AS "newCards", merged_cards AS "mergedCards", total_value AS "totalValue", created_at AS "createdAt" FROM upload_batches ORDER BY id DESC LIMIT 20`);
    return NextResponse.json({ batches: res.rows });
  } catch (e) {
    console.error("GET batches failed", e);
    return NextResponse.json({ batches: [] });
  }
}

// The browser sends big CSVs in small chunks (hosting providers such as Vercel
// reject request bodies over ~4.5 MB). Each chunk is merged with set-based SQL.
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const filename: string = clean(body.filename || "upload.csv", 300) || "upload.csv";
    const rawRows: Row[] = Array.isArray(body.rows) ? body.rows : [];
    const incomingBatchId = Number(body.batchId);
    const isFinal = body.final === true;

    if (!rawRows.length) return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    if (rawRows.length > 5000) return NextResponse.json({ error: "Chunk too large (max 5,000 rows per request)" }, { status: 400 });

    const cleaned: Row[] = rawRows
      .map((r) => ({
        cardName: clean(r.cardName, 200),
        setName: clean(r.setName || "Unknown Set", 200),
        cardNumber: clean(r.cardNumber, 50),
        rarity: clean(r.rarity || "Common", 100),
        price: Math.max(0, num(r.price, 0)),
        quantity: Math.max(1, Math.min(100000, Math.round(num(r.quantity, 1)) || 1)),
        buyPct: num(r.buyPct, 0),
        buyPrice: Math.max(0, num(r.buyPrice, 0)),
        variant: clean(r.variant || "Normal", 100),
        condition: clean(r.condition || "NM", 50),
        tcg: clean(r.tcg || "pokemon", 50),
        tcgplayerId: clean(r.tcgplayerId, 100),
        productId: clean(r.productId, 100),
      }))
      .filter((r) => r.cardName.length > 0);

    if (!cleaned.length) return NextResponse.json({ error: "No valid rows (missing Card Name)" }, { status: 400 });

    let chunkValue = 0;
    for (const r of cleaned) chunkValue += r.price * r.quantity;

    // Merge duplicates inside this chunk first (same card/set/number/variant/condition)
    const merged = new Map<string, Row>();
    for (const r of cleaned) {
      const k = keyOf(r);
      const cur = merged.get(k);
      if (cur) {
        cur.quantity += r.quantity;
        cur.price = r.price;
      } else {
        merged.set(k, { ...r });
      }
    }
    const unique = [...merged.values()];

    let newCards = 0;
    let mergedCards = 0;
    let batchId = Number.isFinite(incomingBatchId) && incomingBatchId > 0 ? incomingBatchId : 0;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Which of these already exist in the vault?
      const found = await client.query(
        `SELECT DISTINCT ON (k.idx) k.idx::int AS idx, c.id
           FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[]) WITH ORDINALITY AS k(n, s, num, v, cond, idx)
           JOIN cards c
             ON lower(c.card_name) = k.n
            AND lower(COALESCE(c.set_name, '')) = k.s
            AND lower(COALESCE(c.card_number, '')) = k.num
            AND lower(COALESCE(c.variant, '')) = k.v
            AND lower(COALESCE(c.condition, '')) = k.cond
          ORDER BY k.idx, c.id`,
        [
          unique.map((r) => r.cardName.toLowerCase()),
          unique.map((r) => r.setName.toLowerCase()),
          unique.map((r) => r.cardNumber.toLowerCase()),
          unique.map((r) => r.variant.toLowerCase()),
          unique.map((r) => r.condition.toLowerCase()),
        ]
      );
      const existingByIdx = new Map<number, number>();
      for (const row of found.rows) existingByIdx.set(Number(row.idx) - 1, Number(row.id));

      const toUpdate: { id: number; r: Row }[] = [];
      const toInsert: Row[] = [];
      unique.forEach((r, i) => {
        const id = existingByIdx.get(i);
        if (id) toUpdate.push({ id, r });
        else toInsert.push(r);
      });

      // 2) Update existing cards: add quantity, refresh price + ids
      if (toUpdate.length) {
        await client.query(
          `UPDATE cards c SET
              quantity = COALESCE(c.quantity, 0) + u.qty,
              price = u.price,
              buy_pct = u.buy_pct,
              buy_price = u.buy_price,
              rarity = u.rarity,
              tcgplayer_id = u.tcg_id,
              product_id = u.prod_id,
              source_file = $9,
              updated_at = NOW()
            FROM unnest($1::int[], $2::int[], $3::real[], $4::real[], $5::real[], $6::text[], $7::text[], $8::text[])
                 AS u(id, qty, price, buy_pct, buy_price, rarity, tcg_id, prod_id)
           WHERE c.id = u.id`,
          [
            toUpdate.map((x) => x.id),
            toUpdate.map((x) => x.r.quantity),
            toUpdate.map((x) => x.r.price),
            toUpdate.map((x) => x.r.buyPct),
            toUpdate.map((x) => x.r.buyPrice),
            toUpdate.map((x) => x.r.rarity),
            toUpdate.map((x) => x.r.tcgplayerId),
            toUpdate.map((x) => x.r.productId),
            filename,
          ]
        );
        mergedCards = toUpdate.length;
      }

      // 3) Insert brand-new cards in bulk
      const INSERT_CHUNK = 800;
      for (let s = 0; s < toInsert.length; s += INSERT_CHUNK) {
        const part = toInsert.slice(s, s + INSERT_CHUNK);
        const values: (string | number)[] = [];
        const placeholders: string[] = [];
        let p = 1;
        for (const r of part) {
          placeholders.push(`($${p},$${p + 1},$${p + 2},$${p + 3},$${p + 4},$${p + 5},$${p + 6},$${p + 7},$${p + 8},$${p + 9},$${p + 10},$${p + 11},$${p + 12},$${p + 13})`);
          values.push(r.cardName, r.setName, r.cardNumber, r.rarity, r.price, r.quantity, r.buyPct, r.buyPrice, r.variant, r.condition, r.tcg, r.tcgplayerId, r.productId, filename);
          p += 14;
        }
        await client.query(
          `INSERT INTO cards (card_name, set_name, card_number, rarity, price, quantity, buy_pct, buy_price, variant, condition, tcg, tcgplayer_id, product_id, source_file) VALUES ${placeholders.join(",")}`,
          values
        );
      }
      newCards = toInsert.length;

      // 4) Track the upload batch (one history entry per file)
      if (!batchId) {
        const b = await client.query(`INSERT INTO upload_batches (filename, row_count, new_cards, merged_cards, total_value) VALUES ($1, 0, 0, 0, 0) RETURNING id`, [filename]);
        batchId = Number(b.rows[0].id);
      }
      await client.query(
        `UPDATE upload_batches SET row_count = COALESCE(row_count,0) + $1, new_cards = COALESCE(new_cards,0) + $2, merged_cards = COALESCE(merged_cards,0) + $3, total_value = COALESCE(total_value,0) + $4 WHERE id = $5`,
        [cleaned.length, newCards, mergedCards, chunkValue, batchId]
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    let totals: unknown = undefined;
    if (isFinal) {
      const t = await pool.query(`SELECT COUNT(*)::int AS cards, COALESCE(SUM(quantity),0)::int AS units, COALESCE(SUM(COALESCE(price,0)*COALESCE(quantity,0)),0)::float AS value FROM cards`);
      totals = t.rows[0];
    }

    return NextResponse.json({
      ok: true,
      batchId,
      imported: cleaned.length,
      newCards,
      mergedCards,
      totalValue: chunkValue,
      totals,
    });
  } catch (e) {
    console.error("POST /api/upload failed", e);
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: `Import failed: ${msg.slice(0, 200)}` }, { status: 500 });
  }
}
