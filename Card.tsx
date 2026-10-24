import Link from "next/link";
import { MODES, eur, unit } from "@/lib/core";

type L = { id: number; title: string; price: string; priceUnit: string; mode: string; city: string; emoji: string; category: string; featuredUntil: Date | null; status: string };

export default function Card({ l }: { l: L }) {
  const featured = l.featuredUntil && new Date(l.featuredUntil) > new Date();
  return (
    <Link href={`/anuncio/${l.id}`} className={`bg-white rounded-xl border overflow-hidden hover:shadow-lg transition block ${featured ? "ring-2 ring-amber-400" : ""}`}>
      <div className="h-36 bg-gradient-to-br from-emerald-50 to-sky-100 flex items-center justify-center text-6xl relative">
        {l.emoji}
        {featured && <span className="absolute top-2 left-2 bg-amber-400 text-xs font-bold px-2 py-0.5 rounded">⭐ DESTACADO</span>}
        <span className="absolute top-2 right-2 bg-white/90 text-xs px-2 py-0.5 rounded">{MODES[l.mode] ?? l.mode}</span>
        {l.status !== "activo" && <span className="absolute inset-0 bg-black/50 text-white font-bold flex items-center justify-center text-lg uppercase">{l.status}</span>}
      </div>
      <div className="p-3">
        <p className="font-bold text-lg">{Number(l.price) === 0 ? "Gratis" : eur(l.price)}<span className="text-sm font-normal text-slate-500">{unit(l.priceUnit)}</span></p>
        <p className="text-sm line-clamp-2 min-h-10">{l.title}</p>
        <p className="text-xs text-slate-500 mt-1">📍 {l.city} · {l.category}</p>
      </div>
    </Link>
  );
}
