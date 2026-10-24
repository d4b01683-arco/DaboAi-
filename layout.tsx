import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser, isLaunch } from "@/lib/core";

export const metadata: Metadata = {
  title: "TodoMarket — Compra, vende y alquila lo que sea",
  description: "Super-marketplace local: motor, inmobiliaria, productos, alquileres, servicios, empleo, traspasos y eventos.",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const launch = await isLaunch();
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        {launch && <div className="bg-amber-400 text-center text-sm font-semibold py-1.5">🚀 Lanzamiento: publica GRATIS, sin comisiones y con plan PRO y destacados gratis</div>}
        <header className="bg-white border-b sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
            <Link href="/" className="font-black text-2xl text-emerald-600">Todo<span className="text-slate-900">Market</span></Link>
            <nav className="ml-auto flex items-center gap-1 sm:gap-3 text-sm">
              <Link href="/planes" className="px-3 py-2 hover:text-emerald-600">Planes</Link>
              {u?.isAdmin && <Link href="/admin" className="px-3 py-2 hover:text-emerald-600">Admin</Link>}
              <Link href="/cuenta" className="px-3 py-2 hover:text-emerald-600">{u ? u.name.split(" ")[0] : "Entrar"}</Link>
              <Link href="/publicar" className="bg-emerald-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-emerald-700">+ Publicar</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="bg-slate-900 text-slate-400 text-sm py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 grid sm:grid-cols-3 gap-4">
            <p><b className="text-white">TodoMarket</b> — publica gratis, paga solo cuando vendes.</p>
            <p>Pagos seguros con retención de comisión (Stripe Connect). Demo: pagos simulados.</p>
            <p>Demo admin: admin@todomarket.es / admin123</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
