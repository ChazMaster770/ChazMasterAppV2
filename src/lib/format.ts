export function money(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "$0.00";
  return `$${v.toFixed(2)}`;
}

export function num(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-US");
}

export function rarityColor(rarity: string): string {
  const r = (rarity || "").toLowerCase();
  if (r.includes("secret") || r.includes("alt art") || r.includes("special illustration")) return "bg-gradient-to-r from-amber-400 to-yellow-600 text-white";
  if (r.includes("double rare") || r.includes("ultra") || r.includes(" ex") || r.includes(" vstar") || r.includes("vmax") || r.includes(" v ")) return "bg-violet-600 text-white";
  if (r.includes("holo") || r.includes("promo") || r.includes("rare holo")) return "bg-sky-600 text-white";
  if (r.includes("rare")) return "bg-blue-600 text-white";
  if (r.includes("uncommon")) return "bg-emerald-600 text-white";
  return "bg-slate-500 text-white";
}

export function conditionColor(c: string): string {
  const v = (c || "").toUpperCase();
  if (v === "NM" || v.includes("NEAR")) return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (v === "LP" || v.includes("LIGHT")) return "bg-lime-100 text-lime-800 border-lime-300";
  if (v === "MP" || v.includes("MODERATE")) return "bg-amber-100 text-amber-800 border-amber-300";
  if (v === "HP" || v.includes("HEAVY")) return "bg-red-100 text-red-800 border-red-300";
  if (v === "DMG") return "bg-red-200 text-red-900 border-red-400";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

export function statusColor(s: string): string {
  const v = (s || "").toLowerCase();
  if (v === "accepted") return "bg-emerald-500 text-white";
  if (v === "rejected") return "bg-red-500 text-white";
  if (v === "completed") return "bg-blue-600 text-white";
  return "bg-amber-400 text-amber-950";
}

export function timeAgo(d: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
