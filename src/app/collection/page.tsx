"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { money, num, rarityColor, conditionColor } from "@/lib/format";
import CardImage from "@/components/CardImage";
import AdminGate from "@/components/AdminGate";

type Card = {
  id: number;
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
  tcgplayerId: string;
  productId: string;
  imageUrl?: string | null;
  createdAt: string;
};

type Filters = { sets: { v: string; c: number }[]; rarities: { v: string; c: number }[]; conditions: { v: string; c: number }[]; variants: { v: string; c: number }[] };

function CollectionInner() {
  const sp = useSearchParams();
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [units, setUnits] = useState(0);
  const [value, setValue] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(24);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(sp.get("search") || "");
  const [debounced, setDebounced] = useState(search);
  const [setF, setSetF] = useState(sp.get("set") || "");
  const [rarityF, setRarityF] = useState("");
  const [condF, setCondF] = useState("");
  const [sort, setSort] = useState(sp.get("sort") || "newest");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [filters, setFilters] = useState<Filters>({ sets: [], rarities: [], conditions: [], variants: [] });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<{ id: number; price: string; quantity: string } | null>(null);
  const [imgStats, setImgStats] = useState<{ total: number; withImages: number; withoutImages: number } | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  const loadImgStats = useCallback(async () => {
    try {
      const r = await fetch("/api/cards/backfill-images");
      const d = await r.json();
      if (typeof d.withoutImages === "number") setImgStats(d);
    } catch {}
  }, []);

  useEffect(() => {
    loadImgStats();
  }, [loadImgStats]);

  const backfillImages = async () => {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillMsg("Fetching card pictures…");
    try {
      let guard = 0;
      let remaining = Infinity;
      let totalUpdated = 0;
      while (remaining > 0 && guard < 60) {
        const r = await fetch("/api/cards/backfill-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 12 }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "failed");
        totalUpdated += d.updated || 0;
        remaining = d.remaining ?? 0;
        setBackfillMsg(`Saved ${num(totalUpdated)} pictures… ${num(remaining)} left`);
        await loadImgStats();
        if ((d.processed || 0) === 0) break;
        guard++;
      }
      setBackfillMsg(remaining === 0 ? `✅ All pictures saved (${num(totalUpdated)} updated)!` : `Done — ${num(totalUpdated)} saved, ${num(remaining)} left. Run again to continue.`);
      load();
      loadImgStats();
    } catch {
      setBackfillMsg("⚠️ Image fetch hit a limit — wait a minute and try again.");
    }
    setBackfilling(false);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/filters").then((r) => r.json()).then(setFilters).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        search: debounced,
        set: setF,
        rarity: rarityF,
        condition: condF,
        sort,
        page: String(page),
        limit: String(limit),
      });
      const r = await fetch(`/api/cards?${p}`);
      const d = await r.json();
      setCards(d.cards || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
      setUnits(d.units || 0);
      setValue(d.value || 0);
    } catch {}
    setLoading(false);
  }, [debounced, setF, rarityF, condF, sort, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debounced, setF, rarityF, condF, sort]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const exportCsv = () => {
    const header = "Card Name,Set,Card Num,Rarity,Price,Quantity,Buy %,Buy Price,Variant,Condition,TCGplayer ID,Product ID";
    const lines = cards.map((c) =>
      [`"${(c.cardName || "").replace(/"/g, '""')}"`, `"${(c.setName || "").replace(/"/g, '""')}"`, c.cardNumber, `"${c.rarity}"`, c.price, c.quantity, c.buyPct, c.buyPrice, `"${c.variant}"`, c.condition, c.tcgplayerId, c.productId].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chazmaster-collection.csv";
    a.click();
  };

  const saveEdit = async () => {
    if (!editing) return;
    await fetch(`/api/cards/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: Number(editing.price), quantity: Number(editing.quantity) }),
    });
    setEditing(null);
    load();
  };

  const delOne = async (id: number) => {
    if (!confirm("Delete this card?")) return;
    await fetch(`/api/cards/${id}`, { method: "DELETE" });
    load();
  };

  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const refreshImage = async (c: Card) => {
    setRefreshingId(c.id);
    try {
      const p = new URLSearchParams({
        name: c.cardName,
        set: c.setName || "",
        number: c.cardNumber || "",
        saveId: String(c.id),
      });
      // bypass cache by direct fetch then reload list
      await fetch(`/api/card-image?${p}`);
      await load();
      await loadImgStats();
    } catch {}
    setRefreshingId(null);
  };

  const delSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} cards?`)) return;
    await fetch(`/api/cards?ids=${[...selected].join(",")}`, { method: "DELETE" });
    setSelected(new Set());
    load();
  };

  const clearFilters = () => {
    setSearch("");
    setSetF("");
    setRarityF("");
    setCondF("");
    setSort("newest");
  };

  const hasFilters = useMemo(() => debounced || setF || rarityF || condF, [debounced, setF, rarityF, condF]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-[#0f1b33]">MY COLLECTION</h1>
          <p className="font-semibold text-slate-500">
            <span className="font-black text-[#0f1b33]">{num(total)}</span> unique • <span className="font-black text-[#0f1b33]">{num(units)}</span> units • <span className="font-black text-emerald-600">{money(value)}</span> vault value
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/upload" className="rounded-full bg-[#FFCB05] px-5 py-2.5 text-sm font-black text-[#0f1b33] shadow hover:brightness-105">⚡ Upload CSV</Link>
          <Link href="/shop" className="rounded-full bg-[#0f1b33] px-5 py-2.5 text-sm font-black text-white shadow">🛒 Shop View</Link>
          <button onClick={exportCsv} className="rounded-full bg-white border-2 border-slate-200 px-5 py-2.5 text-sm font-black hover:border-[#2A75BB]">⬇ Export</button>
          <button
            onClick={backfillImages}
            disabled={backfilling}
            title="Auto-download official card pictures for your whole vault"
            className="rounded-full bg-gradient-to-r from-[#2A75BB] to-[#0f1b33] px-5 py-2.5 text-sm font-black text-white shadow hover:brightness-110 disabled:opacity-60"
          >
            {backfilling ? "⏳ Fetching…" : `🖼️ Get Pictures${imgStats && imgStats.withoutImages > 0 ? ` (${num(imgStats.withoutImages)})` : ""}`}
          </button>
          {selected.size > 0 && (
            <button onClick={delSelected} className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-black text-white">🗑 {selected.size}</button>
          )}
        </div>
      </div>

      {(backfillMsg || (imgStats && imgStats.withoutImages > 0)) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-r from-sky-50 to-yellow-50 border-2 border-sky-200 px-4 py-3">
          <span className="text-2xl">🖼️</span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-black text-[#0f1b33]">
              {backfillMsg || `${num(imgStats!.withoutImages)} cards are missing pictures`}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {imgStats ? `${num(imgStats.withImages)} / ${num(imgStats.total)} have pictures • ` : ""}One click downloads official artwork so shop + collection show real cards.
            </p>
            {imgStats && imgStats.total > 0 && (
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2A75BB] to-emerald-500 transition-all"
                  style={{ width: `${Math.round((imgStats.withImages / imgStats.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
          {!backfilling && imgStats && imgStats.withoutImages > 0 && (
            <button onClick={backfillImages} className="rounded-full bg-[#0f1b33] px-5 py-2 text-xs font-black text-white">
              Fetch now →
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 rounded-3xl bg-white p-4 shadow-lg border-2 border-slate-100">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search name, set, number, rarity…"
            className="rounded-2xl border-2 border-slate-200 px-4 py-2.5 font-bold text-sm outline-none focus:border-[#FFCB05] focus:ring-4 focus:ring-yellow-100"
          />
          <select value={setF} onChange={(e) => setSetF(e.target.value)} className="rounded-2xl border-2 border-slate-200 px-3 py-2.5 font-bold text-sm bg-white">
            <option value="">All Sets ({filters.sets.length})</option>
            {filters.sets.map((s) => (
              <option key={s.v} value={s.v}>{s.v} ({s.c})</option>
            ))}
          </select>
          <select value={rarityF} onChange={(e) => setRarityF(e.target.value)} className="rounded-2xl border-2 border-slate-200 px-3 py-2.5 font-bold text-sm bg-white">
            <option value="">All Rarities</option>
            {filters.rarities.map((s) => (
              <option key={s.v} value={s.v}>{s.v} ({s.c})</option>
            ))}
          </select>
          <select value={condF} onChange={(e) => setCondF(e.target.value)} className="rounded-2xl border-2 border-slate-200 px-3 py-2.5 font-bold text-sm bg-white">
            <option value="">All Conditions</option>
            {filters.conditions.map((s) => (
              <option key={s.v} value={s.v}>{s.v} ({s.c})</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-2xl border-2 border-slate-200 px-3 py-2.5 font-bold text-sm bg-white">
            <option value="newest">Newest first</option>
            <option value="value_desc">Highest value</option>
            <option value="price_desc">Highest price</option>
            <option value="price_asc">Lowest price</option>
            <option value="name_asc">Name A–Z</option>
            <option value="qty_desc">Most stock</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-slate-100 p-1">
              <button onClick={() => setView("grid")} className={`rounded-full px-4 py-1.5 text-xs font-black ${view === "grid" ? "bg-[#0f1b33] text-white" : "text-slate-500"}`}>GRID</button>
              <button onClick={() => setView("table")} className={`rounded-full px-4 py-1.5 text-xs font-black ${view === "table" ? "bg-[#0f1b33] text-white" : "text-slate-500"}`}>TABLE</button>
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs font-black text-red-600 hover:underline">Clear filters ✕</button>
            )}
          </div>
          <p className="text-xs font-bold text-slate-400">Page {page} / {totalPages} • {num(total)} cards</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl bg-white shadow" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-12 text-center shadow border-2 border-dashed border-slate-200">
          <p className="text-5xl">📦</p>
          <h3 className="mt-3 font-black text-xl">No cards found</h3>
          <p className="font-semibold text-slate-500">Try different filters — or upload your CardUploader CSV.</p>
          <Link href="/upload" className="mt-4 inline-block rounded-full bg-[#0f1b33] px-6 py-3 font-black text-white">Upload CSV ⚡</Link>
        </div>
      ) : view === "grid" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((c) => (
            <div key={c.id} className={`card-shine relative rounded-3xl bg-white p-3 shadow-lg border-2 transition-all ${selected.has(c.id) ? "border-[#FFCB05] ring-4 ring-yellow-100" : "border-slate-100 hover:border-[#2A75BB]"}`}>
              <div className="flex gap-3">
                <CardImage
                  cardName={c.cardName}
                  setName={c.setName}
                  cardNumber={c.cardNumber}
                  imageUrl={c.imageUrl}
                  cardId={c.id}
                  className="w-24 shrink-0 shadow"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="mt-1 h-4 w-4 accent-[#0f1b33]" />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${rarityColor(c.rarity)}`}>{c.rarity || "?"}</span>
                  </div>
                  <h3 className="mt-1 truncate font-black text-base leading-tight" title={c.cardName}>{c.cardName}</h3>
                  <p className="truncate text-xs font-bold text-slate-500">{c.setName} • #{c.cardNumber || "—"}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-lg font-black text-[#0f1b33]">{money(c.price)}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">×{c.quantity}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${conditionColor(c.condition)}`}>{c.condition} • {c.variant}</span>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">Total {money((c.price || 0) * (c.quantity || 0))}</span>
              </div>
              {editing?.id === c.id ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-black text-slate-500">PRICE $<input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} className="mt-0.5 w-full rounded-xl border-2 border-slate-200 px-2 py-1.5 text-sm font-black" /></label>
                  <label className="text-[10px] font-black text-slate-500">QTY<input value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} className="mt-0.5 w-full rounded-xl border-2 border-slate-200 px-2 py-1.5 text-sm font-black" /></label>
                  <button onClick={saveEdit} className="col-span-1 rounded-xl bg-emerald-600 py-1.5 text-xs font-black text-white">Save</button>
                  <button onClick={() => setEditing(null)} className="col-span-1 rounded-xl bg-slate-200 py-1.5 text-xs font-black">Cancel</button>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => refreshImage(c)}
                    disabled={refreshingId === c.id}
                    title="Re-fetch official picture"
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black hover:bg-sky-200 disabled:opacity-50"
                  >
                    {refreshingId === c.id ? "⏳" : "🖼️"}
                  </button>
                  <button onClick={() => setEditing({ id: c.id, price: String(c.price ?? 0), quantity: String(c.quantity ?? 1) })} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black hover:bg-[#FFCB05]">✏️ Edit</button>
                  <button onClick={() => delOne(c.id)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black hover:bg-red-100">🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-3xl bg-white shadow-lg border-2 border-slate-100">
          <table className="sticky-th w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-[#0f1b33] text-white text-left">
                <th className="px-4 py-3 w-10"><input type="checkbox" checked={selected.size === cards.length && cards.length > 0} onChange={() => setSelected(selected.size ? new Set() : new Set(cards.map((c) => c.id)))} className="h-4 w-4" /></th>
                <th className="px-4 py-3 font-black w-16">Pic</th>
                <th className="px-4 py-3 font-black">Card</th>
                <th className="px-4 py-3 font-black">Set</th>
                <th className="px-4 py-3 font-black">#</th>
                <th className="px-4 py-3 font-black">Rarity</th>
                <th className="px-4 py-3 font-black">Variant / Cond</th>
                <th className="px-4 py-3 font-black text-right">Price</th>
                <th className="px-4 py-3 font-black text-right">Qty</th>
                <th className="px-4 py-3 font-black text-right">Total</th>
                <th className="px-4 py-3 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c, idx) => (
                <tr key={c.id} className={idx % 2 ? "bg-slate-50" : "bg-white"}>
                  <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="h-4 w-4 accent-[#0f1b33]" /></td>
                  <td className="px-2 py-1.5">
                    <CardImage
                      cardName={c.cardName}
                      setName={c.setName}
                      cardNumber={c.cardNumber}
                      imageUrl={c.imageUrl}
                      cardId={c.id}
                      className="w-11 !rounded-lg shadow-sm"
                      autoFetch={false}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-black">{c.cardName}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-600">{c.setName}</td>
                  <td className="px-4 py-2.5 font-bold">{c.cardNumber}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${rarityColor(c.rarity)}`}>{c.rarity}</span></td>
                  <td className="px-4 py-2.5"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${conditionColor(c.condition)}`}>{c.variant} • {c.condition}</span></td>
                  <td className="px-4 py-2.5 text-right font-black">{money(c.price)}</td>
                  <td className="px-4 py-2.5 text-right font-black">×{c.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-black text-emerald-600">{money((c.price || 0) * (c.quantity || 0))}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditing({ id: c.id, price: String(c.price ?? 0), quantity: String(c.quantity ?? 1) })} className="mr-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-black hover:bg-[#FFCB05]">✏️</button>
                    <button onClick={() => delOne(c.id)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-black hover:bg-red-100">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editing && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
                <h3 className="font-black text-lg">Edit card #{editing.id}</h3>
                <label className="mt-3 block text-xs font-black">PRICE ($)<input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} type="number" step="0.01" className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 font-black" /></label>
                <label className="mt-3 block text-xs font-black">QUANTITY<input value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} type="number" className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 font-black" /></label>
                <div className="mt-4 flex gap-2">
                  <button onClick={saveEdit} className="flex-1 rounded-full bg-emerald-600 py-2.5 font-black text-white">Save</button>
                  <button onClick={() => setEditing(null)} className="flex-1 rounded-full bg-slate-200 py-2.5 font-black">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-full bg-white border-2 border-slate-200 px-5 py-2 font-black text-sm disabled:opacity-40 shadow">← Prev</button>
        <span className="rounded-full bg-[#0f1b33] px-4 py-2 text-sm font-black text-white">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full bg-white border-2 border-slate-200 px-5 py-2 font-black text-sm disabled:opacity-40 shadow">Next →</button>
      </div>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <AdminGate title="Admin Access Required" description="Enter the ChazMaster admin code to manage your card collection.">
      <Suspense fallback={<div className="p-10 text-center font-black">Loading vault…</div>}>
        <CollectionInner />
      </Suspense>
    </AdminGate>
  );
}
