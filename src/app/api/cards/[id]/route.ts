import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { isAdminRequest } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const cardId = parseInt(id, 10);
    if (!Number.isFinite(cardId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const body = await req.json();
    const allowed: Record<string, string> = {
      cardName: "card_name",
      setName: "set_name",
      cardNumber: "card_number",
      rarity: "rarity",
      price: "price",
      quantity: "quantity",
      buyPct: "buy_pct",
      buyPrice: "buy_price",
      variant: "variant",
      condition: "condition",
      tcg: "tcg",
      tcgplayerId: "tcgplayer_id",
      productId: "product_id",
      imageUrl: "image_url",
    };
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(allowed)) {
      if (body[k] !== undefined) {
        sets.push(`${col} = $${i}`);
        vals.push(body[k]);
        i++;
      }
    }
    if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    sets.push(`updated_at = NOW()`);
    vals.push(cardId);
    const res = await pool.query(
      `UPDATE cards SET ${sets.join(", ")} WHERE id = $${i} RETURNING id, card_name AS "cardName", set_name AS "setName", card_number AS "cardNumber", rarity, price, quantity, variant, condition`,
      vals
    );
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ card: res.rows[0] });
  } catch (e) {
    console.error("PATCH card failed", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const cardId = parseInt(id, 10);
    if (!Number.isFinite(cardId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    await pool.query(`DELETE FROM request_items WHERE card_id = $1`, [cardId]);
    await pool.query(`DELETE FROM cards WHERE id = $1`, [cardId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE card failed", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
