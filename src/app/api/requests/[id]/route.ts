import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { isAdminRequest } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (!Number.isFinite(requestId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const body = await req.json();
    const status = String(body.status || "").toLowerCase();
    if (!["pending", "accepted", "rejected", "completed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const cur = await pool.query(`SELECT id, status FROM sale_requests WHERE id = $1`, [requestId]);
    if (!cur.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const prevStatus = cur.rows[0].status;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // On accept: decrement stock (only if moving from pending -> accepted)
      if (status === "accepted" && prevStatus === "pending") {
        const items = await client.query(`SELECT card_id, quantity FROM request_items WHERE request_id = $1`, [requestId]);
        for (const it of items.rows) {
          const stock = await client.query(`SELECT quantity FROM cards WHERE id = $1 FOR UPDATE`, [it.card_id]);
          const left = Number(stock.rows[0]?.quantity ?? 0);
          if (left < Number(it.quantity)) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: `Not enough stock for card #${it.card_id} (only ${left} left)` }, { status: 400 });
          }
          await client.query(`UPDATE cards SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, [it.quantity, it.card_id]);
        }
      }
      // On reject after accept: restore stock
      if (status === "rejected" && prevStatus === "accepted") {
        const items = await client.query(`SELECT card_id, quantity FROM request_items WHERE request_id = $1`, [requestId]);
        for (const it of items.rows) {
          await client.query(`UPDATE cards SET quantity = COALESCE(quantity,0) + $1, updated_at = NOW() WHERE id = $2`, [it.quantity, it.card_id]);
        }
      }
      await client.query(`UPDATE sale_requests SET status = $1, updated_at = NOW() WHERE id = $2`, [status, requestId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error("PATCH request failed", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (!Number.isFinite(requestId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const cur = await pool.query(`SELECT status FROM sale_requests WHERE id = $1`, [requestId]);
    if (cur.rows[0]?.status === "accepted") {
      const items = await pool.query(`SELECT card_id, quantity FROM request_items WHERE request_id = $1`, [requestId]);
      for (const it of items.rows) {
        await pool.query(`UPDATE cards SET quantity = COALESCE(quantity,0) + $1 WHERE id = $2`, [it.quantity, it.card_id]);
      }
    }
    await pool.query(`DELETE FROM request_items WHERE request_id = $1`, [requestId]);
    await pool.query(`DELETE FROM sale_requests WHERE id = $1`, [requestId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE request failed", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
