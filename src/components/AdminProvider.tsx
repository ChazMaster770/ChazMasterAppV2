"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type AdminContextType = {
  isAdmin: boolean;
  checking: boolean;
  login: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/auth", { cache: "no-store" });
      const d = await r.json();
      setIsAdmin(!!d.isAdmin);
    } catch {
      setIsAdmin(false);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (pin: string) => {
    try {
      const r = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const d = await r.json();
      if (!r.ok) return { ok: false, error: d.error || "Incorrect code" };
      setIsAdmin(true);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — try again" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch {}
    setIsAdmin(false);
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, checking, login, logout, refresh }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextType {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
