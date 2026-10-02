// ChazMaster schema — Pokemon TCG collection + sale requests
import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
} from "drizzle-orm/pg-core";

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  cardName: text("card_name").notNull(),
  setName: text("set_name").default(""),
  cardNumber: text("card_number").default(""),
  rarity: text("rarity").default(""),
  price: real("price").default(0),
  quantity: integer("quantity").default(1),
  buyPct: real("buy_pct").default(0),
  buyPrice: real("buy_price").default(0),
  variant: text("variant").default("Normal"),
  condition: text("condition").default("NM"),
  tcg: text("tcg").default("pokemon"),
  tcgplayerId: text("tcgplayer_id").default(""),
  productId: text("product_id").default(""),
  imageUrl: text("image_url").default(""),
  sourceFile: text("source_file").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const saleRequests = pgTable("sale_requests", {
  id: serial("id").primaryKey(),
  requesterName: text("requester_name").notNull(),
  requesterContact: text("requester_contact").notNull().default(""),
  message: text("message").default(""),
  status: text("status").default("pending").notNull(), // pending | accepted | rejected | completed
  channel: text("channel").default("in-app"), // in-app | email | whatsapp
  totalValue: real("total_value").default(0),
  itemCount: integer("item_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey(),
  adminEmail: text("admin_email").default(""),
  adminWhatsapp: text("admin_whatsapp").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const requestItems = pgTable("request_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  cardId: integer("card_id").notNull(),
  cardName: text("card_name").notNull().default(""),
  setName: text("set_name").default(""),
  cardNumber: text("card_number").default(""),
  rarity: text("rarity").default(""),
  condition: text("condition").default(""),
  variant: text("variant").default(""),
  quantity: integer("quantity").default(1),
  priceEach: real("price_each").default(0),
});

export const uploadBatches = pgTable("upload_batches", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull().default(""),
  rowCount: integer("row_count").default(0),
  newCards: integer("new_cards").default(0),
  mergedCards: integer("merged_cards").default(0),
  totalValue: real("total_value").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type SaleRequest = typeof saleRequests.$inferSelect;
export type RequestItem = typeof requestItems.$inferSelect;
