"use client";

import { useEffect, useRef, useState } from "react";
import Pokeball from "./Pokeball";

type Props = {
  cardName: string;
  setName?: string;
  cardNumber?: string;
  imageUrl?: string | null;
  cardId?: number;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  autoFetch?: boolean; // fetch from API when imageUrl missing
  onClickZoom?: boolean;
};

export default function CardImage({
  cardName,
  setName = "",
  cardNumber = "",
  imageUrl = "",
  cardId,
  className = "",
  imgClassName = "",
  eager = false,
  autoFetch = true,
  onClickZoom = true,
}: Props) {
  const [src, setSrc] = useState<string>(imageUrl || "");
  const [large, setLarge] = useState<string>("");
  const [status, setStatus] = useState<"ready" | "loading" | "error">(
    imageUrl ? "ready" : "loading"
  );
  const [zoom, setZoom] = useState(false);
  const tried = useRef(false);

  // reset when card changes
  useEffect(() => {
    setSrc(imageUrl || "");
    setLarge("");
    setStatus(imageUrl ? "ready" : "loading");
    tried.current = false;
  }, [cardName, setName, cardNumber, imageUrl]);

  useEffect(() => {
    if (src || !autoFetch || tried.current) {
      if (src) setStatus("ready");
      else if (!autoFetch) setStatus("error");
      return;
    }
    tried.current = true;
    let cancelled = false;
    const ctrl = new AbortController();
    const run = async () => {
      try {
        const p = new URLSearchParams({ name: cardName, set: setName || "", number: cardNumber || "" });
        if (cardId) p.set("saveId", String(cardId));
        const r = await fetch(`/api/card-image?${p}`, { signal: ctrl.signal });
        if (!r.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const d = await r.json();
        if (cancelled) return;
        if (d?.small) {
          setSrc(d.small);
          setLarge(d.large || d.small);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    // stagger to avoid hammering the API when a grid mounts
    const t = setTimeout(run, 150 + Math.random() * 600);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(t);
    };
  }, [src, autoFetch, cardName, setName, cardNumber, cardId]);

  if (status === "loading" && !src) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 ${className}`}>
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <div className="absolute inset-0 grid place-items-center">
          <Pokeball className="w-10 h-10 opacity-30 animate-spin" />
        </div>
        <div className="aspect-[245/337] w-full" />
      </div>
    );
  }

  if (!src || status === "error") {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1b33] via-[#2A75BB] to-[#0f1b33] ${className}`}>
        <div className="aspect-[245/337] w-full flex flex-col items-center justify-center p-3 text-center">
          <Pokeball className="w-12 h-12 opacity-40" />
          <p className="mt-2 line-clamp-2 text-xs font-black text-white/90">{cardName}</p>
          <p className="text-[10px] font-bold text-white/50">
            {[setName, cardNumber ? `#${cardNumber}` : ""].filter(Boolean).join(" • ") || "No scan yet"}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#FFCB05]/70">Image coming soon</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`group relative overflow-hidden rounded-2xl bg-slate-100 ${onClickZoom ? "cursor-zoom-in" : ""} ${className}`}
        onClick={() => onClickZoom && setZoom(true)}
        title={`${cardName} — click to zoom`}
      >
        <img
          src={src}
          alt={`${cardName} card`}
          loading={eager ? "eager" : "lazy"}
          draggable={false}
          onError={() => setStatus("error")}
          className={`aspect-[245/337] w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${imgClassName}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100">
          🔍 Zoom
        </span>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setZoom(false)}
        >
          <div className="relative max-h-[92vh] w-auto max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={large || src}
              alt={`${cardName} large`}
              className="max-h-[82vh] w-auto rounded-2xl shadow-2xl ring-4 ring-[#FFCB05]"
            />
            <div className="mt-3 text-center">
              <p className="font-black text-white">{cardName}</p>
              <p className="text-xs font-bold text-slate-300">
                {[setName, cardNumber ? `#${cardNumber}` : ""].filter(Boolean).join(" • ")}
              </p>
            </div>
            <button
              onClick={() => setZoom(false)}
              className="absolute -right-3 -top-3 grid h-10 w-10 place-items-center rounded-full bg-[#FFCB05] text-lg font-black text-[#0f1b33] shadow-xl hover:scale-110"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
