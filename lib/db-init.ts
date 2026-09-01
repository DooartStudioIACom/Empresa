import { env } from 'cloudflare:workers';

let initialized = false;
export async function ensureDatabase() {
  if (initialized) return;
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, institution TEXT NOT NULL, city TEXT, copy_number TEXT, inep TEXT, client_name TEXT, phone TEXT, function_name TEXT NOT NULL, version TEXT, system_path TEXT NOT NULL, description TEXT NOT NULL, school_year TEXT, urgent INTEGER NOT NULL DEFAULT 0, beta_status TEXT NOT NULL DEFAULT 'Não testado', workaround TEXT, status TEXT NOT NULL DEFAULT 'Novo report', author_id TEXT NOT NULL, author_email TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE, actor_id TEXT NOT NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL, message TEXT, created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS test_rounds (id TEXT PRIMARY KEY, title TEXT NOT NULL, version TEXT NOT NULL, deadline TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'Em andamento', author_id TEXT NOT NULL, author_email TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS test_items (id TEXT PRIMARY KEY, round_id TEXT NOT NULL REFERENCES test_rounds(id) ON DELETE CASCADE, position INTEGER NOT NULL, title TEXT NOT NULL, path TEXT, description TEXT, status TEXT NOT NULL DEFAULT 'Pendente', tester_id TEXT, tester_email TEXT, result_note TEXT, updated_at INTEGER NOT NULL)`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reports_status_updated_at ON reports(status, updated_at)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_reports_version ON reports(version)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_attachments_report_id ON attachments(report_id)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_activities_report_created_at ON activities(report_id, created_at)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_test_rounds_status_updated_at ON test_rounds(status, updated_at)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_test_items_round_position ON test_items(round_id, position)'),
  ]);
  await db.prepare('PRAGMA optimize').run();
  initialized = true;
}
