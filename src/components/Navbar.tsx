"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Pokeball from "./Pokeball";
import { useAdmin } from "./AdminProvider";

const links = [
  { href: "/", label: "Home" },
  { href: "/collection", label: "My Collection" },
  { href: "/upload", label: "Upload CSV" },
  { href: "/shop", label: "Shop / Share" },
  { href: "/requests", label: "Requests" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isAdmin, login, logout } = useAdmin();
  const [pending, setPending] = useState<number>(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setPending(0);
      return;
    }
    fetch("/api/requests?status=pending")
      .then((r) => r.json())
      .then((d) => setPending(d?.total ?? 0))
      .catch(() => {});
  }, [pathname, isAdmin]);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || loggingIn) return;
    setLoggingIn(true);
    setLoginError("");
    const res = await login(pin.trim());
    if (!res.ok) {
      setLoginError(res.error || "Incorrect code");
    } else {
      setLoginOpen(false);
      setPin("");
    }
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    if (!confirm("Log out of admin mode?")) return;
    await logout();
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="h-2 bg-gradient-to-r from-[#CC0000] via-[#ff5350] to-[#CC0000]" />
      <nav className="bg-[#0f1b33]/95 backdrop-blur border-b-4 border-[#FFCB05]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="relative">
                <Pokeball className="w-10 h-10 transition-transform duration-500 group-hover:rotate-[360deg]" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FFCB05] animate-pulse" />
              </span>
              <span>
                <span className="block text-xl font-black tracking-tight leading-none">
                  <span className="text-[#FFCB05]" style={{ textShadow: "2px 2px 0 #2A75BB" }}>Chaz</span>
                  <span className="text-white">Master</span>
                </span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-300">
                  Pokémon TCG Vault
                </span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {links.map((l) => {
                const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`relative rounded-full px-4 py-2 text-sm font-bold transition-all ${
                      active
                        ? "bg-[#FFCB05] text-[#0f1b33] shadow-[0_0_20px_rgba(255,203,5,0.5)]"
                        : "text-slate-200 hover:text-[#FFCB05] hover:bg-white/10"
                    }`}
                  >
                    {l.label}
                    {l.href === "/requests" && pending > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#CC0000] px-1 text-[11px] font-black text-white ring-2 ring-[#0f1b33]">
                        {pending}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:flex items-center gap-2">
              {isAdmin ? (
                <button
                  onClick={handleLogout}
                  title="Log out of admin mode"
                  className="rounded-full bg-emerald-600/20 border-2 border-emerald-400 px-4 py-2 text-sm font-black text-emerald-300 hover:bg-emerald-600/30"
                >
                  🔓 Admin
                </button>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  title="Admin login"
                  className="rounded-full bg-white/10 border-2 border-white/30 px-4 py-2 text-sm font-black text-white hover:border-[#FFCB05]"
                >
                  🔒 Admin
                </button>
              )}
              <Link
                href="/upload"
                className="rounded-full bg-gradient-to-b from-[#ff5350] to-[#CC0000] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-red-900/40 border-b-4 border-red-900 hover:brightness-110 active:border-b-0 active:translate-y-0.5 transition-all"
              >
                + Add Cards
              </Link>
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden rounded-lg p-2 text-white hover:bg-white/10"
              aria-label="menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {mobileOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#0f1b33] px-4 pb-4 pt-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm font-bold ${
                  pathname === l.href ? "bg-[#FFCB05] text-[#0f1b33]" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                {l.label}
                {l.href === "/requests" && pending > 0 && ` (${pending})`}
              </Link>
            ))}
            {isAdmin ? (
              <button
                onClick={handleLogout}
                className="mt-2 block w-full rounded-xl bg-emerald-600/20 border-2 border-emerald-400 px-4 py-3 text-left text-sm font-black text-emerald-300"
              >
                🔓 Admin (tap to log out)
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  setLoginOpen(true);
                }}
                className="mt-2 block w-full rounded-xl bg-white/10 border-2 border-white/30 px-4 py-3 text-left text-sm font-black text-white"
              >
                🔒 Admin login
              </button>
            )}
          </div>
        )}
      </nav>

      {loginOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={() => setLoginOpen(false)}>
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border-4 border-[#FFCB05]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-[#0f1b33]">🔒 Admin Login</h3>
              <button onClick={() => setLoginOpen(false)} className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-black">✕</button>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">Enter the ChazMaster admin code.</p>
            <form onSubmit={submitLogin} className="mt-4">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                maxLength={12}
                autoFocus
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-center text-2xl font-black tracking-[0.4em] outline-none focus:border-[#FFCB05] focus:ring-4 focus:ring-yellow-100"
              />
              {loginError && <p className="mt-2 text-sm font-bold text-red-600">⚠️ {loginError}</p>}
              <button
                type="submit"
                disabled={loggingIn || !pin.trim()}
                className="mt-4 w-full rounded-full bg-gradient-to-b from-[#FFCB05] to-[#e0a800] py-3 font-display text-[#0f1b33] shadow-[0_6px_0_#8a6d00] hover:translate-y-0.5 hover:shadow-[0_3px_0_#8a6d00] transition-all disabled:opacity-50"
              >
                {loggingIn ? "Checking…" : "🔓 Unlock"}
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
