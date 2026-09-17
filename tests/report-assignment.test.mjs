import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { assignmentColumns, claimCorrectionSql, responsibleEmail } from '../lib/report-assignment.ts';
import fs from 'node:fs';
import ts from 'typescript';

test('responsibility follows author, developer, retester and actual validator', () => {
  const row = { author_email: 'support@example.test', developer_email: 'dev@example.test', validator_email: 'manager@example.test' };
  assert.equal(responsibleEmail({ ...row, status: 'Novo report' }), row.author_email);
  assert.equal(responsibleEmail({ ...row, status: 'Com Desenvolvimento' }), row.developer_email);
  assert.equal(responsibleEmail({ ...row, status: 'Aguardando reteste' }), row.author_email);
  assert.equal(responsibleEmail({ ...row, status: 'Finalizado' }), row.validator_email);
  assert.equal(responsibleEmail({ status: 'Com Desenvolvimento', author_email: row.author_email }), '');
  assert.equal(responsibleEmail({ status: 'Finalizado', author_email: row.author_email }), '');
});

test('one successful claim, duplicate claim rejected, assignment survives retest', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE reports (id TEXT PRIMARY KEY,status TEXT,author_email TEXT); CREATE TABLE activities (id TEXT PRIMARY KEY,report_id TEXT,actor_id TEXT,actor_email TEXT,action TEXT,message TEXT,created_at INTEGER);');
    db.prepare('INSERT INTO reports VALUES (?,?,?)').run('bug', 'Com Desenvolvimento', 'support@example.test');
    const claim = db.prepare(claimCorrectionSql);
    assert.equal(claim.run('a1', 'dev1', 'dev1@example.test', 1, 'bug', 'Com Desenvolvimento').changes, 1);
    assert.equal(claim.run('a2', 'dev2', 'dev2@example.test', 2, 'bug', 'Com Desenvolvimento').changes, 0);
    const read = () => db.prepare(`SELECT r.*, ${assignmentColumns} FROM reports r WHERE r.id=?`).get('bug');
    assert.equal(responsibleEmail(read()), 'dev1@example.test');
    db.prepare('UPDATE reports SET status=?').run('Aguardando reteste');
    assert.equal(responsibleEmail(read()), 'support@example.test');
    db.prepare('UPDATE reports SET status=?').run('Com Desenvolvimento');
    assert.equal(responsibleEmail(read()), 'dev1@example.test');
    db.prepare('INSERT INTO activities VALUES (?,?,?,?,?,?,?)').run('v1', 'bug', 'support', 'support@example.test', 'report_validated', 'Validated', 3);
    db.prepare('UPDATE reports SET status=?').run('Finalizado');
    assert.equal(responsibleEmail(read()), 'support@example.test');
    db.prepare('INSERT INTO reports VALUES (?,?,?)').run('stale', 'Finalizado', 'support@example.test');
    assert.equal(claim.run('a3', 'dev1', 'dev1@example.test', 4, 'stale', 'Com Desenvolvimento').changes, 0);
  } finally { db.close(); }
});

test('API enforces DEV ownership and returns retest to author', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE reports (id TEXT PRIMARY KEY,status TEXT,author_id TEXT,author_email TEXT,updated_at INTEGER);
    CREATE TABLE activities (id TEXT PRIMARY KEY,report_id TEXT,actor_id TEXT,actor_email TEXT,action TEXT,message TEXT,created_at INTEGER);
    CREATE TABLE attachments (id TEXT,report_id TEXT,file_name TEXT,content_type TEXT,byte_size INTEGER,kind TEXT,created_at INTEGER);
    CREATE TABLE report_shares (report_id TEXT,user_email TEXT,permission TEXT,created_at INTEGER);
    CREATE TABLE team_members (email TEXT,name TEXT);`);
  db.prepare('INSERT INTO reports VALUES (?,?,?,?,?)').run('bug', 'Com Desenvolvimento', 'support', 'support@example.test', 0);
  db.prepare('INSERT INTO team_members VALUES (?,?)').run('dev1@example.test', 'Developer One');
  let user = { userId: 'support', email: 'support@example.test' };
  let role = 'support';
  function statement(sql) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; },
    };
  }
  const binding = { prepare: statement, async batch(statements) { const results = []; for (const s of statements) results.push(await s.run()); return results; } };
  const source = fs.readFileSync(new URL('../app/api/reports/[id]/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const imports = {
    'cloudflare:workers': { env: { DB: binding } },
    '@/app/chatgpt-auth': { getChatGPTUser: async () => user },
    '@/lib/db-init': { ensureDatabase: async () => {} },
    '@/lib/report-access': { getTeamRole: async () => role },
    '@/lib/report-assignment': { assignmentColumns, claimCorrectionSql, responsibleEmail },
  };
  new Function('require', 'module', 'exports', compiled)((id) => { if (!(id in imports)) throw Error(id); return imports[id]; }, mod, mod.exports);
  const params = { params: Promise.resolve({ id: 'bug' }) };
  const post = (values) => { const data = new FormData(); for (const [k,v] of Object.entries(values)) data.set(k,v); return mod.exports.POST(new Request('http://test/api/reports/bug', { method: 'POST', body: data }), params); };
  try {
    assert.equal((await post({ action: 'claim' })).status, 403);
    role = 'developer'; user = { userId: 'dev1', email: 'dev1@example.test' };
    assert.equal((await post({ status: 'Aguardando reteste' })).status, 403);
    assert.equal((await post({ action: 'claim' })).status, 200);
    let detail = await (await mod.exports.GET(new Request('http://test'), params)).json();
    assert.equal(detail.report.responsible_name, 'Developer One');
    user = { userId: 'dev2', email: 'dev2@example.test' };
    assert.equal((await post({ action: 'claim' })).status, 409);
    assert.equal((await post({ status: 'Aguardando reteste' })).status, 403);
    user = { userId: 'dev1', email: 'dev1@example.test' };
    assert.equal((await post({ status: 'Aguardando reteste' })).status, 200);
    role = 'support'; user = { userId: 'support', email: 'support@example.test' };
    detail = await (await mod.exports.GET(new Request('http://test'), params)).json();
    assert.equal(detail.report.responsible_email, user.email);
    assert.equal((await post({ status: 'Finalizado' })).status, 200);
    detail = await (await mod.exports.GET(new Request('http://test'), params)).json();
    assert.equal(detail.report.validator_email, user.email);
    assert.equal(detail.activities.filter((a) => a.action === 'correction_claimed').length, 1);
    assert.equal(detail.activities.filter((a) => a.action === 'retest_assigned').length, 1);
  } finally { db.close(); }
});
