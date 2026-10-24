import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { listings, transactions, users, ads, settings } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { currentUser, isLaunch, PLANS, eur, VERTICALS } from "@/lib/core";
import { adminSettingsAction, adminLaunchAction, adminUserPlanAction, adminAdAction, adminToggleAdAction, setStatusAction } from "@/lib/actions";

const KIND: Record<string, string> = { venta: "Comisión ventas", alquiler: "Comisión alquileres", suscripcion: "Suscripciones", destacado: "Destacados", anuncio_pago: "Anuncios de pago", publicidad: "Publicidad" };

export default async function Admin() {
  const u = await currentUser();
  if (!u?.isAdmin) redirect("/cuenta");
  const byKind = await db.select({ kind: transactions.kind, rev: sql<string>`sum(${transactions.platformFee})`, gmv: sql<string>`sum(${transactions.amount})`, n: sql<number>`count(*)::int` }).from(transactions).groupBy(transactions.kind);
  const total = byKind.reduce((a, k) => a + Number(k.rev), 0);
  const gmv = byKind.filter((k) => k.kind === "venta" || k.kind === "alquiler").reduce((a, k) => a + Number(k.gmv), 0);
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const mrr = allUsers.reduce((a, x) => a + PLANS[x.plan].price, 0);
  const byVertical = await db.select({ v: listings.vertical, n: sql<number>`count(*)::int` }).from(listings).groupBy(listings.vertical);
  const recent = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(20);
  const allListings = await db.select().from(listings).orderBy(desc(listings.createdAt)).limit(30);
  const allAds = await db.select().from(ads);
  const [ov] = await db.select().from(settings).where(eq(settings.key, "commission_override"));
  const launch = await isLaunch();
  const inp = "border rounded px-2 py-1";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Panel de administración</h1>
      <section className={`rounded-xl p-5 border flex flex-wrap items-center gap-4 ${launch ? "bg-amber-50 border-amber-300" : "bg-emerald-50 border-emerald-300"}`}>
        <div className="flex-1 min-w-64">
          <p className="font-bold">{launch ? "🚀 MODO LANZAMIENTO ACTIVO (Fase 1)" : "💰 MODO MONETIZACIÓN ACTIVO (Fase 3)"}</p>
          <p className="text-sm text-slate-600">{launch ? "Todo es gratis: 0% comisión, destacados, planes y anuncios de motor/inmobiliaria sin coste. Objetivo: llenar la web con 200+ anuncios." : "Se cobran comisiones, suscripciones, destacados y anuncios de pago."}</p>
          <p className="text-xs text-slate-500 mt-1">Anuncios activos ahora: {byVertical.reduce((a, b) => a + b.n, 0)} / 200 objetivo</p>
        </div>
        <form action={adminLaunchAction}><input type="hidden" name="on" value={launch ? "0" : "1"} />
          <button className={`px-5 py-3 rounded font-bold text-white ${launch ? "bg-emerald-600" : "bg-amber-500"}`}>{launch ? "Activar cobros" : "Volver a modo lanzamiento"}</button></form>
      </section>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[["Ingresos plataforma", eur(total)], ["MRR suscripciones", eur(mrr)], ["Volumen transaccionado", eur(gmv)], ["Usuarios", allUsers.length], ["Anuncios", byVertical.reduce((a, b) => a + b.n, 0)]].map(([k, v]) => (
          <div key={k} className="bg-slate-900 text-white rounded-xl p-4"><p className="text-xs opacity-70">{k}</p><p className="text-2xl font-bold">{v}</p></div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-bold mb-3">Ingresos por fuente</h2>
          {byKind.map((k) => (
            <div key={k.kind} className="mb-2 text-sm">
              <div className="flex justify-between"><span>{KIND[k.kind] ?? k.kind} ({k.n})</span><b>{eur(k.rev)}</b></div>
              <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-emerald-500 rounded" style={{ width: `${total ? (Number(k.rev) / total) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </section>
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-bold">Configuración de comisiones</h2>
          <p className="text-sm text-slate-500">Por plan: {Object.values(PLANS).map((p) => `${p.label} ${p.commission}%`).join(" · ")}. Puedes forzar una comisión global (vacío = por plan).</p>
          <form action={adminSettingsAction} className="flex gap-2"><input name="commission" defaultValue={ov?.value ?? ""} placeholder="% global" className={inp} /><button className="bg-emerald-600 text-white px-4 rounded">Guardar</button></form>
          <h3 className="font-semibold pt-2">Anuncios por sección</h3>
          <div className="flex flex-wrap gap-2 text-xs">{byVertical.map((b) => <span key={b.v} className="bg-slate-100 px-2 py-1 rounded">{VERTICALS[b.v]?.emoji} {VERTICALS[b.v]?.label}: {b.n}</span>)}</div>
        </section>
      </div>
      <section className="bg-white border rounded-xl p-5">
        <h2 className="font-bold mb-3">Banners publicitarios</h2>
        <form action={adminAdAction} className="flex flex-wrap gap-2 mb-3 text-sm">
          <input name="brand" placeholder="Marca" required className={inp} /><input name="text" placeholder="Texto" required className={`${inp} flex-1`} />
          <input name="url" placeholder="URL" className={inp} /><input name="fee" type="number" placeholder="€/mes" className={`${inp} w-24`} />
          <button className="bg-slate-900 text-white px-4 rounded">Añadir</button>
        </form>
        {allAds.map((a) => (
          <div key={a.id} className="flex items-center gap-3 border-t py-2 text-sm"><b>{a.brand}</b><span className="flex-1">{a.text}</span><span>{eur(a.monthlyFee)}/mes</span>
            <form action={adminToggleAdAction}><input type="hidden" name="id" value={a.id} /><button className={`text-xs px-2 py-1 rounded ${a.active ? "bg-emerald-100" : "bg-slate-100"}`}>{a.active ? "Activo" : "Inactivo"}</button></form></div>
        ))}
      </section>
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white border rounded-xl p-5 overflow-x-auto">
          <h2 className="font-bold mb-3">Usuarios</h2>
          <table className="w-full text-sm"><tbody>{allUsers.map((x) => (
            <tr key={x.id} className="border-t"><td className="py-1">{x.name}{x.isAdmin && " 👑"}<br /><span className="text-xs text-slate-500">{x.email}</span></td>
              <td><form action={adminUserPlanAction} className="flex gap-1"><input type="hidden" name="id" value={x.id} />
                <select name="plan" defaultValue={x.plan} className={inp}>{Object.entries(PLANS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
                <button className="text-xs border px-2 rounded">OK</button></form></td></tr>
          ))}</tbody></table>
        </section>
        <section className="bg-white border rounded-xl p-5 overflow-x-auto">
          <h2 className="font-bold mb-3">Últimas transacciones</h2>
          <table className="w-full text-sm"><thead className="text-left text-slate-500"><tr><th>Tipo</th><th>Importe</th><th>Tu comisión</th></tr></thead>
            <tbody>{recent.map((t) => <tr key={t.id} className="border-t"><td>{t.kind}<br /><span className="text-xs text-slate-500">{t.note}</span></td><td>{eur(t.amount)}</td><td className="font-semibold text-emerald-700">{eur(t.platformFee)}</td></tr>)}</tbody></table>
        </section>
      </div>
      <section className="bg-white border rounded-xl p-5">
        <h2 className="font-bold mb-3">Moderación de anuncios</h2>
        {allListings.map((l) => (
          <div key={l.id} className="flex items-center gap-3 border-t py-2 text-sm">
            <span>{l.emoji}</span><Link href={`/anuncio/${l.id}`} className="flex-1 hover:underline">{l.title}</Link><span className="text-xs">{l.status}</span>
            <form action={setStatusAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value="/admin" />
              <button name="status" value="pausado" className="text-xs border px-2 rounded mr-1">Pausar</button>
              <button name="status" value="borrar" className="text-xs text-red-600">Eliminar</button></form>
          </div>
        ))}
      </section>
    </div>
  );
}
