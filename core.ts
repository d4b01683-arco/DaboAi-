import { cookies } from "next/headers";
import crypto from "crypto";
import { db, pool } from "@/db";
import { users, settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const VERTICALS: Record<string, { label: string; emoji: string; cats: string[] }> = {
  motor: { label: "Motor", emoji: "🚗", cats: ["Coches", "Motos", "Patinetes eléctricos", "Bicicletas", "Furgonetas", "Recambios"] },
  inmobiliaria: { label: "Inmobiliaria", emoji: "🏠", cats: ["Pisos", "Casas", "Habitaciones", "Locales", "Trasteros y garajes", "Terrenos"] },
  productos: { label: "Productos", emoji: "🛍️", cats: ["Ropa y calzado", "Deporte", "Patines", "Tecnología", "Hogar", "Comida casera", "Coleccionismo", "Juguetes"] },
  alquiler: { label: "Alquiler de equipos", emoji: "📷", cats: ["Cámaras y fotografía", "Drones", "Iluminación y sonido", "Herramientas", "Material de eventos", "Camping"] },
  servicios: { label: "Servicios", emoji: "🛠️", cats: ["Mecánicos a domicilio", "Entrenadores personales", "Diseño web", "Clases y tutores", "Reformas", "Limpieza"] },
  empleo: { label: "Empleo y tareas", emoji: "💼", cats: ["Trabajos puntuales", "Media jornada", "Jornada completa", "Freelance"] },
  traspasos: { label: "Traspasos", emoji: "🏪", cats: ["Bares y restaurantes", "Tiendas", "Licencias de actividad", "Negocios online"] },
  directorio: { label: "Empresas y eventos", emoji: "📍", cats: ["Empresas locales", "Eventos", "Ofertas", "Ocio y cultura"] },
};

export const MODES: Record<string, string> = {
  venta: "Venta", alquiler: "Alquiler", servicio: "Servicio", empleo: "Empleo",
  traspaso: "Traspaso", intercambio: "Intercambio", evento: "Evento",
};

export const PLANS: Record<string, { label: string; price: number; maxListings: number; commission: number; perks: string[] }> = {
  free: { label: "Particular", price: 0, maxListings: 3, commission: 10, perks: ["3 anuncios activos", "Chat con compradores", "Comisión 10% en ventas online"] },
  pro: { label: "PRO", price: 9.99, maxListings: 50, commission: 7, perks: ["50 anuncios activos", "Insignia verificado", "Estadísticas de visitas", "Comisión reducida 7%", "1 destacado gratis/mes"] },
  business: { label: "Empresa", price: 19.99, maxListings: 100000, commission: 5, perks: ["Anuncios ilimitados", "Perfil de empresa", "Comisión mínima 5%", "Prioridad en búsquedas", "Soporte prioritario"] },
};

export const FEATURE_PRICE = 3.99; // 7 días
export const PAID_LISTING_VERTICALS = ["motor", "inmobiliaria", "traspasos"]; // pagan por anuncio (no pasan por pago online)
export const PAID_LISTING_PRICE = 2.99;

export function hash(pw: string) {
  return crypto.createHash("sha256").update("mkt::" + pw).digest("hex");
}

let ready: Promise<void> | null = null;
export function ensureDb() {
  if (!ready) ready = init().catch((e) => { ready = null; throw e; });
  return ready;
}

async function init() {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS users (id serial primary key, name text not null, email text not null unique, password_hash text not null, plan text not null default 'free', is_admin boolean not null default false, city text not null default '', created_at timestamp not null default now());
  CREATE TABLE IF NOT EXISTS listings (id serial primary key, user_id integer not null, title text not null, description text not null, price numeric(12,2) not null, price_unit text not null default 'total', mode text not null, vertical text not null, category text not null, city text not null, emoji text not null default '📦', meta jsonb not null default '{}', featured_until timestamp, status text not null default 'activo', views integer not null default 0, created_at timestamp not null default now());
  CREATE TABLE IF NOT EXISTS transactions (id serial primary key, kind text not null, listing_id integer, buyer_id integer, seller_id integer, amount numeric(12,2) not null, platform_fee numeric(12,2) not null, seller_net numeric(12,2) not null, note text not null default '', created_at timestamp not null default now());
  CREATE TABLE IF NOT EXISTS messages (id serial primary key, listing_id integer not null, from_user_id integer not null, to_user_id integer not null, body text not null, created_at timestamp not null default now());
  CREATE TABLE IF NOT EXISTS ads (id serial primary key, brand text not null, text text not null, url text not null, monthly_fee numeric(10,2) not null, active boolean not null default true);
  CREATE TABLE IF NOT EXISTS settings (key text primary key, value text not null);
  `);
  await pool.query("INSERT INTO settings (key,value) VALUES ('launch_mode','1') ON CONFLICT DO NOTHING");
  const { rows } = await pool.query("SELECT count(*)::int AS c FROM users");
  if (rows[0].c > 0) return;
  const h = hash("admin123");
  await pool.query(`INSERT INTO users (name,email,password_hash,plan,is_admin,city) VALUES
   ('Administrador','admin@todomarket.es',$1,'business',true,'Madrid'),
   ('Laura Gómez','laura@demo.es',$2,'pro',false,'Valencia'),
   ('Taller Rápido SL','taller@demo.es',$2,'business',false,'Sevilla'),
   ('Carlos Ruiz','carlos@demo.es',$2,'free',false,'Barcelona')`, [h, hash("demo123")]);
  const L: [number, string, string, number, string, string, string, string, string, string, object, boolean][] = [
    [2, "Botas de fútbol Nike Phantom T42", "Usadas una temporada, tacos en perfecto estado.", 45, "total", "venta", "productos", "Deporte", "Valencia", "⚽", { Estado: "Buen estado", Talla: "42", Marca: "Nike" }, true],
    [4, "Seat León 1.5 TSI FR 2019", "Único dueño, libro de revisiones al día, ITV pasada.", 16900, "total", "venta", "motor", "Coches", "Barcelona", "🚗", { Kilometraje: "68.000 km", Año: "2019", Combustible: "Gasolina" }, true],
    [2, "Piso 3 hab. con terraza en Ruzafa", "Reformado, ascensor, muy luminoso.", 950, "mes", "alquiler", "inmobiliaria", "Pisos", "Valencia", "🏢", { "m²": "95", Habitaciones: "3", Planta: "4ª con ascensor" }, false],
    [4, "Sony A7 III + objetivo 28-70", "Alquiler por días. Fianza 300€.", 35, "dia", "alquiler", "alquiler", "Cámaras y fotografía", "Barcelona", "📷", { Fianza: "300€" }, true],
    [2, "Dron DJI Mini 3 Pro", "Con 3 baterías y maleta.", 25, "dia", "alquiler", "alquiler", "Drones", "Valencia", "🚁", { Fianza: "200€" }, false],
    [3, "Mecánico a domicilio - cambio de aceite", "Vamos a tu casa o trabajo. Presupuesto sin compromiso.", 40, "hora", "servicio", "servicios", "Mecánicos a domicilio", "Sevilla", "🔧", { Experiencia: "15 años" }, true],
    [3, "Traspaso bar de tapas zona centro", "Licencia en regla, clientela fija, 60 m².", 35000, "total", "traspaso", "traspasos", "Bares y restaurantes", "Sevilla", "🍻", { "m²": "60", Alquiler: "1.100€/mes" }, false],
    [4, "Trastero 8 m² en garaje", "Acceso 24h, seco y seguro.", 45, "mes", "alquiler", "inmobiliaria", "Trasteros y garajes", "Barcelona", "📦", { "m²": "8", Acceso: "24h" }, false],
    [2, "Patines en línea Rollerblade T39", "Casi nuevos.", 60, "total", "venta", "productos", "Patines", "Valencia", "🛼", { Estado: "Como nuevo", Talla: "39" }, false],
    [4, "Honda CB500F 2021", "A2, 12.000 km, perfecta.", 5200, "total", "venta", "motor", "Motos", "Barcelona", "🏍️", { Kilometraje: "12.000 km", Año: "2021", Combustible: "Gasolina" }, false],
    [2, "Tartas caseras por encargo", "Tarta de queso, chocolate y zanahoria. Recogida en local.", 22, "total", "venta", "productos", "Comida casera", "Valencia", "🍰", { Alérgenos: "Gluten, lácteos" }, false],
    [3, "Camarero/a para boda sábado", "5 horas, 15€/h, experiencia valorable.", 75, "total", "empleo", "empleo", "Trabajos puntuales", "Sevilla", "🤵", { Duración: "5 horas" }, false],
    [3, "Feria de artesanía de primavera", "Entrada libre, más de 40 puestos.", 0, "total", "evento", "directorio", "Eventos", "Sevilla", "🎪", { Fecha: "Sábado y domingo" }, false],
    [4, "Clases de inglés online y presencial", "Profesora nativa, todos los niveles.", 18, "hora", "servicio", "servicios", "Clases y tutores", "Barcelona", "📚", { Modalidad: "Online / presencial" }, false],
  ];
  for (const l of L) {
    await pool.query(
      `INSERT INTO listings (user_id,title,description,price,price_unit,mode,vertical,category,city,emoji,meta,featured_until,views) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,${l[11] ? "now() + interval '7 days'" : "NULL"},$12)`,
      [l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], l[8], l[9], JSON.stringify(l[10]), Math.floor(Math.random() * 300)]
    );
  }
  await pool.query(`INSERT INTO ads (brand,text,url,monthly_fee) VALUES ('Deportes Martín','-20% en botas de fútbol esta semana','#',49),('Seguros Ya','Seguro de coche desde 15€/mes','#',79)`);
  await pool.query(`INSERT INTO transactions (kind,listing_id,buyer_id,seller_id,amount,platform_fee,seller_net,note) VALUES
   ('venta',1,4,2,45,3.15,41.85,'Venta botas'),('alquiler',4,2,4,105,10.5,94.5,'3 días cámara'),
   ('suscripcion',NULL,2,NULL,9.99,9.99,0,'Plan PRO'),('suscripcion',NULL,3,NULL,19.99,19.99,0,'Plan Empresa'),
   ('destacado',2,4,NULL,3.99,3.99,0,'Destacado 7 días'),('publicidad',NULL,NULL,NULL,49,49,0,'Banner Deportes Martín')`);
  await pool.query(`INSERT INTO settings (key,value) VALUES ('commission_override',''),('launch_mode','1') ON CONFLICT DO NOTHING`);
}

export async function currentUser() {
  await ensureDb();
  const c = (await cookies()).get("sid")?.value;
  if (!c) return null;
  const [id, sig] = c.split(".");
  if (sig !== sign(id)) return null;
  const [u] = await db.select().from(users).where(eq(users.id, Number(id)));
  return u ?? null;
}

export function sign(v: string) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET || "todomarket-secret").update(v).digest("hex").slice(0, 32);
}

export async function isLaunch() {
  await ensureDb();
  const [s] = await db.select().from(settings).where(eq(settings.key, "launch_mode"));
  return s?.value === "1";
}

export async function commissionFor(plan: string) {
  if (await isLaunch()) return 0;
  const [s] = await db.select().from(settings).where(eq(settings.key, "commission_override"));
  if (s && s.value !== "" && !isNaN(Number(s.value))) return Number(s.value);
  return PLANS[plan]?.commission ?? 10;
}

export const eur = (n: number | string) =>
  Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
export const unit = (u: string) => ({ dia: "/día", hora: "/hora", mes: "/mes" } as Record<string, string>)[u] ?? "";
