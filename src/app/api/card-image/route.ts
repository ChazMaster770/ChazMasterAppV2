import { NextRequest, NextResponse } from "next/server";
import { resolveCardImage } from "@/lib/pokemon-tcg";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

// Simple in-memory cache (per server instance) — 24h TTL
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function cacheKey(name: string, set: string, number: string): string {
  return `${name.toLowerCase().trim()}|${set.toLowerCase().trim()}|${number.toLowerCase().trim()}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") || "").trim();
    const set = (searchParams.get("set") || "").trim();
    const number = (searchParams.get("number") || "").trim();
    const saveId = searchParams.get("saveId") || "";

    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const key = cacheKey(name, set, number);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      const data = hit.data as Record<string, unknown>;
      // still persist if requested
      if (saveId && data && (data as { small?: string }).small) {
        const id = parseInt(saveId, 10);
        if (Number.isFinite(id)) {
          pool.query(`UPDATE cards SET image_url = $1, updated_at = NOW() WHERE id = $2 AND (image_url IS NULL OR image_url = '')`, [(data as { small: string }).small, id]).catch(() => {});
        }
      }
      return NextResponse.json({ ...data, cached: true });
    }

    const found = await resolveCardImage(name, set, number);
    if (!found) {
      const miss = { found: false };
      cache.set(key, { data: miss, expires: Date.now() + 60 * 60 * 1000 }); // cache misses 1h
      return NextResponse.json(miss, { status: 404 });
    }

    const payload = { found: true, ...found };
    cache.set(key, { data: payload, expires: Date.now() + CACHE_TTL });

    if (saveId) {
      const id = parseInt(saveId, 10);
      if (Number.isFinite(id)) {
        await pool.query(`UPDATE cards SET image_url = $1, updated_at = NOW() WHERE id = $2`, [found.small, id]).catch(() => {});
      }
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("card-image failed", e);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
