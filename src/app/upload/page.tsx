"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { autoMapHeaders, normalizeRows, parseCsvText, TARGET_FIELDS, type NormalizedCardRow } from "@/lib/csv";
import { money, num, timeAgo } from "@/lib/format";
import AdminGate from "@/components/AdminGate";

type Batch = { id: number; filename: string; rowCount: number; newCards: number; mergedCards: number; totalValue: number; createdAt: string };

function UploadPageContent() {
  const [dragOver, setDragOver] = useState(false);
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<string, keyof NormalizedCardRow | "">>({});
  const [normalized, setNormalized] = useState<NormalizedCardRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ imported: number; newCards: number; mergedCards: number; totalValue: number; fastMode?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [dbStatus, setDbStatus] = useState<"checking" | "ok" | "down">("checking");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadBatches = async () => {
    try {
      const r = await fetch("/api/upload");
      const d = await r.json();
      setBatches(d.batches || []);
    } catch {}
  };

  const checkHealth = async () => {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      const d = await r.json().catch(() => null);
      setDbStatus(r.ok && d?.ok ? "ok" : "down");
    } catch {
      setDbStatus("down");
    }
  };

  useEffect(() => {
    loadBatches();
    checkHealth();
  }, []);

  useEffect(() => {
    if (headers.length && rawRows.length) {
      setNormalized(normalizeRows(rawRows, headerMap));
    } else {
      setNormalized([]);
    }
  }, [headerMap, rawRows, headers]);

  const handleFile = async (file: File) => {
    setError("");
    setResult(null);
    setFilename(file.name);
    setProgress("Reading file…");
    try {
      const text = await file.text();
      // Excel .xlsx pasted? we only support CSV — try parse anyway
      const { headers: h, rows } = await parseCsvText(text);
      if (!h.length) {
        setError("Could not detect columns. Make sure you export CSV from CardUploader (not .xlsx). In Excel: File → Save As → CSV UTF-8.");
        setProgress("");
        return;
      }
      setHeaders(h);
      setRawRows(rows);
      setHeaderMap(autoMapHeaders(h));
      setProgress("");
    } catch (e) {
      console.error(e);
      setError("Failed to parse file. Export as CSV and try again.");
      setProgress("");
    }
  };

  const doUpload = async () => {
    if (!normalized.length) {
      setError("Nothing to upload — check your column mapping (Card Name is required).");
      return;
    }
    setUploading(true);
    setError("");

    // Send in small chunks: hosting providers (e.g. Vercel) reject big request
    // bodies, and chunking also gives a live progress counter for 100k+ rows.
    const CHUNK = 1000;
    const rows = normalized;
    const totalRows = rows.length;
    let batchId = 0;
    let sent = 0;
    let newCards = 0;
    let mergedCards = 0;
    let totalValue = 0;
    let failed = "";

    try {
      for (let i = 0; i < totalRows; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const isLast = i + CHUNK >= totalRows;
        setProgress(`Uploading ${num(Math.min(i + slice.length, totalRows))} / ${num(totalRows)} cards…`);

        let attempt = 0;
        let ok = false;
        while (attempt < 3 && !ok) {
          attempt++;
          try {
            const r = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename: filename || "upload.csv", rows: slice, batchId: batchId || undefined, final: isLast }),
            });
            const raw = await r.text();
            let d: { error?: string; batchId?: number; imported?: number; newCards?: number; mergedCards?: number; totalValue?: number } | null = null;
            try {
              d = raw ? JSON.parse(raw) : null;
            } catch {
              d = null;
            }
            if (r.ok && d) {
              batchId = d.batchId || batchId;
              sent += d.imported || 0;
              newCards += d.newCards || 0;
              mergedCards += d.mergedCards || 0;
              totalValue += d.totalValue || 0;
              ok = true;
            } else if (d?.error) {
              failed = d.error;
              if (r.status === 401 || r.status === 400) break; // no point retrying
            } else if (r.status === 413) {
              failed = "The server rejected the upload as too large.";
              break;
            } else if (r.status === 504 || r.status === 502) {
              failed = "The server timed out. Retrying…";
            } else {
              failed = `Upload failed (HTTP ${r.status}). ${raw ? raw.slice(0, 160) : "No response body."}`;
            }
          } catch {
            failed = "Network error — could not reach the server.";
          }
          if (!ok && attempt < 3) await new Promise((res) => setTimeout(res, 800 * attempt));
        }
        if (!ok) break;
        failed = "";
      }
    } catch (e) {
      console.error("upload failed", e);
      failed = "Unexpected error while uploading. Please try again.";
    }

    if (failed) {
      setError(
        sent > 0
          ? `${failed} (${num(sent)} of ${num(totalRows)} cards were saved before the problem. Uploading the same file again is safe — duplicates merge.)`
          : failed
      );
      loadBatches();
    } else {
      setResult({ imported: sent, newCards, mergedCards, totalValue, fastMode: false });
      setHeaders([]);
      setRawRows([]);
      setNormalized([]);
      setFilename("");
      loadBatches();
    }
    setUploading(false);
    setProgress("");
  };

  const loadSample = async () => {
    const r = await fetch("/api/template");
    const text = await r.text();
    const blob = new File([text], "chazmaster-template.csv", { type: "text/csv" });
    handleFile(blob);
  };

  const mappedCount = Object.values(headerMap).filter(Boolean).length;
  const previewValue = normalized.reduce((s, r) => s + r.price * r.quantity, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl text-[#0f1b33]">UPLOAD CSV / EXCEL</h1>
      <p className="mt-1 font-semibold text-slate-500">
        Export from <span className="font-black text-[#0f1b33]">carduploader.com/dashboard</span> → save as <span className="font-black">CSV</span> → drop it here. Auto-adds to your vault.
      </p>

      {dbStatus === "down" && (
        <div className="mt-4 rounded-2xl bg-red-50 border-2 border-red-300 p-4">
          <p className="font-black text-red-700">⚠️ Can&apos;t reach the database</p>
          <p className="mt-1 text-sm font-semibold text-red-600">
            Uploads will fail until this is fixed. On your hosting provider (e.g. Vercel), make sure{" "}
            <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs">DATABASE_URL</code> is set in{" "}
            <span className="font-black">Project → Settings → Environment Variables</span>, then redeploy. Also confirm
            you ran <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs">npx drizzle-kit push</code> once
            against that database to create the tables.
          </p>
          <button onClick={checkHealth} className="mt-2 rounded-full bg-red-600 px-4 py-1.5 text-xs font-black text-white">
            🔄 Re-check connection
          </button>
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow-2xl">
          <h3 className="font-display text-xl">✅ UPLOAD COMPLETE!</h3>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-2xl font-black">{num(result.imported)}</p><p className="text-xs font-bold uppercase tracking-widest opacity-80">Imported</p></div>
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-2xl font-black">{num(result.newCards)}</p><p className="text-xs font-bold uppercase tracking-widest opacity-80">New</p></div>
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-2xl font-black">{num(result.mergedCards)}</p><p className="text-xs font-bold uppercase tracking-widest opacity-80">Merged</p></div>
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-2xl font-black">{money(result.totalValue)}</p><p className="text-xs font-bold uppercase tracking-widest opacity-80">Value</p></div>
          </div>
          {result.fastMode && <p className="mt-2 text-xs font-bold opacity-80">⚡ Fast mode (3000+ rows): bulk insert without per-row merge for speed.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/collection" className="rounded-full bg-white px-6 py-2.5 font-black text-emerald-700">View Collection →</Link>
            <Link href="/shop" className="rounded-full bg-black/25 border border-white/40 px-6 py-2.5 font-black">Open Shop →</Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-3xl border-4 border-dashed p-10 text-center transition-all ${
              dragOver ? "border-[#FFCB05] bg-yellow-50 scale-[1.01]" : "border-slate-300 bg-white hover:border-[#2A75BB]"
            } shadow-lg`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <p className="text-6xl">📤</p>
            <h3 className="mt-3 font-black text-xl">{filename || "Drop your CardUploader CSV here"}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">or click to browse • supports 100k+ rows • auto-detects columns</p>
            {progress && <p className="mt-3 font-black text-[#2A75BB] animate-pulse">{progress}</p>}
            {uploading && (
              <div className="mx-auto mt-4 h-3 max-w-md overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[#FFCB05] to-[#2A75BB]" />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 border-2 border-red-200 p-4 font-bold text-red-700 text-sm">⚠️ {error}</div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/template" className="rounded-full bg-white border-2 border-slate-200 px-5 py-2.5 text-sm font-black hover:border-[#FFCB05] shadow">
              ⬇ Download CSV Template
            </a>
            <button onClick={loadSample} className="rounded-full bg-white border-2 border-slate-200 px-5 py-2.5 text-sm font-black hover:border-[#2A75BB] shadow">
              ✨ Preview sample file
            </button>
          </div>

          {/* Mapping */}
          {headers.length > 0 && (
            <div className="mt-6 rounded-3xl bg-white p-6 shadow-lg border-2 border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-lg">🗺 Column Mapping <span className="text-sm text-slate-400">({mappedCount}/{TARGET_FIELDS.length} mapped)</span></h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{num(rawRows.length)} rows detected • {num(normalized.length)} valid • {money(previewValue)}</span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-400">Auto-detected from your headers — fix any mismatches before importing.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-black" title={h}>“{h}”</span>
                    <span className="text-slate-400">→</span>
                    <select
                      value={headerMap[h] || ""}
                      onChange={(e) => setHeaderMap({ ...headerMap, [h]: e.target.value as keyof NormalizedCardRow | "" })}
                      className="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs font-black"
                    >
                      <option value="">— Ignore —</option>
                      {TARGET_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <h4 className="mt-5 font-black">👀 Preview (first 10)</h4>
              <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[800px] text-xs">
                  <thead>
                    <tr className="bg-[#0f1b33] text-white text-left">
                      <th className="px-3 py-2">Card</th>
                      <th className="px-3 py-2">Set</th>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Rarity</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2">Variant</th>
                      <th className="px-3 py-2">Cond</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalized.slice(0, 10).map((r, i) => (
                      <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                        <td className="px-3 py-2 font-black">{r.cardName}</td>
                        <td className="px-3 py-2 font-semibold">{r.setName}</td>
                        <td className="px-3 py-2">{r.cardNumber}</td>
                        <td className="px-3 py-2">{r.rarity}</td>
                        <td className="px-3 py-2 text-right font-black">{money(r.price)}</td>
                        <td className="px-3 py-2 text-right font-black">×{r.quantity}</td>
                        <td className="px-3 py-2">{r.variant}</td>
                        <td className="px-3 py-2">{r.condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={doUpload}
                disabled={uploading || !normalized.length}
                className="mt-5 w-full rounded-2xl bg-gradient-to-b from-[#FFCB05] to-[#e0a800] py-4 font-display text-lg text-[#0f1b33] shadow-[0_6px_0_#8a6d00] hover:translate-y-0.5 hover:shadow-[0_3px_0_#8a6d00] transition-all disabled:opacity-50"
              >
                {uploading ? "⚡ IMPORTING…" : `⚡ IMPORT ${num(normalized.length)} CARDS TO VAULT`}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#0f1b33] p-6 text-white shadow-xl">
            <h3 className="font-display text-sm text-[#FFCB05]">HOW TO EXPORT FROM CARDUPLOADER</h3>
            <ol className="mt-3 space-y-2.5 text-sm font-semibold text-slate-200">
              <li><span className="mr-1.5 inline-grid h-6 w-6 place-items-center rounded-full bg-[#FFCB05] text-xs font-black text-[#0f1b33]">1</span> Scan cards with your scanner</li>
              <li><span className="mr-1.5 inline-grid h-6 w-6 place-items-center rounded-full bg-[#FFCB05] text-xs font-black text-[#0f1b33]">2</span> Open carduploader.com/dashboard</li>
              <li><span className="mr-1.5 inline-grid h-6 w-6 place-items-center rounded-full bg-[#FFCB05] text-xs font-black text-[#0f1b33]">3</span> Download the Excel file (like your screenshot)</li>
              <li><span className="mr-1.5 inline-grid h-6 w-6 place-items-center rounded-full bg-[#FFCB05] text-xs font-black text-[#0f1b33]">4</span> In Excel: File → Save As → <span className="text-[#FFCB05]">CSV UTF-8</span></li>
              <li><span className="mr-1.5 inline-grid h-6 w-6 place-items-center rounded-full bg-[#FFCB05] text-xs font-black text-[#0f1b33]">5</span> Drop the CSV here → instant vault growth</li>
            </ol>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg border-2 border-slate-100">
            <h3 className="font-black">📜 Upload History</h3>
            {batches.length === 0 && <p className="mt-2 text-sm font-semibold text-slate-400">No uploads yet.</p>}
            <div className="mt-3 space-y-2 max-h-[400px] overflow-auto scrollbar-thin">
              {batches.map((b) => (
                <div key={b.id} className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
                  <p className="truncate text-sm font-black" title={b.filename}>📄 {b.filename}</p>
                  <p className="text-xs font-bold text-slate-500">
                    {num(b.rowCount)} rows • <span className="text-emerald-600">+{num(b.newCards)} new</span> • {num(b.mergedCards)} merged • {money(b.totalValue)}
                  </p>
                  <p className="text-[11px] font-bold text-slate-400">{timeAgo(b.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <AdminGate title="Admin Access Required" description="Enter the ChazMaster admin code to upload CSVs and manage the vault.">
      <UploadPageContent />
    </AdminGate>
  );
}
