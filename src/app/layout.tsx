import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AdminProvider } from "@/components/AdminProvider";

export const metadata: Metadata = {
  title: "ChazMaster — Pokémon TCG Vault",
  description: "Upload CardUploader CSVs, manage 100k+ Pokémon cards, share your shop and receive multi-card sale requests.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f2f5fb] text-slate-900 antialiased">
        <AdminProvider>
          <Navbar />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
        </AdminProvider>
      </body>
    </html>
  );
}
