"use client";
import { useState } from "react";

type V = Record<string, { label: string; emoji: string; cats: string[] }>;
const META: Record<string, string[]> = {
  motor: ["Kilometraje", "Año", "Combustible", "Cambio"],
  inmobiliaria: ["m²", "Habitaciones", "Baños", "Planta"],
  productos: ["Estado", "Talla", "Marca", "Envío"],
  alquiler: ["Fianza", "Recogida", "Estado"],
  servicios: ["Experiencia", "Zona de servicio", "Disponibilidad"],
  empleo: ["Duración", "Horario", "Requisitos"],
  traspasos: ["m²", "Alquiler", "Facturación anual", "Licencia"],
  directorio: ["Fecha", "Horario", "Web"],
};
const DEFAULT_MODE: Record<string, string> = { motor: "venta", inmobiliaria: "venta", productos: "venta", alquiler: "alquiler", servicios: "servicio", empleo: "empleo", traspasos: "traspaso", directorio: "evento" };

export default function PublishForm({ verticals, modes, action, paidVerticals, paidPrice, featurePrice, isFree }: {
  verticals: V; modes: Record<string, string>; action: (f: FormData) => void; paidVerticals: string[]; paidPrice: number; featurePrice: number; isFree: boolean;
}) {
  const [v, setV] = useState("productos");
  const [mode, setMode] = useState("venta");
  const inp = "border rounded w-full px-3 py-2";
  return (
    <form action={action} className="bg-white rounded-xl border p-6 space-y-4">
      <div>
        <p className="font-semibold mb-2">1. ¿Qué publicas?</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(verticals).map(([k, x]) => (
            <button type="button" key={k} onClick={() => { setV(k); setMode(DEFAULT_MODE[k]); }} className={`p-3 rounded border text-sm ${v === k ? "border-emerald-600 bg-emerald-50" : ""}`}>
              <span className="text-2xl block">{x.emoji}</span>{x.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="vertical" value={v} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Categoría<select name="category" className={inp} key={v}>{verticals[v].cats.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-sm">Modalidad<select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={inp}>{Object.entries(modes).map(([k, m]) => <option key={k} value={k}>{m}</option>)}</select></label>
      </div>
      <label className="text-sm block">Título<input name="title" required maxLength={100} className={inp} /></label>
      <label className="text-sm block">Descripción<textarea name="description" required rows={4} className={inp} /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm">Precio (€)<input name="price" type="number" step="0.01" min="0" required className={inp} /></label>
        <label className="text-sm">Por<select name="priceUnit" defaultValue={mode === "alquiler" ? "dia" : "total"} key={mode} className={inp}>
          <option value="total">Precio total</option><option value="dia">Día</option><option value="hora">Hora</option><option value="mes">Mes</option></select></label>
        <label className="text-sm">Icono<input name="emoji" maxLength={4} placeholder={verticals[v].emoji} className={inp} /></label>
      </div>
      <label className="text-sm block">Ciudad<input name="city" className={inp} placeholder="Ej: Madrid" /></label>
      <div>
        <p className="font-semibold mb-2 text-sm">Detalles de {verticals[v].label}</p>
        <div className="grid sm:grid-cols-2 gap-3" key={v}>
          {META[v].map((m) => <label key={m} className="text-sm">{m}<input name={`meta_${m}`} className={inp} /></label>)}
        </div>
      </div>
      <label className="flex items-center gap-2 bg-amber-50 p-3 rounded text-sm"><input type="checkbox" name="feature" /> ⭐ Destacar en portada 7 días por {featurePrice.toFixed(2).replace(".", ",")} €</label>
      {isFree && paidVerticals.includes(v) && <p className="text-xs bg-sky-50 p-3 rounded">ℹ️ Los anuncios de {verticals[v].label} tienen un coste de publicación de {paidPrice.toFixed(2).replace(".", ",")} € para cuentas gratuitas (incluido gratis en PRO y Empresa).</p>}
      <button className="w-full bg-emerald-600 text-white font-bold py-3 rounded">Publicar anuncio</button>
    </form>
  );
}
