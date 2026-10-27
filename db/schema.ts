import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(), orderRef: text("order_ref").notNull(),
  nickname: text("nickname").notNull(), year: integer("year").notNull(),
  month: integer("month").notNull(), driveRef: text("drive_ref").notNull().default(""),
  dueAt: text("due_at"),
  specialistId: text("specialist_id"), audioReceived: integer("audio_received").notNull().default(0),
  deliveredAt: text("delivered_at"), createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [uniqueIndex("jobs_order_ref_unique").on(t.orderRef)]);

export const workItems = sqliteTable("work_items", {
  id: text("id").primaryKey(), jobId: text("job_id").notNull().references(() => jobs.id),
  type: text("type").notNull(), status: text("status").notNull().default("not_started"),
  revision: integer("revision").notNull().default(0), updatedAt: text("updated_at").notNull(),
  assetRef: text("asset_ref").notNull().default(""),
}, (t) => [uniqueIndex("work_items_job_type_unique").on(t.jobId, t.type)]);

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(), name: text("name").notNull(), role: text("role").notNull(),
  active: integer("active").notNull().default(1),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(), jobId: text("job_id").notNull().references(() => jobs.id),
  itemType: text("item_type"), action: text("action").notNull(),
  fromStatus: text("from_status"), toStatus: text("to_status"),
  actorId: text("actor_id").notNull(), actorName: text("actor_name").notNull(),
  note: text("note").notNull().default(""), channel: text("channel").notNull().default(""),
  createdAt: text("created_at").notNull(), requestKey: text("request_key").notNull(),
}, (t) => [uniqueIndex("events_request_key_unique").on(t.requestKey)]);
