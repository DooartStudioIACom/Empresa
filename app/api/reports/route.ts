import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';
import { getTeamRole } from '@/lib/report-access';
import { assignmentColumns, responsibleEmail } from '@/lib/report-assignment';

export const dynamic = 'force-dynamic';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const role = await getTeamRole(user.email);
  const base = `SELECT ${assignmentColumns}, r.id, r.function_name, r.institution, r.copy_number, r.version, r.status, r.urgent, r.author_email, r.updated_at, COUNT(a.id) AS attachment_count, CASE WHEN r.author_id=? OR lower(r.author_email)=lower(?) THEN 1 ELSE 0 END AS is_owner`;
  let statement;
  if (role === 'manager') {
    statement = env.DB.prepare(`${base}, 1 AS can_edit FROM reports r LEFT JOIN attachments a ON a.report_id=r.id GROUP BY r.id ORDER BY r.updated_at DESC LIMIT 100`).bind(user.userId, user.email);
  } else if (role === 'developer') {
    statement = env.DB.prepare(`${base}, CASE WHEN r.author_id=? OR lower(r.author_email)=lower(?) OR r.status IN ('Com Desenvolvimento','Em análise','Em correção','Em teste','Ainda ocorre') OR EXISTS (SELECT 1 FROM report_shares s WHERE s.report_id=r.id AND lower(s.user_email)=lower(?)) THEN 1 ELSE 0 END AS can_edit FROM reports r LEFT JOIN attachments a ON a.report_id=r.id WHERE r.author_id=? OR lower(r.author_email)=lower(?) OR r.status IN ('Com Desenvolvimento','Em análise','Em correção','Em teste','Ainda ocorre') OR EXISTS (SELECT 1 FROM report_shares s WHERE s.report_id=r.id AND lower(s.user_email)=lower(?)) GROUP BY r.id ORDER BY r.updated_at DESC LIMIT 100`).bind(user.userId, user.email, user.userId, user.email, user.email, user.userId, user.email, user.email);
  } else {
    statement = env.DB.prepare(`${base}, CASE WHEN r.author_id=? OR lower(r.author_email)=lower(?) OR EXISTS (SELECT 1 FROM report_shares s WHERE s.report_id=r.id AND lower(s.user_email)=lower(?)) THEN 1 ELSE 0 END AS can_edit FROM reports r LEFT JOIN attachments a ON a.report_id=r.id WHERE r.author_id=? OR lower(r.author_email)=lower(?) OR EXISTS (SELECT 1 FROM report_shares s WHERE s.report_id=r.id AND lower(s.user_email)=lower(?)) GROUP BY r.id ORDER BY r.updated_at DESC LIMIT 100`).bind(user.userId, user.email, user.userId, user.email, user.email, user.userId, user.email, user.email);
  }
  const result = await statement.all();
  const members = await env.DB.prepare('SELECT email,name FROM team_members').all<{ email: string; name: string }>();
  const names = new Map(members.results.map((member) => [member.email.toLowerCase(), member.name]));
  return Response.json({ reports: result.results.map((report) => { const email = responsibleEmail(report); return { ...report, responsible_email: email, responsible_name: names.get(email.toLowerCase()) || email }; }), scope: role });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase(); const data = await request.formData();
  const fromTestRound = value(data, 'fromTestRound') === 'yes';
  const roundId = value(data, 'testRoundId'), itemId = value(data, 'testItemId');
  let roundTitle = '', roundVersion = '', itemTitle = '';
  if (fromTestRound) {
    const linked = await env.DB.prepare(`SELECT r.title AS round_title,r.version AS round_version,i.title AS item_title FROM test_rounds r JOIN test_items i ON i.round_id=r.id WHERE r.id=? AND i.id=?`).bind(roundId, itemId).first<{ round_title: string; round_version: string; item_title: string }>();
    if (!linked) return Response.json({ error: 'Selecione uma rodada e um teste válidos' }, { status: 400 });
    const existingReport = await env.DB.prepare('SELECT id FROM reports WHERE from_test_round=1 AND test_item_id=? ORDER BY created_at DESC LIMIT 1').bind(itemId).first<{ id: string }>();
    if (existingReport) return Response.json({ error: `Este teste já está vinculado ao report ${existingReport.id}.`, existingReportId: existingReport.id }, { status: 409 });
    roundTitle = linked.round_title; roundVersion = linked.round_version; itemTitle = linked.item_title;
  }
  const institution = value(data, 'institution') || (fromTestRound ? 'Rodada interna de testes' : ''), functionName = value(data, 'function'), systemPath = value(data, 'path');
  const descriptionDraft = parseDescription(value(data, 'description'));
  const backup = data.get('backup');
  const hasBackup = value(data, 'hasBackup') === 'yes';
  const hasAttachments = value(data, 'hasAttachments') === 'yes';
  if (!institution || !functionName || !systemPath || !descriptionDraft.some((block) => block.type === 'image' || block.value.trim())) return Response.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
  const backupFile = backup instanceof File && backup.size > 0 ? backup : null;
  if (hasBackup && (!backupFile || (!backupFile.name.toLowerCase().endsWith('.csv') && backupFile.type !== 'text/csv'))) return Response.json({ error: 'Você marcou que possui cópia; anexe o arquivo CSV' }, { status: 400 });
  if (backupFile && backupFile.size > MAX_FILE_BYTES) return Response.json({ error: 'O CSV excede 10 MB' }, { status: 413 });
  const screenshots = data.getAll('screenshots').filter((item): item is File => item instanceof File && item.size > 0);
  const inlineImages = data.getAll('inlineImages').filter((item): item is File => item instanceof File && item.size > 0);
  if (hasAttachments && screenshots.length === 0 && inlineImages.length === 0) return Response.json({ error: 'Você marcou que possui anexos; selecione ao menos um print' }, { status: 400 });
  if (screenshots.some((file) => !IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) return Response.json({ error: 'Print inválido ou maior que 10 MB' }, { status: 400 });
  if (inlineImages.some((file) => !IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) return Response.json({ error: 'Imagem inserida no texto inválida ou maior que 10 MB' }, { status: 400 });
  if (descriptionDraft.some((block) => block.type === 'image' && (block.fileIndex < 0 || block.fileIndex >= inlineImages.length))) return Response.json({ error: 'Não foi possível relacionar uma imagem inserida no texto' }, { status: 400 });
  const now = Date.now(), id = `BUG-${new Date(now).getFullYear()}-${String(now).slice(-5)}`, storedKeys: string[] = [];
  try {
    const files = [...inlineImages.map((file) => ({ file, kind: 'inline' })), ...(hasBackup && backupFile ? [{ file: backupFile, kind: 'backup' }] : []), ...(hasAttachments ? screenshots.map((file) => ({ file, kind: 'screenshot' })) : [])];
    const rows: Array<{ id: string; key: string; file: File; kind: string }> = [];
    for (const { file, kind } of files) { const attachmentId = crypto.randomUUID(), key = `reports/${id}/${attachmentId}-${safeName(file.name)}`; await env.FILES.put(key, file.stream()); storedKeys.push(key); rows.push({ id: attachmentId, key, file, kind }); }
    const inlineRows = rows.filter((row) => row.kind === 'inline');
    const description = JSON.stringify({ version: 1, blocks: descriptionDraft.map((block) => block.type === 'text' ? { type: 'text', value: block.value } : { type: 'image', attachmentId: inlineRows[block.fileIndex]?.id, caption: block.caption }) });
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO reports (id,institution,city,copy_number,inep,client_name,phone,function_name,version,system_path,description,school_year,urgent,beta_status,workaround,from_test_round,test_round_id,test_round_title,test_round_version,test_item_id,test_item_title,status,author_id,author_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, institution, value(data,'city'), value(data,'copy'), value(data,'inep'), value(data,'clientName'), value(data,'phone'), functionName, value(data,'version') || roundVersion, systemPath, description, value(data,'schoolYear'), value(data,'urgent') === 'yes' ? 1 : 0, value(data,'beta') || 'Não testado', value(data,'workaround'), fromTestRound ? 1 : 0, fromTestRound ? roundId : null, fromTestRound ? roundTitle : null, fromTestRound ? roundVersion : null, fromTestRound ? itemId : null, fromTestRound ? itemTitle : null, 'Novo report', user.userId, user.email, now, now),
      env.DB.prepare('INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, user.userId, user.email, 'report_created', 'Report criado e enviado ao Desenvolvimento.', now),
      ...rows.map((row) => env.DB.prepare('INSERT INTO attachments (id,report_id,object_key,file_name,content_type,byte_size,kind,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(row.id, id, row.key, row.file.name, row.file.type || 'application/octet-stream', row.file.size, row.kind, now)),
    ]);
    return Response.json({ id }, { status: 201 });
  } catch (error) { await Promise.all(storedKeys.map((key) => env.FILES.delete(key))); console.error(error); return Response.json({ error: 'Falha ao salvar o report' }, { status: 500 }); }
}
function value(data: FormData, name: string) { const item = data.get(name); return typeof item === 'string' ? item.trim() : ''; }
function safeName(name: string) { return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120); }
type DescriptionBlock = { type: 'text'; value: string; fileIndex: -1; caption: '' } | { type: 'image'; value: ''; fileIndex: number; caption: string };
function parseDescription(raw: string): DescriptionBlock[] {
  try {
    const parsed = JSON.parse(raw) as { version?: number; blocks?: Array<{ type?: string; value?: string; fileIndex?: number; caption?: string }> };
    if (parsed.version === 1 && Array.isArray(parsed.blocks)) return parsed.blocks.slice(0, 60).flatMap((block): DescriptionBlock[] => block.type === 'image' && Number.isInteger(block.fileIndex) ? [{ type: 'image', value: '', fileIndex: Number(block.fileIndex), caption: String(block.caption || '').slice(0, 300) }] : block.type === 'text' ? [{ type: 'text', value: String(block.value || '').slice(0, 20000), fileIndex: -1, caption: '' }] : []);
  } catch { /* Texto simples de clientes antigos. */ }
  return [{ type: 'text', value: raw.slice(0, 20000), fileIndex: -1, caption: '' }];
}
