import { pgTable, serial, text, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  plan: text("plan").notNull().default("free"), // free | pro | business
  isAdmin: boolean("is_admin").notNull().default(false),
  city: text("city").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  priceUnit: text("price_unit").notNull().default("total"), // total | dia | hora | mes
  mode: text("mode").notNull(), // venta | alquiler | servicio | empleo | traspaso | intercambio | evento
  vertical: text("vertical").notNull(),
  category: text("category").notNull(),
  city: text("city").notNull(),
  emoji: text("emoji").notNull().default("📦"),
  meta: jsonb("meta").$type<Record<string, string>>().notNull().default({}),
  featuredUntil: timestamp("featured_until"),
  status: text("status").notNull().default("activo"), // activo | vendido | pausado
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // venta | alquiler | destacado | suscripcion | anuncio_pago | publicidad
  listingId: integer("listing_id"),
  buyerId: integer("buyer_id"),
  sellerId: integer("seller_id"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  platformFee: numeric("platform_fee", { precision: 12, scale: 2 }).notNull(),
  sellerNet: numeric("seller_net", { precision: 12, scale: 2 }).notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  brand: text("brand").notNull(),
  text: text("text").notNull(),
  url: text("url").notNull(),
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
