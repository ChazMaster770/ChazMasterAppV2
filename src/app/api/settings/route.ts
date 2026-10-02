import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { isAdminRequest } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Public: shop page needs this to build mailto:/wa.me links for buyers.
export async function GET() {
  try {
    const res = await pool.query(
      `SELECT admin_email AS "adminEmail", admin_whatsapp AS "adminWhatsapp" FROM site_settings WHERE id = 1`
    );
    const row = res.rows[0] || { adminEmail: "", adminWhatsapp: "" };
    return NextResponse.json(row);
  } catch (e) {
    console.error("GET settings failed", e);
    return NextResponse.json({ adminEmail: "", adminWhatsapp: "" });
  }
}

// Admin-only: update contact channels used for buyer order sharing.
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const adminEmail = String(body.adminEmail ?? "").trim().slice(0, 200);
    const adminWhatsapp = String(body.adminWhatsapp ?? "").replace(/[^\d]/g, "").slice(0, 20);

    await pool.query(
      `INSERT INTO site_settings (id, admin_email, admin_whatsapp, updated_at)
       VALUES (1, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET admin_email = $1, admin_whatsapp = $2, updated_at = NOW()`,
      [adminEmail, adminWhatsapp]
    );

    return NextResponse.json({ ok: true, adminEmail, adminWhatsapp });
  } catch (e) {
    console.error("PATCH settings failed", e);
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }
}
