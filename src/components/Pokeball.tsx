export default function Pokeball({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#1e293b" strokeWidth="5" />
      <path d="M4 50 A46 46 0 0 1 96 50 Z" fill="#CC0000" />
      <rect x="4" y="44" width="92" height="12" fill="#1e293b" />
      <circle cx="50" cy="50" r="16" fill="#fff" stroke="#1e293b" strokeWidth="5" />
      <circle cx="50" cy="50" r="7" fill="#e2e8f0" stroke="#1e293b" strokeWidth="3" />
    </svg>
  );
}

export function PokeballPattern({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="120" height="120" viewBox="0 0 100 100" fill="none" opacity="0.06" aria-hidden="true">
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" />
      <line x1="4" y1="50" x2="96" y2="50" stroke="currentColor" strokeWidth="6" />
      <circle cx="50" cy="50" r="14" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}
