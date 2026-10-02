import Link from "next/link";
import Pokeball from "./Pokeball";

export default function Footer() {
  return (
    <footer className="mt-16 bg-[#0f1b33] text-slate-300 border-t-4 border-[#FFCB05]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <Pokeball className="w-8 h-8" />
            <span className="text-lg font-black text-white">
              <span className="text-[#FFCB05]">Chaz</span>Master
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed">
            Your 100,000+ Pokémon TCG vault. Scan with CardUploader, upload the CSV, share your shop link, and let friends
            claim cards in one click.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">Quick Links</h4>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
            <Link href="/collection" className="hover:text-white">My Collection</Link>
            <Link href="/upload" className="hover:text-white">Upload CSV</Link>
            <Link href="/shop" className="hover:text-white">Shop / Share</Link>
            <Link href="/requests" className="hover:text-white">Sale Requests</Link>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">How it works</h4>
          <ol className="mt-3 space-y-2 text-sm">
            <li><span className="font-black text-white">1.</span> Scan cards → export Excel from CardUploader</li>
            <li><span className="font-black text-white">2.</span> Upload CSV here — auto-added to your vault</li>
            <li><span className="font-black text-white">3.</span> Share your shop link with friends</li>
            <li><span className="font-black text-white">4.</span> Friends multi-select & send buy requests</li>
          </ol>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
        ChazMaster © {new Date().getFullYear()} — Built for trainers.
      </div>
    </footer>
  );
}
