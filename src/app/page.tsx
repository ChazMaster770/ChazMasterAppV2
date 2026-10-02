"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Pokeball, { PokeballPattern } from "@/components/Pokeball";
import CardImage from "@/components/CardImage";
import { money, num, rarityColor } from "@/lib/format";
import { useAdmin } from "@/components/AdminProvider";

type Stats = {
  totals: { totalRows: number; totalUnits: number; totalValue: number; totalSets: number; totalRarities: number };
  topSets: { name: string; rows: number; units: number; value: number }[];
  topCards: { id: number; cardName: string; setName: string; cardNumber: string; rarity: string; price: number; quantity: number; variant: string; condition: string; imageUrl?: string | null }[];
  recent: { id: number; cardName: string; setName: string; cardNumber: string; rarity: string; price: number; quantity: number; variant: string; condition: string; imageUrl?: string | null }[];
  requests: { total: number; pending: number; accepted: number; pipeline: number };
};

export default function HomePage() {
  const { isAdmin } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/stats");
      const d = await r.json();
      setStats(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      await load();
    } catch {}
    setSeeding(false);
  };

  const totals = stats?.totals;

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0f1b33]">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-20 -left-20"><PokeballPattern className="w-72 h-72 text-white pokeball-spin" /></div>
          <div className="absolute top-10 right-[10%]"><PokeballPattern className="w-40 h-40 text-[#FFCB05]" /></div>
          <div className="absolute bottom-0 left-[40%]"><PokeballPattern className="w-56 h-56 text-[#ff5350]" /></div>
        </div>
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CC0000] via-[#FFCB05] to-[#2A75BB]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-14 md:py-20 grid gap-10 md:grid-cols-2 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-[#FFCB05]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              100,000+ Card Vault Ready
            </div>
            <h1 className="mt-4 font-display text-4xl md:text-6xl leading-[1.05] text-white">
              GOTTA CATCH
              <br />
              <span className="text-[#FFCB05]" style={{ textShadow: "4px 4px 0 #2A75BB, 8px 8px 0 rgba(0,0,0,0.3)" }}>
                &apos;EM ALL?
              </span>
              <br />
              <span className="text-2xl md:text-3xl text-slate-200 font-sans font-black">Track & sell &apos;em all.</span>
            </h1>
            <p className="mt-4 max-w-lg text-slate-300 font-semibold">
              <span className="text-white font-black">ChazMaster</span> turns your CardUploader scans into a live,
              shareable Pokémon shop. Upload a CSV, grow your 100k+ vault, send friends your link — they multi-select
              cards and fire you a sale request.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/upload"
                className="rounded-full bg-[#FFCB05] px-7 py-3.5 font-black text-[#0f1b33] shadow-[0_8px_0_#a98600,0_20px_40px_rgba(255,203,5,0.35)] hover:translate-y-0.5 hover:shadow-[0_4px_0_#a98600] transition-all"
              >
                ⚡ Upload CSV / Excel
              </Link>
              <Link
                href="/shop"
                className="rounded-full bg-white/10 border-2 border-white/30 px-7 py-3.5 font-black text-white hover:bg-white/20 hover:border-[#FFCB05] transition-all"
              >
                🛒 Open Public Shop
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-200">✓ CardUploader format</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-200">✓ Rebel Clash → 151 ready</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-200">✓ Multi-card requests</span>
            </div>
          </div>

          {/* Hero card stack visual */}
          <div className="relative hidden md:block">
            <div className="relative mx-auto w-[340px] h-[460px]">
              <div className="absolute inset-x-4 top-8 bottom-0 rotate-[-8deg] rounded-3xl bg-gradient-to-br from-[#2A75BB] to-[#0f1b33] border-4 border-white/30 shadow-2xl" />
              <div className="absolute inset-x-4 top-8 bottom-0 rotate-[6deg] rounded-3xl bg-gradient-to-br from-[#CC0000] to-[#7f1d1d] border-4 border-white/30 shadow-2xl" />
              <div className="card-shine absolute inset-0 rounded-3xl bg-white border-8 border-[#FFCB05] shadow-[0_30px_80px_rgba(255,203,5,0.35)] overflow-hidden float-slow">
                <div className="bg-gradient-to-r from-[#2A75BB] to-[#0f1b33] px-5 py-3 flex items-center justify-between">
                  <span className="text-[#FFCB05] font-display text-sm">CHAZMASTER</span>
                  <Pokeball className="w-7 h-7" />
                </div>
                <div className="holo-bg px-5 py-6 text-center">
                  <div className="mx-auto w-32 h-32 rounded-full bg-white/70 border-4 border-white shadow-xl grid place-items-center">
                    <Pokeball className="w-20 h-20" />
                  </div>
                  <p className="mt-3 font-display text-xl text-[#0f1b33]">CHARIZARD ex</p>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600">Obsidian Flames • 125</p>
                  <div className="mt-2 inline-block rounded-full bg-[#0f1b33] px-4 py-1 text-sm font-black text-[#FFCB05]">
                    {money(28.5)} • Qty 1
                  </div>
                </div>
                <div className="px-5 py-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-100 py-2"><p className="text-[10px] font-black uppercase text-slate-500">Rarity</p><p className="text-xs font-black">Double Rare</p></div>
                  <div className="rounded-xl bg-slate-100 py-2"><p className="text-[10px] font-black uppercase text-slate-500">Variant</p><p className="text-xs font-black">Holo</p></div>
                  <div className="rounded-xl bg-slate-100 py-2"><p className="text-[10px] font-black uppercase text-slate-500">Cond.</p><p className="text-xs font-black">NM</p></div>
                </div>
                <div className="px-5 pb-5">
                  <div className="rounded-2xl bg-gradient-to-r from-[#CC0000] to-[#ff5350] py-3 text-center font-black text-white shadow-lg">
                    + Add to Request
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* stat strip */}
        <div className="relative border-t border-white/10 bg-black/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Unique Cards", value: loading ? "…" : num(totals?.totalRows), icon: "🃏" },
              { label: "Total Units", value: loading ? "…" : num(totals?.totalUnits), icon: "📦" },
              { label: "Vault Value", value: loading ? "…" : money(totals?.totalValue), icon: "💰" },
              { label: "Sets", value: loading ? "…" : num(totals?.totalSets), icon: "🗂️" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <span>
                  <span className="block text-xl font-black text-white leading-none">{s.value}</span>
                  <span className="block text-[11px] font-bold uppercase tracking-widest text-slate-300">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <h2 className="text-center font-display text-2xl md:text-3xl text-[#0f1b33]">
          FROM SCANNER → <span className="text-[#CC0000]">SOLD</span> IN 4 STEPS
        </h2>
        <p className="text-center mt-2 font-semibold text-slate-500">Built for your CardUploader workflow (Rebel Clash sheets & beyond)</p>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            { step: "1", title: "Scan & Export", desc: "Scan with your scanner, export the Excel/CSV from carduploader.com/dashboard", icon: "📷", color: "from-sky-500 to-blue-700" },
            { step: "2", title: "Upload Here", desc: "Drop the CSV on ChazMaster. Auto-mapped: name, set, #, rarity, price, qty, condition…", icon: "⚡", color: "from-amber-400 to-orange-600" },
            { step: "3", title: "Share Shop Link", desc: "Send friends your /shop link. They browse, search & filter your live vault.", icon: "🔗", color: "from-emerald-500 to-teal-700" },
            { step: "4", title: "Get Requests", desc: "Friends multi-select cards + send one sale request. You accept, pack & profit.", icon: "💸", color: "from-rose-500 to-red-700" },
          ].map((s) => (
            <div key={s.step} className="wiggle relative rounded-3xl bg-white p-6 shadow-lg border-2 border-slate-100 hover:border-[#FFCB05] transition-colors">
              <div className={`absolute -top-3 left-6 rounded-full bg-gradient-to-r ${s.color} px-3 py-1 text-xs font-black text-white shadow`}>STEP {s.step}</div>
              <div className="text-4xl mt-2">{s.icon}</div>
              <h3 className="mt-3 font-black text-lg">{s.title}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link href="/upload" className="group rounded-3xl bg-gradient-to-br from-[#0f1b33] to-[#2A75BB] p-6 text-white shadow-xl hover:shadow-2xl transition-all">
            <p className="text-3xl">📤</p>
            <h3 className="mt-2 font-black text-xl">Upload a CardUploader CSV</h3>
            <p className="text-sm text-slate-300 font-semibold">Drag & drop. Preview, auto-map columns, import thousands in seconds.</p>
            <span className="mt-3 inline-block font-black text-[#FFCB05] group-hover:translate-x-1 transition-transform">Go to uploader →</span>
          </Link>
          <Link href="/collection" className="group rounded-3xl bg-white p-6 shadow-xl border-2 border-slate-100 hover:border-[#2A75BB] transition-all">
            <p className="text-3xl">🗃️</p>
            <h3 className="mt-2 font-black text-xl">Manage My Collection</h3>
            <p className="text-sm text-slate-500 font-semibold">Search 100k+ cards, filter by set / rarity / condition, edit price & qty.</p>
            <span className="mt-3 inline-block font-black text-[#2A75BB] group-hover:translate-x-1 transition-transform">Open vault →</span>
          </Link>
          <Link href="/requests" className="group rounded-3xl bg-white p-6 shadow-xl border-2 border-slate-100 hover:border-[#CC0000] transition-all">
            <p className="text-3xl">📨</p>
            <h3 className="mt-2 font-black text-xl">Sale Requests {stats && stats.requests.pending > 0 && <span className="ml-1 rounded-full bg-[#CC0000] px-2 py-0.5 text-xs text-white align-middle">{stats.requests.pending} new</span>}</h3>
            <p className="text-sm text-slate-500 font-semibold">Review multi-card claims. Accept to auto-deduct stock, reject to pass.</p>
            <span className="mt-3 inline-block font-black text-[#CC0000] group-hover:translate-x-1 transition-transform">Review inbox →</span>
          </Link>
        </div>
      </section>

      {/* TOP CARDS + RECENT */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-lg border-2 border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">🔥 TOP VALUE CARDS</h3>
            <Link href="/collection?sort=value_desc" className="text-sm font-black text-[#2A75BB]">View all →</Link>
          </div>
          <div className="mt-4 space-y-2">
            {loading && <p className="text-sm font-bold text-slate-400 animate-pulse">Loading vault…</p>}
            {!loading && stats?.topCards.length === 0 && (
              <div className="rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 p-6 text-center">
                <p className="font-black">Your vault is empty</p>
                <p className="text-sm text-slate-500 font-semibold">
                  {isAdmin ? "Upload your first CardUploader CSV or load the demo set." : "Upload your first CardUploader CSV to get started."}
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <Link href="/upload" className="rounded-full bg-[#0f1b33] px-4 py-2 text-xs font-black text-white">Upload CSV</Link>
                  {isAdmin && (
                    <button onClick={seedDemo} disabled={seeding} className="rounded-full bg-[#FFCB05] px-4 py-2 text-xs font-black text-[#0f1b33] disabled:opacity-50">
                      {seeding ? "Loading…" : "Load demo cards"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {stats?.topCards.map((c, idx) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2 hover:border-[#FFCB05] transition-colors">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${idx === 0 ? "bg-[#FFCB05] text-[#0f1b33]" : "bg-slate-200 text-slate-600"}`}>{idx + 1}</span>
                <CardImage
                  cardName={c.cardName}
                  setName={c.setName}
                  cardNumber={c.cardNumber}
                  imageUrl={c.imageUrl}
                  cardId={c.id}
                  className="w-12 shrink-0 !rounded-xl shadow-sm"
                  onClickZoom={false}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-sm">{c.cardName} <span className="font-semibold text-slate-400">#{c.cardNumber}</span></p>
                  <p className="truncate text-xs font-bold text-slate-500">{c.setName}</p>
                </div>
                <span className={`hidden sm:inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${rarityColor(c.rarity)}`}>{c.rarity}</span>
                <div className="text-right">
                  <p className="font-black text-sm">{money(c.price)}</p>
                  <p className="text-[11px] font-bold text-slate-400">×{c.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg border-2 border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">✨ NEWLY ADDED</h3>
            <Link href="/collection?sort=newest" className="text-sm font-black text-[#2A75BB]">View all →</Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {loading && <p className="col-span-2 text-sm font-bold text-slate-400 animate-pulse">Loading…</p>}
            {!loading && stats?.recent.length === 0 && (
              <p className="col-span-2 rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">No cards yet — upload to see them here.</p>
            )}
            {stats?.recent.map((c) => (
              <div key={c.id} className="card-shine rounded-2xl border-2 border-slate-100 bg-gradient-to-b from-white to-slate-50 p-2.5 hover:border-[#2A75BB] transition-colors">
                <div className="flex gap-2.5">
                  <CardImage
                    cardName={c.cardName}
                    setName={c.setName}
                    cardNumber={c.cardNumber}
                    imageUrl={c.imageUrl}
                    cardId={c.id}
                    className="w-16 shrink-0 !rounded-xl shadow-sm"
                    onClickZoom={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-sm">{c.cardName}</p>
                    <p className="truncate text-[11px] font-bold text-slate-500">{c.setName} • #{c.cardNumber}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className={`truncate rounded-full px-2 py-0.5 text-[10px] font-black ${rarityColor(c.rarity)}`}>{c.rarity}</span>
                      <span className="shrink-0 font-black text-sm text-[#0f1b33]">{money(c.price)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-400">{c.variant} • {c.condition} • ×{c.quantity}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {stats && stats.topSets.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Top sets by value</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {stats.topSets.map((s) => (
                  <Link key={s.name} href={`/collection?set=${encodeURIComponent(s.name)}`} className="rounded-full bg-[#0f1b33] px-3 py-1.5 text-xs font-black text-white hover:bg-[#2A75BB]">
                    {s.name} <span className="text-[#FFCB05]">{money(s.value)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SHARE BANNER */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#CC0000] via-[#ff5350] to-[#CC0000] p-8 md:p-10 shadow-2xl">
          <Pokeball className="absolute -right-8 -bottom-8 w-56 h-56 opacity-20 pokeball-spin" />
          <div className="relative md:flex items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-2xl md:text-3xl text-white">SHARE YOUR SHOP. GET PAID.</h3>
              <p className="mt-2 max-w-xl font-semibold text-red-100">
                One link. Friends browse your entire live collection, add multiple cards to a cart, and send you a
                single sale request with their contact. No spreadsheets. No DMs chaos.
              </p>
            </div>
            <div className="mt-5 md:mt-0 flex flex-col gap-2 shrink-0">
              <Link href="/shop" className="rounded-full bg-white px-8 py-3.5 text-center font-black text-[#CC0000] shadow-xl hover:scale-105 transition-transform">
                Open Shop & Copy Link 🔗
              </Link>
              <Link href="/requests" className="rounded-full bg-black/30 border border-white/40 px-8 py-3 text-center font-black text-white hover:bg-black/40">
                View Requests 📨
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
