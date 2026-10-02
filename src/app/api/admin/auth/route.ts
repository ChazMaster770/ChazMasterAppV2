import { NextRequest, NextResponse } from "next/server";
import { checkPin, createAdminToken, verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return NextResponse.json({ isAdmin: verifyAdminToken(token) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = String(body?.pin ?? "");
    if (!checkPin(pin)) {
      return NextResponse.json({ error: "Incorrect admin code" }, { status: 401 });
    }
    const token = createAdminToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    console.error("admin login failed", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
