"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Pokeball from "@/components/Pokeball";
import CardImage from "@/components/CardImage";
import { money, num, rarityColor, conditionColor } from "@/lib/format";

type Card = {
  id: number;
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  price: number;
  quantity: number;
  variant: string;
  condition: string;
  imageUrl?: string | null;
};

type CartItem = Card & { want: number };

type Channel = "in-app" | "email" | "whatsapp";

const CART_KEY = "chazmaster-cart-v1";

function digitsOnly(s: string): string {
  return (s || "").replace(/[^\d]/g, "");
}

function buildOrderMessage(
  cartList: CartItem[],
  name: string,
  contact: string,
  message: string,
  totalValue: number
): string {
  const lines = cartList.map(
    (i) => `• ${i.cardName} (${i.setName || "Unknown Set"} #${i.cardNumber || "—"}) x${i.want} — ${money(i.price * i.want)}`
  );
  const parts = [
    `New ChazMaster order request from ${name}`,
    `Contact: ${contact}`,
    "",
    "Cards:",
    ...lines,
    "",
    `Total: ${money(totalValue)}`,
  ];
  if (message.trim()) parts.push("", `Message: ${message.trim()}`);
  return parts.join("\n");
}

export default function ShopPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [setF, setSetF] = useState("");
  const [rarityF, setRarityF] = useState("");
  const [sort, setSort] = useState("price_asc");
  const [sets, setSets] = useState<{ v: string; c: number }[]>([]);
  const [rarities, setRarities] = useState<{ v: string; c: number }[]>([]);
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<Channel>("in-app");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminWhatsapp, setAdminWhatsapp] = useState("");
  const [sending, setSending] = useState(false);
  const [orderResult, setOrderResult] = useState<{ requestId: number; totalValue: number; itemCount: number; channel: Channel } | null>(null);
  const [orderError, setOrderError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setAdminEmail(d.adminEmail || "");
        setAdminWhatsapp(d.adminWhatsapp || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    fetch("/api/filters").then((r) => r.json()).then((d) => {
      setSets(d.sets || []);
      setRarities(d.rarities || []);
    }).catch(() => {});
  }, []);

  // Infinite scroll: page 1 replaces the list, later pages are appended.
  const [loadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (pg: number, reset: boolean) => {
      const id = ++reqId.current;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const p = new URLSearchParams({
          search: debounced,
          set: setF,
          rarity: rarityF,
          sort,
          page: String(pg),
          limit: "24",
        });
        const r = await fetch(`/api/cards?${p}`);
        const d = await r.json();
        if (id !== reqId.current) return; // a newer search replaced this one
        const incoming: Card[] = (d.cards || []).filter((c: Card) => (c.quantity ?? 0) > 0);
        setCards((prev) => {
          if (reset) return incoming;
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...incoming.filter((c) => !seen.has(c.id))];
        });
        setPage(pg);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
      } catch {
        // keep what we already have
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debounced, setF, rarityF, sort]
  );

  // (Re)start from page 1 whenever the search / filters / sort change
  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const hasMore = page < totalPages;

  // Load the next batch when the bottom of the list comes into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchPage(page + 1, false);
        }
      },
      { rootMargin: "700px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchPage]);

  const cartList = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(() => cartList.reduce((s, i) => s + i.want, 0), [cartList]);
  const cartValue = useMemo(() => cartList.reduce((s, i) => s + (i.price || 0) * i.want, 0), [cartList]);

  const addToCart = (c: Card) => {
    setCart((prev) => {
      const cur = prev[c.id];
      const want = Math.min(c.quantity, (cur?.want || 0) + 1);
      return { ...prev, [c.id]: { ...c, want } };
    });
  };

  const setWant = (id: number, want: number) => {
    setCart((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const w = Math.max(0, Math.min(cur.quantity, want));
      if (w === 0) {
        const n = { ...prev };
        delete n[id];
        return n;
      }
      return { ...prev, [id]: { ...cur, want: w } };
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy your shop link:", window.location.href);
    }
  };

  const shareNative = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: { title: string; text: string; url: string }) => Promise<void> }).share({
          title: "ChazMaster Shop",
          text: "Browse my Pokémon TCG vault & claim cards!",
          url: window.location.href,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  const submitRequest = async () => {
    setOrderError("");
    if (!name.trim()) {
      setOrderError("Please add your name so Chaz knows who you are.");
      return;
    }
    if (!contact.trim()) {
      setOrderError("Please add your email / phone / Discord so Chaz can reach you.");
      return;
    }
    if (!cartList.length) {
      setOrderError("Your cart is empty.");
      return;
    }
    if (channel === "email" && !adminEmail) {
      setOrderError("Email isn't set up yet — pick In-App or WhatsApp instead.");
      return;
    }
    if (channel === "whatsapp" && !adminWhatsapp) {
      setOrderError("WhatsApp isn't set up yet — pick In-App or Email instead.");
      return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterName: name.trim(),
          requesterContact: contact.trim(),
          message: message.trim(),
          channel,
          items: cartList.map((i) => ({ cardId: i.id, quantity: i.want })),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setOrderError(d.error || "Could not send request");
      } else {
        const orderText = buildOrderMessage(cartList, name.trim(), contact.trim(), message.trim(), cartValue);

        if (channel === "email" && adminEmail) {
          const subject = `ChazMaster Order Request from ${name.trim()}`;
          const mailto = `mailto:${encodeURIComponent(adminEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(orderText)}`;
          window.location.href = mailto;
        } else if (channel === "whatsapp" && adminWhatsapp) {
          const wa = `https://wa.me/${digitsOnly(adminWhatsapp)}?text=${encodeURIComponent(orderText)}`;
          window.open(wa, "_blank", "noopener,noreferrer");
        }

        setOrderResult({ ...d, channel });
        setCart({});
        setCheckoutOpen(false);
        setName("");
        setContact("");
        setMessage("");
        setChannel("in-app");
      }
    } catch {
      setOrderError("Network error — try again.");
    }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Shop header */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0f1b33] p-4 sm:p-6 md:p-8 shadow-2xl">
        <Pokeball className="absolute -right-10 -top-10 w-48 h-48 opacity-10 pokeball-spin" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#FFCB05]">Public Shop • Shareable Link</p>
            <h1 className="mt-1 font-display text-xl sm:text-2xl md:text-4xl text-white">CHAZMASTER SHOP 🛒</h1>
            <p className="mt-1 hidden sm:block font-semibold text-slate-300 text-sm md:text-base">
              Friends: search the vault, add <span className="text-white font-black">multiple cards</span> to your cart, send one sale request. Chaz confirms & packs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyLink} className="rounded-full bg-[#FFCB05] px-4 py-2 sm:px-6 sm:py-3 font-black text-[#0f1b33] text-xs sm:text-sm shadow-lg hover:scale-105 transition-transform">
              {copied ? "✅ Copied!" : "🔗 Copy Shop Link"}
            </button>
            <button onClick={shareNative} className="rounded-full bg-white/10 border-2 border-white/30 px-4 py-2 sm:px-6 sm:py-3 font-black text-white text-xs sm:text-sm hover:bg-white/20">
              📤 Share
            </button>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2 md:mt-5 md:gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search Charizard, Pikachu, 151…"
            className="col-span-2 md:col-span-1 rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-2.5 md:py-3 font-bold text-sm text-white placeholder:text-slate-400 outline-none focus:border-[#FFCB05]"
          />
          <select value={setF} onChange={(e) => setSetF(e.target.value)} className="min-w-0 rounded-2xl border-2 border-white/20 bg-[#1a2b4d] px-2.5 py-2.5 md:px-3 md:py-3 font-bold text-xs md:text-sm text-white">
            <option value="">All Sets</option>
            {sets.map((s) => (
              <option key={s.v} value={s.v}>{s.v} ({s.c})</option>
            ))}
          </select>
          <select value={rarityF} onChange={(e) => setRarityF(e.target.value)} className="min-w-0 rounded-2xl border-2 border-white/20 bg-[#1a2b4d] px-2.5 py-2.5 md:px-3 md:py-3 font-bold text-xs md:text-sm text-white">
            <option value="">All Rarities</option>
            {rarities.map((s) => (
              <option key={s.v} value={s.v}>{s.v}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="col-span-2 md:col-span-1 min-w-0 rounded-2xl border-2 border-white/20 bg-[#1a2b4d] px-2.5 py-2.5 md:px-3 md:py-3 font-bold text-xs md:text-sm text-white">
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
            <option value="name_asc">Name A–Z</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {orderResult && (
        <div className="mt-6 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow-2xl">
          <h3 className="font-display text-xl">🎉 REQUEST SENT! #{orderResult.requestId}</h3>
          <p className="mt-1 font-semibold text-emerald-50">
            Chaz got your claim for <span className="font-black">{num(orderResult.itemCount)} cards</span> worth{" "}
            <span className="font-black">{money(orderResult.totalValue)}</span>.{" "}
            {orderResult.channel === "email"
              ? "We also opened your email app — hit send there to notify Chaz directly."
              : orderResult.channel === "whatsapp"
              ? "We also opened WhatsApp in a new tab — hit send there to notify Chaz directly."
              : "He'll reach out shortly to confirm payment & shipping."}
          </p>
          <button onClick={() => setOrderResult(null)} className="mt-3 rounded-full bg-white px-5 py-2 text-sm font-black text-emerald-700">Keep browsing →</button>
        </div>
      )}

      <p className="mt-4 text-xs sm:text-sm font-bold text-slate-500">{num(total)} cards available • tap + to build your multi-card request</p>

      {loading ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl sm:rounded-3xl bg-white shadow" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-4 rounded-3xl bg-white p-12 text-center shadow border-2 border-dashed">
          <p className="text-5xl">🔍</p>
          <h3 className="mt-2 font-black text-xl">No cards match</h3>
          <p className="font-semibold text-slate-500">Try a different search — new scans land daily.</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {cards.map((c) => {
            const inCart = cart[c.id]?.want || 0;
            return (
              <div
                key={c.id}
                className={`card-shine flex min-w-0 flex-col rounded-2xl sm:rounded-3xl bg-white p-1.5 sm:p-3 shadow-md sm:shadow-lg border-2 transition-all hover:shadow-xl ${
                  inCart > 0 ? "border-[#FFCB05] ring-2 ring-yellow-100" : "border-slate-100 hover:border-[#FFCB05]"
                }`}
              >
                <div className="relative">
                  <CardImage
                    cardName={c.cardName}
                    setName={c.setName}
                    cardNumber={c.cardNumber}
                    imageUrl={c.imageUrl}
                    cardId={c.id}
                    className="shadow-md"
                  />
                  <span className={`absolute top-1 left-1 sm:top-2 sm:left-2 max-w-[70%] truncate rounded-full px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-black shadow-lg ${rarityColor(c.rarity)}`}>{c.rarity || "?"}</span>
                  {c.quantity <= 2 && (
                    <span className="hidden sm:block absolute top-2 right-2 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white shadow-lg animate-pulse">
                      🔥 Only {c.quantity}
                    </span>
                  )}
                  {inCart > 0 && (
                    <span className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 grid h-5 min-w-5 sm:h-6 sm:min-w-6 place-items-center rounded-full bg-[#FFCB05] px-1 text-[10px] sm:text-xs font-black text-[#0f1b33] shadow-lg">
                      {inCart}
                    </span>
                  )}
                </div>
                <div className="mt-1 sm:mt-2 flex items-center justify-between gap-1 px-0.5 sm:px-1">
                  <span className={`truncate rounded-full border px-1.5 py-0.5 text-[8px] sm:text-[10px] font-black ${conditionColor(c.condition)}`}>{c.variant} • {c.condition}</span>
                  <span className="shrink-0 text-[9px] sm:text-[10px] font-black text-slate-400">#{c.cardNumber || "—"}</span>
                </div>
                <h3 className="mt-0.5 sm:mt-1 px-0.5 sm:px-1 text-[13px] sm:text-base font-black leading-tight line-clamp-1" title={c.cardName}>{c.cardName}</h3>
                <p className="hidden sm:block px-1 truncate text-xs font-bold text-slate-500">{c.setName}</p>
                <div className="mt-0.5 sm:mt-1 flex items-center justify-between gap-1 px-0.5 sm:px-1">
                  <span className="text-base sm:text-xl font-black text-[#0f1b33]">{money(c.price)}</span>
                  <span className={`text-[9px] sm:text-xs font-black ${c.quantity <= 2 ? "text-red-500" : "text-emerald-600"}`}>
                    {c.quantity <= 2 ? `🔥 ${c.quantity} left` : `✓ ${c.quantity}`}
                    <span className="hidden sm:inline">{c.quantity <= 2 ? "" : " in stock"}</span>
                  </span>
                </div>
                <div className="mt-auto pt-1 sm:pt-2">
                  {inCart === 0 ? (
                    <button
                      onClick={() => addToCart(c)}
                      className="w-full rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#ff5350] to-[#CC0000] py-1.5 sm:py-2.5 text-xs sm:text-sm font-black text-white shadow border-b-2 sm:border-b-4 border-red-900 hover:brightness-110 active:border-b-0 active:translate-y-0.5 transition-all"
                    >
                      + Add<span className="hidden sm:inline"> to Request</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl sm:rounded-2xl bg-[#0f1b33] p-1 sm:p-1.5">
                      <button onClick={() => setWant(c.id, inCart - 1)} className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg sm:rounded-xl bg-white/15 font-black text-white hover:bg-white/25">−</button>
                      <span className="text-xs sm:text-sm font-black text-[#FFCB05]">{inCart}<span className="hidden sm:inline"> in cart</span></span>
                      <button onClick={() => setWant(c.id, inCart + 1)} disabled={inCart >= c.quantity} className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg sm:rounded-xl bg-[#FFCB05] font-black text-[#0f1b33] disabled:opacity-40">+</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll trigger: when this comes into view, the next batch loads */}
      <div ref={sentinelRef} className="flex min-h-24 items-center justify-center pb-28 pt-6">
        {loadingMore && (
          <div className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#0f1b33] shadow">
            <Pokeball className="h-5 w-5 animate-spin" /> Loading more cards…
          </div>
        )}
        {!loading && !loadingMore && cards.length > 0 && !hasMore && (
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">✨ You&apos;ve seen all {num(cards.length)} cards</p>
        )}
      </div>

      {/* Floating cart bar */}
      {cartList.length > 0 && !checkoutOpen && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2">
          <div className="rounded-3xl bg-[#0f1b33]/95 backdrop-blur border-2 border-[#FFCB05] p-4 shadow-2xl flex items-center gap-4">
            <button onClick={() => setCartOpen(!cartOpen)} className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFCB05] text-2xl font-black relative shrink-0">
              🛒
              <span className="absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full bg-[#CC0000] px-1 text-xs font-black text-white ring-2 ring-[#0f1b33]">{cartCount}</span>
            </button>
            <div className="flex-1 min-w-0">
              <p className="truncate font-black text-white text-sm">{cartList.slice(0, 3).map((i) => `${i.cardName} ×${i.want}`).join(" • ")}{cartList.length > 3 ? ` +${cartList.length - 3} more` : ""}</p>
              <p className="font-black text-[#FFCB05]">{money(cartValue)} total</p>
            </div>
            <button onClick={() => setCartOpen(true)} className="hidden sm:block rounded-full bg-white/10 border border-white/30 px-5 py-2.5 text-sm font-black text-white">View</button>
            <button onClick={() => { setCartOpen(false); setCheckoutOpen(true); }} className="rounded-full bg-gradient-to-b from-[#FFCB05] to-[#e0a800] px-6 py-2.5 text-sm font-black text-[#0f1b33] shadow">Checkout →</button>
          </div>

          {cartOpen && (
            <div className="mt-2 max-h-64 overflow-auto rounded-3xl bg-white border-2 border-slate-200 shadow-2xl p-4 space-y-2 scrollbar-thin">
              {cartList.map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2">
                  <CardImage
                    cardName={i.cardName}
                    setName={i.setName}
                    cardNumber={i.cardNumber}
                    imageUrl={i.imageUrl}
                    cardId={i.id}
                    className="w-10 shrink-0 !rounded-lg"
                    onClickZoom={false}
                    autoFetch={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{i.cardName} <span className="text-slate-400 font-bold">#{i.cardNumber}</span></p>
                    <p className="truncate text-[11px] font-bold text-slate-500">{i.setName} • {i.variant} • {i.condition} • {money(i.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setWant(i.id, i.want - 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-200 font-black">−</button>
                    <span className="w-6 text-center font-black text-sm">{i.want}</span>
                    <button onClick={() => setWant(i.id, i.want + 1)} disabled={i.want >= i.quantity} className="grid h-7 w-7 place-items-center rounded-lg bg-[#0f1b33] font-black text-white disabled:opacity-40">+</button>
                  </div>
                  <span className="w-16 text-right text-sm font-black">{money((i.price || 0) * i.want)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-auto">
            <h3 className="font-display text-xl">SEND SALE REQUEST 📨</h3>
            <p className="text-sm font-semibold text-slate-500">
              {num(cartCount)} cards • <span className="font-black text-[#0f1b33]">{money(cartValue)}</span> • Chaz reviews & confirms.
            </p>
            <div className="mt-3 max-h-48 overflow-auto rounded-2xl bg-slate-50 border p-3 space-y-2 scrollbar-thin">
              {cartList.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-xs font-bold">
                  <CardImage
                    cardName={i.cardName}
                    setName={i.setName}
                    cardNumber={i.cardNumber}
                    imageUrl={i.imageUrl}
                    cardId={i.id}
                    className="w-9 shrink-0 !rounded-lg"
                    onClickZoom={false}
                    autoFetch={false}
                  />
                  <span className="min-w-0 flex-1 truncate">{i.cardName} <span className="text-slate-400">({i.setName} #{i.cardNumber}) ×{i.want}</span></span>
                  <span className="font-black shrink-0">{money((i.price || 0) * i.want)}</span>
                </div>
              ))}
            </div>
            <label className="mt-4 block text-xs font-black uppercase tracking-widest text-slate-500">Your name *<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ash Ketchum" className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-[#FFCB05]" /></label>
            <label className="mt-3 block text-xs font-black uppercase tracking-widest text-slate-500">Contact (email / phone / discord) *<input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. ash@pallet.town / 555-0100" className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-[#FFCB05]" /></label>
            <label className="mt-3 block text-xs font-black uppercase tracking-widest text-slate-500">Message to Chaz (optional)<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Bundle deal? Pickup or shipping? Condition questions…" className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-[#FFCB05]" /></label>

            <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-500">How do you want to send it?</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel("in-app")}
                className={`rounded-2xl border-2 px-2 py-3 text-center text-xs font-black transition-all ${
                  channel === "in-app" ? "border-[#0f1b33] bg-[#0f1b33] text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                📨<br />In-App
              </button>
              <button
                type="button"
                onClick={() => setChannel("email")}
                disabled={!adminEmail}
                title={!adminEmail ? "Chaz hasn't set up email yet" : "Send via email"}
                className={`rounded-2xl border-2 px-2 py-3 text-center text-xs font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  channel === "email" ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                📧<br />Email
              </button>
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                disabled={!adminWhatsapp}
                title={!adminWhatsapp ? "Chaz hasn't set up WhatsApp yet" : "Send via WhatsApp"}
                className={`rounded-2xl border-2 px-2 py-3 text-center text-xs font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  channel === "whatsapp" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                💬<br />WhatsApp
              </button>
            </div>
            {channel === "email" && adminEmail && (
              <p className="mt-2 text-[11px] font-bold text-slate-400">Your email app will open with the order pre-filled to send to {adminEmail}.</p>
            )}
            {channel === "whatsapp" && adminWhatsapp && (
              <p className="mt-2 text-[11px] font-bold text-slate-400">WhatsApp will open in a new tab with the order pre-filled.</p>
            )}

            {orderError && <p className="mt-3 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm font-bold text-red-600">⚠️ {orderError}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setCheckoutOpen(false)} className="flex-1 rounded-full bg-slate-200 py-3 font-black text-sm">Back</button>
              <button onClick={submitRequest} disabled={sending} className="flex-[2] rounded-full bg-gradient-to-b from-[#ff5350] to-[#CC0000] py-3 font-black text-white text-sm shadow disabled:opacity-50">
                {sending
                  ? "Sending…"
                  : channel === "email"
                  ? `📧 Send via Email (${money(cartValue)})`
                  : channel === "whatsapp"
                  ? `💬 Send via WhatsApp (${money(cartValue)})`
                  : `📨 Send Request (${money(cartValue)})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
