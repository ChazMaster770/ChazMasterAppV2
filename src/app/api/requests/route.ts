import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { isAdminRequest } from "@/lib/admin";

export const dynamic = "force-dynamic";

const ALLOWED_CHANNELS = new Set(["in-app", "email", "whatsapp"]);

export async function GET(req: NextRequest) {
  // Contains buyer contact info — admin only. The homepage badge count uses
  // a lightweight ?status=pending call which is also gated the same way.
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required", requests: [], total: 0 }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const where = status ? `WHERE r.status = $1` : "";
    const params = status ? [status] : [];
    const list = await pool.query(
      `SELECT r.id, r.requester_name AS "requesterName", r.requester_contact AS "requesterContact", r.message, r.status, r.channel, r.total_value AS "totalValue", r.item_count AS "itemCount", r.created_at AS "createdAt", r.updated_at AS "updatedAt"
       FROM sale_requests r ${where} ORDER BY r.id DESC LIMIT 100`,
      params
    );
    // attach items
    for (const r of list.rows) {
      const items = await pool.query(
        `SELECT ri.id, ri.request_id AS "requestId", ri.card_id AS "cardId", ri.card_name AS "cardName", ri.set_name AS "setName", ri.card_number AS "cardNumber", ri.rarity, ri.condition, ri.variant, ri.quantity, ri.price_each AS "priceEach", c.price AS "currentPrice", c.quantity AS "stockLeft", c.image_url AS "imageUrl"
         FROM request_items ri LEFT JOIN cards c ON c.id = ri.card_id WHERE ri.request_id = $1 ORDER BY ri.id ASC`,
        [r.id]
      );
      r.items = items.rows;
    }
    const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM sale_requests ${where}`, params);
    return NextResponse.json({ requests: list.rows, total: totalRes.rows[0]?.total ?? list.rows.length });
  } catch (e) {
    console.error("GET requests failed", e);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Public on purpose — friends submit sale requests from the shop without logging in.
  try {
    const body = await req.json();
    const requesterName = String(body.requesterName || "").trim().slice(0, 100);
    const requesterContact = String(body.requesterContact || "").trim().slice(0, 200);
    const message = String(body.message || "").trim().slice(0, 1000);
    const channelRaw = String(body.channel || "in-app").toLowerCase().trim();
    const channel = ALLOWED_CHANNELS.has(channelRaw) ? channelRaw : "in-app";
    const items: { cardId: number; quantity: number }[] = Array.isArray(body.items) ? body.items : [];

    if (!requesterName) return NextResponse.json({ error: "Please add your name" }, { status: 400 });
    if (!requesterContact) return NextResponse.json({ error: "Please add email / phone / discord so Chaz can reach you" }, { status: 400 });
    if (!items.length) return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
    if (items.length > 200) return NextResponse.json({ error: "Too many items (max 200)" }, { status: 400 });

    // Validate stock + snapshot prices
    const cleanItems: { cardId: number; quantity: number }[] = items
      .map((it) => ({ cardId: Number(it.cardId), quantity: Math.max(1, Math.min(999, Math.round(Number(it.quantity) || 1))) }))
      .filter((it) => Number.isFinite(it.cardId));

    if (!cleanItems.length) return NextResponse.json({ error: "Invalid items" }, { status: 400 });

    const ids = [...new Set(cleanItems.map((i) => i.cardId))];
    const cardsRes = await pool.query(
      `SELECT id, card_name AS "cardName", set_name AS "setName", card_number AS "cardNumber", rarity, condition, variant, price, quantity FROM cards WHERE id = ANY($1)`,
      [ids]
    );
    const byId = new Map(cardsRes.rows.map((c) => [c.id, c]));
    for (const it of cleanItems) {
      const c = byId.get(it.cardId);
      if (!c) return NextResponse.json({ error: `Card #${it.cardId} no longer exists` }, { status: 400 });
      if ((c.quantity ?? 0) < it.quantity) {
        return NextResponse.json({ error: `"${c.cardName}" only has ${c.quantity} left in stock` }, { status: 400 });
      }
    }

    let totalValue = 0;
    let itemCount = 0;
    for (const it of cleanItems) {
      const c = byId.get(it.cardId);
      totalValue += Number(c.price || 0) * it.quantity;
      itemCount += it.quantity;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const rRes = await client.query(
        `INSERT INTO sale_requests (requester_name, requester_contact, message, status, channel, total_value, item_count) VALUES ($1,$2,$3,'pending',$4,$5,$6) RETURNING id`,
        [requesterName, requesterContact, message, channel, totalValue, itemCount]
      );
      const requestId = rRes.rows[0].id;
      for (const it of cleanItems) {
        const c = byId.get(it.cardId);
        await client.query(
          `INSERT INTO request_items (request_id, card_id, card_name, set_name, card_number, rarity, condition, variant, quantity, price_each) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [requestId, c.id, c.cardName, c.setName, c.cardNumber, c.rarity, c.condition, c.variant, it.quantity, Number(c.price || 0)]
        );
      }
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, requestId, totalValue, itemCount });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("POST request failed", e);
    return NextResponse.json({ error: "Could not send request" }, { status: 500 });
  }
}
