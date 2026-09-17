import { env } from 'cloudflare:workers';

let initialized = false;
export async function ensureDatabase() {
  if (initialized) return;
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, institution TEXT NOT NULL, city TEXT, copy_number TEXT, inep TEXT, client_name TEXT, phone TEXT, function_name TEXT NOT NULL, version TEXT, system_path TEXT NOT NULL, description TEXT NOT NULL, school_year TEXT, urgent INTEGER NOT NULL DEFAULT 0, beta_status TEXT NOT NULL DEFAULT 'Não testado', workaround TEXT, github_issue_url TEXT, from_test_round INTEGER NOT NULL DEFAULT 0, test_round_id TEXT, test_round_title TEXT, test_round_version TEXT, test_item_id TEXT, test_item_title TEXT, status TEXT NOT NULL DEFAULT 'Novo report', author_id TEXT NOT NULL, author_email TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, kind TEXT NOT NULL, github_share_token TEXT UNIQUE, created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE, actor_id TEXT NOT NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL, message TEXT, created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS report_shares (report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE, user_email TEXT NOT NULL, permission TEXT NOT NULL DEFAULT 'edit', shared_by_id TEXT NOT NULL, shared_by_email TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (report_id, user_email))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS team_members (email TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'support' CHECK(role IN ('support','manager','developer')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS test_rounds (id TEXT PRIMARY KEY, title TEXT NOT NULL, version TEXT NOT NULL, deadline TEXT NOT NULL, description TEXT, tags TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'Em andamento', author_id TEXT NOT NULL, author_email TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS test_items (id TEXT PRIMARY KEY, round_id TEXT NOT NULL REFERENCES test_rounds(id) ON DELETE CASCADE, position INTEGER NOT NULL, title TEXT NOT NULL, path TEXT, description TEXT, status TEXT NOT NULL DEFAULT 'Pendente', tester_id TEXT, tester_email TEXT, result_note TEXT, updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS test_item_attachments (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES test_items(id) ON DELETE CASCADE, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS round_participants (round_id TEXT NOT NULL REFERENCES test_rounds(id) ON DELETE CASCADE, user_id TEXT NOT NULL, user_email TEXT NOT NULL, user_name TEXT NOT NULL, joined_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER, PRIMARY KEY (round_id, user_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS test_item_responses (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES test_items(id) ON DELETE CASCADE, round_id TEXT NOT NULL REFERENCES test_rounds(id) ON DELETE CASCADE, tester_id TEXT NOT NULL, tester_email TEXT NOT NULL, tester_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pendente', result_note TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (item_id, tester_id))`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reports_status_updated_at ON reports(status, updated_at)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_reports_version ON reports(version)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_attachments_report_id ON attachments(report_id)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_activities_report_created_at ON activities(report_id, created_at)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_report_shares_email ON report_shares(user_email, report_id)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role, email)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_test_rounds_status_updated_at ON test_rounds(status, updated_at)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_test_items_round_position ON test_items(round_id, position)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_test_item_attachments_item ON test_item_attachments(item_id)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_round_participants_round ON round_participants(round_id, updated_at)'), db.prepare('CREATE INDEX IF NOT EXISTS idx_test_responses_round_tester ON test_item_responses(round_id, tester_id, status)'),
  ]);
  await ensureColumn(db, 'reports', 'from_test_round', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'reports', 'test_round_id', 'TEXT');
  await ensureColumn(db, 'reports', 'test_round_title', 'TEXT');
  await ensureColumn(db, 'reports', 'test_round_version', 'TEXT');
  await ensureColumn(db, 'reports', 'test_item_id', 'TEXT');
  await ensureColumn(db, 'reports', 'test_item_title', 'TEXT');
  await ensureColumn(db, 'test_rounds', 'tags', "TEXT NOT NULL DEFAULT '[]'");
  await db.prepare(`INSERT OR IGNORE INTO test_item_responses (id,item_id,round_id,tester_id,tester_email,tester_name,status,result_note,created_at,updated_at) SELECT lower(hex(randomblob(16))),id,round_id,tester_id,tester_email,substr(tester_email,1,instr(tester_email,'@')-1),status,result_note,updated_at,updated_at FROM test_items WHERE tester_id IS NOT NULL AND status <> 'Pendente'`).run();
  await db.prepare(`INSERT OR IGNORE INTO round_participants (round_id,user_id,user_email,user_name,joined_at,updated_at,completed_at) SELECT round_id,tester_id,tester_email,substr(tester_email,1,instr(tester_email,'@')-1),MIN(updated_at),MAX(updated_at),NULL FROM test_items WHERE tester_id IS NOT NULL GROUP BY round_id,tester_id,tester_email`).run();
  await db.prepare('PRAGMA optimize').run();
  initialized = true;
}

async function ensureColumn(db: typeof env.DB, table: string, column: string, definition: string) {
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (!columns.results.some((entry) => entry.name === column)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}
