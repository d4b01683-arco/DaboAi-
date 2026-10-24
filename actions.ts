"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, listings, transactions, messages, ads, settings } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  ensureDb, hash, sign, currentUser, PLANS, VERTICALS, FEATURE_PRICE,
  PAID_LISTING_VERTICALS, PAID_LISTING_PRICE, commissionFor, isLaunch,
} from "./core";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function login(id: number) {
  (await cookies()).set("sid", `${id}.${sign(String(id))}`, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function registerAction(f: FormData) {
  await ensureDb();
  const email = s(f, "email").toLowerCase();
  if (!email || s(f, "password").length < 4) redirect("/cuenta?err=Datos+incompletos");
  const ex = await db.select().from(users).where(eq(users.email, email));
  if (ex.length) redirect("/cuenta?err=Email+ya+registrado");
  const [u] = await db.insert(users).values({ name: s(f, "name") || email, email, passwordHash: hash(s(f, "password")), city: s(f, "city") }).returning();
  await login(u.id);
  redirect("/cuenta");
}

export async function loginAction(f: FormData) {
  await ensureDb();
  const [u] = await db.select().from(users).where(eq(users.email, s(f, "email").toLowerCase()));
  if (!u || u.passwordHash !== hash(s(f, "password"))) redirect("/cuenta?err=Credenciales+incorrectas");
  await login(u.id);
  redirect("/cuenta");
}

export async function logoutAction() {
  (await cookies()).delete("sid");
  redirect("/");
}

export async function createListingAction(f: FormData) {
  const u = await currentUser();
  if (!u) redirect("/cuenta");
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(listings)
    .where(and(eq(listings.userId, u.id), eq(listings.status, "activo")));
  if (c >= PLANS[u.plan].maxListings) redirect("/planes?limit=1");
  const vertical = s(f, "vertical");
  if (!VERTICALS[vertical]) redirect("/publicar");
  const meta: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("meta_") && String(v).trim()) meta[k.slice(5)] = String(v).trim();
  const [l] = await db.insert(listings).values({
    userId: u.id, title: s(f, "title"), description: s(f, "description"),
    price: String(Number(s(f, "price")) || 0), priceUnit: s(f, "priceUnit") || "total",
    mode: s(f, "mode"), vertical, category: s(f, "category"), city: s(f, "city") || u.city || "España",
    emoji: s(f, "emoji") || VERTICALS[vertical].emoji, meta,
  }).returning();
  // Inmobiliaria / motor / traspasos: pago por anuncio para usuarios gratuitos
  if (PAID_LISTING_VERTICALS.includes(vertical) && u.plan === "free" && !(await isLaunch())) {
    await db.insert(transactions).values({ kind: "anuncio_pago", listingId: l.id, buyerId: u.id, amount: String(PAID_LISTING_PRICE), platformFee: String(PAID_LISTING_PRICE), sellerNet: "0", note: `Publicación en ${VERTICALS[vertical].label}` });
  }
  if (f.get("feature") === "on") await featureListing(l.id, u.id);
  revalidatePath("/");
  redirect(`/anuncio/${l.id}?ok=publicado`);
}

async function featureListing(listingId: number, userId: number) {
  const launch = await isLaunch();
  await db.update(listings).set({ featuredUntil: sql`now() + interval '7 days'` }).where(eq(listings.id, listingId));
  await db.insert(transactions).values({ kind: "destacado", listingId, buyerId: userId, amount: launch ? "0" : String(FEATURE_PRICE), platformFee: launch ? "0" : String(FEATURE_PRICE), sellerNet: "0", note: launch ? "Destacado gratis (lanzamiento)" : "Destacado 7 días" });
}

export async function featureAction(f: FormData) {
  const u = await currentUser();
  if (!u) redirect("/cuenta");
  const id = Number(s(f, "id"));
  await featureListing(id, u.id);
  revalidatePath("/");
  redirect(`/anuncio/${id}?ok=destacado`);
}

export async function buyAction(f: FormData) {
  const u = await currentUser();
  if (!u) redirect("/cuenta?err=Inicia+sesión+para+comprar");
  const id = Number(s(f, "id"));
  const qty = Math.max(1, Number(s(f, "qty")) || 1);
  const [l] = await db.select().from(listings).where(eq(listings.id, id));
  if (!l || l.userId === u.id) redirect(`/anuncio/${id}`);
  const [seller] = await db.select().from(users).where(eq(users.id, l.userId));
  const amount = Number(l.price) * qty;
  const pct = await commissionFor(seller.plan);
  const fee = Math.round(amount * pct) / 100;
  await db.insert(transactions).values({
    kind: l.mode === "alquiler" ? "alquiler" : "venta", listingId: id, buyerId: u.id, sellerId: l.userId,
    amount: amount.toFixed(2), platformFee: fee.toFixed(2), sellerNet: (amount - fee).toFixed(2),
    note: l.mode === "alquiler" ? `${qty} ${l.priceUnit}(s)` : "Compra",
  });
  if (l.mode === "venta" && l.priceUnit === "total") await db.update(listings).set({ status: "vendido" }).where(eq(listings.id, id));
  revalidatePath("/");
  redirect(`/anuncio/${id}?ok=pagado`);
}

export async function messageAction(f: FormData) {
  const u = await currentUser();
  if (!u) redirect("/cuenta");
  const id = Number(s(f, "id"));
  const [l] = await db.select().from(listings).where(eq(listings.id, id));
  const to = Number(s(f, "to")) || l.userId;
  if (s(f, "body")) await db.insert(messages).values({ listingId: id, fromUserId: u.id, toUserId: to, body: s(f, "body") });
  redirect(s(f, "back") || `/anuncio/${id}?ok=mensaje`);
}

export async function subscribeAction(f: FormData) {
  const u = await currentUser();
  if (!u) redirect("/cuenta?err=Crea+una+cuenta+primero");
  const plan = s(f, "plan");
  if (!PLANS[plan]) redirect("/planes");
  await db.update(users).set({ plan }).where(eq(users.id, u.id));
  if (PLANS[plan].price > 0 && !(await isLaunch()))
    await db.insert(transactions).values({ kind: "suscripcion", buyerId: u.id, amount: String(PLANS[plan].price), platformFee: String(PLANS[plan].price), sellerNet: "0", note: `Plan ${PLANS[plan].label}` });
  redirect("/cuenta?ok=plan");
}

export async function setStatusAction(f: FormData) {
  const u = await currentUser();
  if (!u) redirect("/cuenta");
  const id = Number(s(f, "id"));
  const cond = u.isAdmin ? eq(listings.id, id) : and(eq(listings.id, id), eq(listings.userId, u.id));
  if (s(f, "status") === "borrar") await db.delete(listings).where(cond);
  else await db.update(listings).set({ status: s(f, "status") }).where(cond);
  revalidatePath("/");
  redirect(s(f, "back") || "/cuenta");
}

async function requireAdmin() {
  const u = await currentUser();
  if (!u?.isAdmin) redirect("/cuenta");
  return u;
}

export async function adminSettingsAction(f: FormData) {
  await requireAdmin();
  await db.insert(settings).values({ key: "commission_override", value: s(f, "commission") })
    .onConflictDoUpdate({ target: settings.key, set: { value: s(f, "commission") } });
  redirect("/admin?ok=1");
}

export async function adminUserPlanAction(f: FormData) {
  await requireAdmin();
  await db.update(users).set({ plan: s(f, "plan") }).where(eq(users.id, Number(s(f, "id"))));
  redirect("/admin");
}

export async function adminAdAction(f: FormData) {
  await requireAdmin();
  const fee = Number(s(f, "fee")) || 0;
  await db.insert(ads).values({ brand: s(f, "brand"), text: s(f, "text"), url: s(f, "url") || "#", monthlyFee: String(fee) });
  await db.insert(transactions).values({ kind: "publicidad", amount: String(fee), platformFee: String(fee), sellerNet: "0", note: `Banner ${s(f, "brand")}` });
  redirect("/admin");
}

export async function adminToggleAdAction(f: FormData) {
  await requireAdmin();
  await db.update(ads).set({ active: sql`not active` }).where(eq(ads.id, Number(s(f, "id"))));
  redirect("/admin");
}

export async function adminLaunchAction(f: FormData) {
  await requireAdmin();
  const v = s(f, "on") === "1" ? "1" : "0";
  await db.insert(settings).values({ key: "launch_mode", value: v })
    .onConflictDoUpdate({ target: settings.key, set: { value: v } });
  revalidatePath("/");
  redirect("/admin");
}
