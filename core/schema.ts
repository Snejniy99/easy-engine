import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  boolean,
  unique,
  bigint,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pluginSettings = pgTable(
  "plugin_settings",
  {
    id: serial("id").primaryKey(),
    pluginId: varchar("plugin_id", { length: 128 }).notNull(),
    key: varchar("key", { length: 128 }).notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [unique().on(t.pluginId, t.key)]
);

export const pluginRegistry = pgTable("plugin_registry", {
  pluginId: varchar("plugin_id", { length: 128 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
});

export const pluginStoredFiles = pgTable("plugin_stored_files", {
  id: serial("id").primaryKey(),
  publicId: varchar("public_id", { length: 36 }).notNull().unique(),
  pluginId: varchar("plugin_id", { length: 128 }).notNull(),
  storageKey: varchar("storage_key", { length: 512 }).notNull(),
  originalName: varchar("original_name", { length: 512 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});