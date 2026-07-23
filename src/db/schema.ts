import {
  uuid, varchar, text, integer, boolean, timestamp, jsonb, pgSchema, customType
} from "drizzle-orm/pg-core";

export const docmindSchema = pgSchema("docmind");
export const pgTable = docmindSchema.table;

export const documentStatus = docmindSchema.enum("document_status", ["PROCESSING", "READY", "ERROR"]);
export const extractionFieldType = docmindSchema.enum("extraction_field_type", ["text", "date", "number", "boolean", "email", "phone"]);

export const organizations = pgTable("docmind_organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("docmind_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: varchar("file_path", { length: 1000 }).notNull(),
  pageCount: integer("page_count").default(0),
  textContent: text("text_content"),
  status: documentStatus("status").default("PROCESSING").notNull(),
  summary: text("summary"),
  metadata: jsonb("metadata"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => documents.id).notNull(),
  content: text("content").notNull(),
  embedding: customType<{ data: number[] }>({
    dataType() {
      return "vector(1536)";
    },
  })("embedding"),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extractions = pgTable("extractions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => documents.id).notNull(),
  fieldLabel: varchar("field_label", { length: 255 }).notNull(),
  fieldType: extractionFieldType("field_type").default("text").notNull(),
  fieldValue: text("field_value").notNull(),
  confidence: integer("confidence").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => documents.id),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("docmind_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("admin").notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  active: boolean("active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
