import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { isAdminRequest } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const set = searchParams.get("set") || "";
    const rarity = searchParams.get("rarity") || "";
    const condition = searchParams.get("condition") || "";
    const variant = searchParams.get("variant") || "";
    const minPrice = searchParams.get("minPrice") || "";
    const maxPrice = searchParams.get("maxPrice") || "";
    const sort = searchParams.get("sort") || "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: (string | number)[] = [];
    let i = 1;

    if (search) {
      where.push(`(card_name ILIKE $${i} OR set_name ILIKE $${i} OR card_number ILIKE $${i} OR rarity ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (set) {
      where.push(`set_name = $${i}`);
      params.push(set);
      i++;
    }
    if (rarity) {
      where.push(`rarity = $${i}`);
      params.push(rarity);
      i++;
    }
    if (condition) {
      where.push(`condition = $${i}`);
      params.push(condition);
      i++;
    }
    if (variant) {
      where.push(`variant = $${i}`);
      params.push(variant);
      i++;
    }
    if (minPrice !== "") {
      where.push(`COALESCE(price,0) >= $${i}`);
      params.push(Number(minPrice) || 0);
      i++;
    }
    if (maxPrice !== "") {
      where.push(`COALESCE(price,0) <= $${i}`);
      params.push(Number(maxPrice) || 999999);
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sortMap: Record<string, string> = {
      newest: "id DESC",
      oldest: "id ASC",
      name_asc: "card_name ASC, set_name ASC",
      name_desc: "card_name DESC",
      price_desc: "COALESCE(price,0) DESC, quantity DESC",
      price_asc: "COALESCE(price,0) ASC",
      qty_desc: "COALESCE(quantity,0) DESC",
      value_desc: "COALESCE(price,0)*COALESCE(quantity,0) DESC",
    };
    const orderBy = sortMap[sort] || sortMap.newest;

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total, COALESCE(SUM(quantity),0)::int AS units, COALESCE(SUM(COALESCE(price,0)*COALESCE(quantity,0)),0)::float AS value FROM cards ${whereSql}`, params);
    const total = countRes.rows[0]?.total ?? 0;

    const dataRes = await pool.query(
      `SELECT id, card_name AS "cardName", set_name AS "setName", card_number AS "cardNumber", rarity, price, quantity, buy_pct AS "buyPct", buy_price AS "buyPrice", variant, condition, tcg, tcgplayer_id AS "tcgplayerId", product_id AS "productId", image_url AS "imageUrl", source_file AS "sourceFile", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM cards ${whereSql} ORDER BY ${orderBy} LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      cards: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      units: countRes.rows[0]?.units ?? 0,
      value: countRes.rows[0]?.value ?? 0,
    });
  } catch (e) {
    console.error("GET /api/cards failed", e);
    return NextResponse.json({ error: "Failed to load cards" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids") || "";
    const all = searchParams.get("all") === "true";
    if (all) {
      await pool.query(`DELETE FROM request_items`);
      await pool.query(`DELETE FROM cards`);
      await pool.query(`DELETE FROM upload_batches`);
      return NextResponse.json({ ok: true, deletedAll: true });
    }
    const ids = idsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
    if (!ids.length) return NextResponse.json({ error: "No ids" }, { status: 400 });
    await pool.query(`DELETE FROM request_items WHERE card_id = ANY($1)`, [ids]);
    const res = await pool.query(`DELETE FROM cards WHERE id = ANY($1)`, [ids]);
    return NextResponse.json({ ok: true, deleted: res.rowCount });
  } catch (e) {
    console.error("DELETE /api/cards failed", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
