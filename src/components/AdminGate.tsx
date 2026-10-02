"use client";

import { useState } from "react";
import { useAdmin } from "./AdminProvider";
import Pokeball from "./Pokeball";

export default function AdminGate({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { isAdmin, checking, login } = useAdmin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pin.trim() || loading) return;
    setLoading(true);
    setError("");
    const res = await login(pin.trim());
    if (!res.ok) setError(res.error || "Incorrect code");
    setPin("");
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Pokeball className="w-14 h-14 animate-spin opacity-40" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-3xl bg-white p-8 shadow-2xl border-4 border-[#FFCB05] text-center">
          <Pokeball className="mx-auto w-16 h-16" />
          <h1 className="mt-4 font-display text-2xl text-[#0f1b33]">{title || "Admin Access Required"}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {description || "Enter the ChazMaster admin code to manage the collection."}
          </p>
          <form onSubmit={submit} className="mt-6">
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
            {error && <p className="mt-2 text-sm font-bold text-red-600">⚠️ {error}</p>}
            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className="mt-4 w-full rounded-full bg-gradient-to-b from-[#FFCB05] to-[#e0a800] py-3 font-display text-[#0f1b33] shadow-[0_6px_0_#8a6d00] hover:translate-y-0.5 hover:shadow-[0_3px_0_#8a6d00] transition-all disabled:opacity-50"
            >
              {loading ? "Checking…" : "🔓 Unlock"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
