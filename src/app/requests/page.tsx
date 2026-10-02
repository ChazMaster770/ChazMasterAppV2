"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { money, num, statusColor, timeAgo } from "@/lib/format";
import CardImage from "@/components/CardImage";
import AdminGate from "@/components/AdminGate";

type Item = {
  id: number;
  cardId: number;
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  condition: string;
  variant: string;
  quantity: number;
  priceEach: number;
  currentPrice: number;
  stockLeft: number;
  imageUrl?: string | null;
};

type Req = {
  id: number;
  requesterName: string;
  requesterContact: string;
  message: string;
  status: string;
  channel?: string;
  totalValue: number;
  itemCount: number;
  createdAt: string;
  items: Item[];
};

function channelBadge(channel?: string) {
  const c = (channel || "in-app").toLowerCase();
  if (c === "whatsapp") return { label: "💬 WhatsApp", cls: "bg-emerald-100 text-emerald-700 border border-emerald-300" };
  if (c === "email") return { label: "📧 Email", cls: "bg-sky-100 text-sky-700 border border-sky-300" };
  return { label: "📨 In-App", cls: "bg-slate-100 text-slate-600 border border-slate-300" };
}

function RequestsPageContent() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminWhatsapp, setAdminWhatsapp] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/requests${filter ? `?status=${filter}` : ""}`);
      const d = await r.json();
      setRequests(d.requests || []);
    } catch {}
    setLoading(false);
  }, [filter]);

  const loadSettings = useCallback(async () => {
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const d = await r.json();
      setAdminEmail(d.adminEmail || "");
      setAdminWhatsapp(d.adminWhatsapp || "");
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSettings();
    // Auto-open the settings panel the first time nothing is configured yet.
  }, [loadSettings]);

  useEffect(() => {
    if (!loading && !adminEmail && !adminWhatsapp) setSettingsOpen(true);
  }, [loading, adminEmail, adminWhatsapp]);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg("");
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail, adminWhatsapp }),
      });
      const d = await r.json();
      if (!r.ok) {
        setSettingsMsg(d.error || "Could not save");
      } else {
        setAdminEmail(d.adminEmail || "");
        setAdminWhatsapp(d.adminWhatsapp || "");
        setSettingsMsg("✅ Saved! Friends can now send orders straight to you.");
      }
    } catch {
      setSettingsMsg("Network error — try again.");
    }
    setSavingSettings(false);
  };

  const setStatus = async (id: number, status: string) => {
    const labels: Record<string, string> = {
      accepted: "Accept this request? Stock will be deducted.",
      rejected: "Reject this request?",
      completed: "Mark as completed / paid?",
      pending: "Move back to pending?",
    };
    if (!confirm(labels[status] || "Update status?")) return;
    setActing(id);
    try {
      const r = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (!r.ok) alert(d.error || "Failed");
      else load();
    } catch {
      alert("Failed to update");
    }
    setActing(null);
  };

  const delReq = async (id: number) => {
    if (!confirm("Delete this request permanently?")) return;
    await fetch(`/api/requests/${id}`, { method: "DELETE" });
    load();
  };

  const copyShopLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/shop`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
  };
  const pipeline = requests.filter((r) => ["pending", "accepted"].includes(r.status)).reduce((s, r) => s + (r.totalValue || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-[#0f1b33]">SALE REQUESTS 📨</h1>
          <p className="font-semibold text-slate-500">
            Friends claim multiple cards from your shop — you accept, pack & get paid.{" "}
            <span className="font-black text-emerald-600">{money(pipeline)}</span> in pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSettingsOpen(!settingsOpen)} className="rounded-full bg-white border-2 border-slate-200 px-5 py-2.5 text-sm font-black hover:border-[#2A75BB]">
            ⚙️ Contact Settings
          </button>
          <button onClick={copyShopLink} className="rounded-full bg-[#FFCB05] px-5 py-2.5 text-sm font-black text-[#0f1b33] shadow">
            {copied ? "✅ Copied!" : "🔗 Copy Shop Link"}
          </button>
          <Link href="/shop" className="rounded-full bg-[#0f1b33] px-5 py-2.5 text-sm font-black text-white">View Shop</Link>
        </div>
      </div>

      {settingsOpen && (
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-lg border-2 border-[#FFCB05]">
          <h3 className="font-black text-lg">⚙️ Contact Settings</h3>
          <p className="text-sm font-semibold text-slate-500">
            These power the <span className="font-black">Email</span> and <span className="font-black">WhatsApp</span> send
            options friends see when submitting an order from your shop.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Your email
              <input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="chaz@example.com"
                className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-[#FFCB05]"
              />
            </label>
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Your WhatsApp number (with country code, digits only)
              <input
                value={adminWhatsapp}
                onChange={(e) => setAdminWhatsapp(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="15551234567"
                inputMode="numeric"
                className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-[#FFCB05]"
              />
            </label>
          </div>
          {settingsMsg && <p className="mt-3 text-sm font-bold text-slate-600">{settingsMsg}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={saveSettings} disabled={savingSettings} className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {savingSettings ? "Saving…" : "💾 Save"}
            </button>
            <button onClick={() => setSettingsOpen(false)} className="rounded-full bg-slate-200 px-6 py-2.5 text-sm font-black">Close</button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { v: "", label: "All" },
          { v: "pending", label: "⏳ Pending" },
          { v: "accepted", label: "✅ Accepted" },
          { v: "completed", label: "🏆 Completed" },
          { v: "rejected", label: "✕ Rejected" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`rounded-full px-5 py-2 text-sm font-black transition-all ${filter === f.v ? "bg-[#0f1b33] text-white shadow-lg" : "bg-white border-2 border-slate-200 hover:border-[#FFCB05]"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-white shadow" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-12 text-center shadow border-2 border-dashed">
          <p className="text-6xl">📭</p>
          <h3 className="mt-3 font-black text-xl">No requests {filter ? `(${filter})` : "yet"}</h3>
          <p className="font-semibold text-slate-500">Share your shop link with friends and claims will land here.</p>
          <button onClick={copyShopLink} className="mt-4 rounded-full bg-[#0f1b33] px-6 py-3 font-black text-white">
            {copied ? "✅ Link Copied!" : "🔗 Copy Shop Link"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {requests.map((r) => {
            const badge = channelBadge(r.channel);
            return (
              <div key={r.id} className="rounded-3xl bg-white shadow-lg border-2 border-slate-100 overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 p-5">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#2A75BB] to-[#0f1b33] text-xl font-black text-white shrink-0">
                    {r.requesterName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-lg">#{r.id} • {r.requesterName}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusColor(r.status)}`}>{r.status}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${badge.cls}`}>{badge.label}</span>
                      <span className="text-xs font-bold text-slate-400">{timeAgo(r.createdAt)}</span>
                    </div>
                    <p className="truncate text-sm font-bold text-slate-500">📞 {r.requesterContact} • {num(r.itemCount)} cards • <span className="font-black text-emerald-600">{money(r.totalValue)}</span></p>
                    {r.message && <p className="mt-1 truncate text-sm font-semibold text-slate-600">💬 “{r.message}”</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black hover:bg-[#FFCB05]">
                      {expanded === r.id ? "Hide ▲" : `Cards (${r.items.length}) ▼`}
                    </button>
                    {r.status === "pending" && (
                      <>
                        <button disabled={acting === r.id} onClick={() => setStatus(r.id, "accepted")} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50">✅ Accept</button>
                        <button disabled={acting === r.id} onClick={() => setStatus(r.id, "rejected")} className="rounded-full bg-red-100 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-200">✕ Reject</button>
                      </>
                    )}
                    {r.status === "accepted" && (
                      <>
                        <button disabled={acting === r.id} onClick={() => setStatus(r.id, "completed")} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white">🏆 Complete</button>
                        <button disabled={acting === r.id} onClick={() => setStatus(r.id, "rejected")} className="rounded-full bg-slate-200 px-4 py-2 text-xs font-black">↩ Cancel</button>
                      </>
                    )}
                    <button onClick={() => delReq(r.id)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black hover:bg-red-100">🗑</button>
                  </div>
                </div>

                {expanded === r.id && (
                  <div className="border-t-2 border-slate-100 bg-slate-50/60 p-5">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead>
                          <tr className="bg-[#0f1b33] text-white text-left text-xs">
                            <th className="px-3 py-2.5 w-14">Pic</th>
                            <th className="px-4 py-2.5">Card</th>
                            <th className="px-4 py-2.5">Set</th>
                            <th className="px-4 py-2.5">Rarity</th>
                            <th className="px-4 py-2.5">Variant/Cond</th>
                            <th className="px-4 py-2.5 text-right">Qty</th>
                            <th className="px-4 py-2.5 text-right">Each</th>
                            <th className="px-4 py-2.5 text-right">Line</th>
                            <th className="px-4 py-2.5 text-right">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.items.map((it) => (
                            <tr key={it.id} className="border-t border-slate-100">
                              <td className="px-2 py-1.5">
                                <CardImage
                                  cardName={it.cardName}
                                  setName={it.setName}
                                  cardNumber={it.cardNumber}
                                  imageUrl={it.imageUrl}
                                  cardId={it.cardId}
                                  className="w-11 !rounded-lg shadow-sm"
                                  autoFetch={false}
                                />
                              </td>
                              <td className="px-4 py-2.5 font-black">{it.cardName} <span className="text-slate-400">#{it.cardNumber}</span></td>
                              <td className="px-4 py-2.5 font-semibold text-slate-600 text-xs">{it.setName}</td>
                              <td className="px-4 py-2.5 text-xs font-bold">{it.rarity}</td>
                              <td className="px-4 py-2.5 text-xs font-bold">{it.variant} • {it.condition}</td>
                              <td className="px-4 py-2.5 text-right font-black">×{it.quantity}</td>
                              <td className="px-4 py-2.5 text-right font-bold">{money(it.priceEach)}</td>
                              <td className="px-4 py-2.5 text-right font-black">{money((it.priceEach || 0) * it.quantity)}</td>
                              <td className="px-4 py-2.5 text-right text-xs font-black text-slate-500">{it.stockLeft ?? "—"} left</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-500">Contact buyer: <span className="font-black text-[#0f1b33]">{r.requesterContact}</span></p>
                      <p className="font-black">Total: <span className="text-emerald-600 text-lg">{money(r.totalValue)}</span></p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-xs font-bold text-slate-400">
        Showing {requests.length} requests {filter && `(${filter})`} • {counts.pending} pending in view
      </p>
    </div>
  );
}

export default function RequestsPage() {
  return (
    <AdminGate title="Admin Access Required" description="Enter the ChazMaster admin code to review sale requests.">
      <RequestsPageContent />
    </AdminGate>
  );
}
