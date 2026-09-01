import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(), institution: text('institution').notNull(), city: text('city'), copyNumber: text('copy_number'), inep: text('inep'), clientName: text('client_name'), phone: text('phone'), functionName: text('function_name').notNull(), version: text('version'), systemPath: text('system_path').notNull(), description: text('description').notNull(), schoolYear: text('school_year'), urgent: integer('urgent', { mode: 'boolean' }).notNull().default(false), betaStatus: text('beta_status').notNull().default('Não testado'), workaround: text('workaround'), status: text('status').notNull().default('Novo report'), authorId: text('author_id').notNull(), authorEmail: text('author_email').notNull(), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_reports_status_updated_at').on(table.status, table.updatedAt), index('idx_reports_version').on(table.version)]);

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(), reportId: text('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }), objectKey: text('object_key').notNull().unique(), fileName: text('file_name').notNull(), contentType: text('content_type').notNull(), byteSize: integer('byte_size').notNull(), kind: text('kind').notNull(), createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_attachments_report_id').on(table.reportId)]);

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(), reportId: text('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }), actorId: text('actor_id').notNull(), actorEmail: text('actor_email').notNull(), action: text('action').notNull(), message: text('message'), createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_activities_report_created_at').on(table.reportId, table.createdAt)]);

export const testRounds = sqliteTable('test_rounds', {
  id: text('id').primaryKey(), title: text('title').notNull(), version: text('version').notNull(), deadline: text('deadline').notNull(), description: text('description'), status: text('status').notNull().default('Em andamento'), authorId: text('author_id').notNull(), authorEmail: text('author_email').notNull(), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_test_rounds_status_updated_at').on(table.status, table.updatedAt)]);

export const testItems = sqliteTable('test_items', {
  id: text('id').primaryKey(), roundId: text('round_id').notNull().references(() => testRounds.id, { onDelete: 'cascade' }), position: integer('position').notNull(), title: text('title').notNull(), path: text('path'), description: text('description'), status: text('status').notNull().default('Pendente'), testerId: text('tester_id'), testerEmail: text('tester_email'), resultNote: text('result_note'), updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_test_items_round_position').on(table.roundId, table.position)]);
