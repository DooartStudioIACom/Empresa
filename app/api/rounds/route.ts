import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';
import { getTeamRole } from '@/lib/report-access';

export const dynamic = 'force-dynamic';

type NewRound = { title?: string; version?: string; deadline?: string; description?: string; tags?: unknown[]; participantEmails?: unknown[]; items?: Array<{ title?: string; path?: string; description?: string }> };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const now = Date.now();
  await env.DB.prepare(`UPDATE test_rounds SET status='Finalizada',updated_at=? WHERE status='Em andamento' AND EXISTS (SELECT 1 FROM round_participants p WHERE p.round_id=test_rounds.id) AND NOT EXISTS (SELECT 1 FROM round_participants p JOIN test_items i ON i.round_id=p.round_id LEFT JOIN test_item_responses r ON r.item_id=i.id AND lower(r.tester_email)=lower(p.user_email) WHERE p.round_id=test_rounds.id AND COALESCE(r.status,'Pendente') NOT IN ('Aprovado','Com bug'))`).bind(now).run();
  const role = await getTeamRole(user.email);
  const [rounds, items] = await Promise.all([
    role === 'manager'
      ? env.DB.prepare('SELECT * FROM test_rounds ORDER BY CASE WHEN status = ? THEN 0 ELSE 1 END, updated_at DESC').bind('Em andamento').all()
      : env.DB.prepare(`SELECT r.* FROM test_rounds r WHERE lower(r.author_email)=lower(?) OR EXISTS (SELECT 1 FROM round_participants p WHERE p.round_id=r.id AND lower(p.user_email)=lower(?)) ORDER BY CASE WHEN r.status=? THEN 0 ELSE 1 END,r.updated_at DESC`).bind(user.email, user.email, 'Em andamento').all(),
    env.DB.prepare('SELECT * FROM test_items ORDER BY round_id, position ASC').all(),
  ]);
  const [responses, participantRows, linkedReportRows, itemAttachmentRows] = await Promise.all([
    env.DB.prepare('SELECT * FROM test_item_responses WHERE tester_id = ?').bind(user.userId).all(),
    env.DB.prepare(`SELECT p.round_id,p.user_id,p.user_email,p.user_name,p.joined_at,p.updated_at,p.completed_at,p.deadline_override,COUNT(i.id) AS total_items,SUM(CASE WHEN r.status IN ('Aprovado','Com bug') THEN 1 ELSE 0 END) AS done_items,SUM(CASE WHEN r.status = 'Com bug' THEN 1 ELSE 0 END) AS bug_items FROM round_participants p JOIN test_items i ON i.round_id=p.round_id LEFT JOIN test_item_responses r ON r.item_id=i.id AND lower(r.tester_email)=lower(p.user_email) WHERE (? = 'manager' OR lower(p.user_email)=lower(?)) GROUP BY p.round_id,p.user_id,p.user_email,p.user_name,p.joined_at,p.updated_at,p.completed_at,p.deadline_override ORDER BY done_items DESC,p.user_name`).bind(role, user.email).all(),
    env.DB.prepare(`SELECT id,test_item_id,status FROM reports WHERE from_test_round=1 AND test_item_id IS NOT NULL ORDER BY created_at DESC`).all(),
    env.DB.prepare('SELECT id,item_id,file_name,content_type,byte_size FROM test_item_attachments ORDER BY created_at,id').all(),
  ]);
  const allItems = items.results as Array<Record<string, unknown>>;
  const ownResponses: Array<Record<string, unknown>> = (responses.results as Array<Record<string, unknown>>).map((response): Record<string, unknown> => ({ ...response, status: response.status === 'Em teste' ? 'Pendente' : response.status }));
  const participants = participantRows.results as Array<Record<string, unknown>>;
  const linkedReports = linkedReportRows.results as Array<Record<string, unknown>>;
  const itemAttachments = itemAttachmentRows.results as Array<Record<string, unknown>>;
  return Response.json({ rounds: (rounds.results as Array<Record<string, unknown>>).map((round) => ({ ...round, tags: parseTags(round.tags), items: allItems.filter((item) => item.round_id === round.id).map((item) => { const response = ownResponses.find((entry) => entry.item_id === item.id); const linkedReport = linkedReports.find((entry) => entry.test_item_id === item.id); return { ...item, status: response?.status || 'Pendente', tester_id: response?.tester_id || null, tester_email: response?.tester_email || null, tester_name: response?.tester_name || null, result_note: response?.result_note || null, response_updated_at: response?.updated_at || null, linked_report_id: linkedReport?.id || null, linked_report_status: linkedReport?.status || null, images: itemAttachments.filter((file) => file.item_id === item.id).map((file) => ({ id: String(file.id), file_name: String(file.file_name), content_type: String(file.content_type), byte_size: Number(file.byte_size || 0) })) }; }), participants: participants.filter((participant) => participant.round_id === round.id).map((participant) => ({ ...participant, progress: Number(participant.total_items) ? Math.round((Number(participant.done_items) / Number(participant.total_items)) * 100) : 0, is_current: String(participant.user_email).toLowerCase() === user.email.toLowerCase() })) })) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  if (await getTeamRole(user.email) !== 'manager') return Response.json({ error: 'Somente gerentes podem criar rodadas' }, { status: 403 });
  await ensureDatabase();
  const multipart = request.headers.get('content-type')?.includes('multipart/form-data');
  let data: NewRound | null = null;
  const itemFiles = new Map<number, File[]>();
  if (multipart) {
    const form = await request.formData();
    try { data = JSON.parse(String(form.get('payload') || '{}')) as NewRound; } catch { data = null; }
    for (const [key, value] of form.entries()) { const match = /^itemImages_(\d+)$/.exec(key); if (match && value instanceof File && value.size > 0) { const index = Number(match[1]); itemFiles.set(index, [...(itemFiles.get(index) || []), value]); } }
  } else data = await request.json().catch(() => null) as NewRound | null;
  const title = 'Rodada de testes', version = clean(data?.version), deadline = clean(data?.deadline), description = clean(data?.description), tags = normalizeTags(data?.tags);
  const participantEmails = [...new Set((Array.isArray(data?.participantEmails) ? data.participantEmails : []).map((value) => clean(value).toLowerCase()).filter((value) => value.includes('@')))];
  const items = (data?.items || []).map((item) => ({ title: clean(item.title), path: clean(item.path), description: clean(item.description) })).filter((item) => item.title);
  if (!version || !deadline || items.length === 0 || participantEmails.length === 0) return Response.json({ error: 'Informe versão, prazo, participantes e ao menos um item de teste' }, { status: 400 });
  if (items.length > 50) return Response.json({ error: 'A rodada pode ter no máximo 50 itens' }, { status: 400 });
  if (participantEmails.length > 100) return Response.json({ error: 'Selecione no máximo 100 participantes' }, { status: 400 });
  const invalidImage = [...itemFiles.values()].flat().find((file) => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024);
  if (invalidImage) return Response.json({ error: 'Cada imagem deve ser PNG, JPG ou WEBP com até 10 MB' }, { status: 400 });
  const placeholders = participantEmails.map(() => '?').join(',');
  const memberRows = await env.DB.prepare(`SELECT email,name,role FROM team_members WHERE lower(email) IN (${placeholders})`).bind(...participantEmails).all<{ email: string; name: string; role: string }>();
  const members = memberRows.results.map((member) => ({ ...member, email: member.email.toLowerCase() }));
  if (participantEmails.includes(user.email.toLowerCase()) && !members.some((member) => member.email === user.email.toLowerCase())) members.push({ email: user.email.toLowerCase(), name: user.fullName || user.displayName || user.email.split('@')[0], role: await getTeamRole(user.email) });
  if (members.length !== participantEmails.length) return Response.json({ error: 'Um ou mais participantes não pertencem à equipe cadastrada' }, { status: 400 });
  const now = Date.now(), id = `RND-${new Date(now).getFullYear()}-${String(now).slice(-5)}`;
  const insertedItems = items.map((item, index) => ({ id: crypto.randomUUID(), item, index }));
  const storedKeys: string[] = [];
  try {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO test_rounds (id,title,version,deadline,description,tags,status,author_id,author_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, title, version, deadline, description, JSON.stringify(tags), 'Em andamento', user.userId, user.email, now, now),
    ...insertedItems.map(({ id: itemId, item, index }) => env.DB.prepare('INSERT INTO test_items (id,round_id,position,title,path,description,status,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(itemId, id, index + 1, item.title, item.path, item.description, 'Pendente', now)),
    ...members.map((member) => env.DB.prepare('INSERT INTO round_participants (round_id,user_id,user_email,user_name,joined_at,updated_at) VALUES (?,?,?,?,?,?)').bind(id, `assigned:${member.email}`, member.email, member.name, now, now)),
  ]);
  const attachmentRows: D1PreparedStatement[] = [];
  for (const entry of insertedItems) for (const file of (itemFiles.get(entry.index) || [])) {
    const attachmentId = crypto.randomUUID(); const key = `test-rounds/${id}/${entry.id}/${attachmentId}-${safeName(file.name)}`; await env.FILES.put(key, file.stream()); storedKeys.push(key);
    attachmentRows.push(env.DB.prepare('INSERT INTO test_item_attachments (id,item_id,object_key,file_name,content_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?)').bind(attachmentId, entry.id, key, file.name, file.type, file.size, now));
  }
  if (attachmentRows.length) await env.DB.batch(attachmentRows);
  const created = await env.DB.prepare('SELECT * FROM test_rounds WHERE id = ?').bind(id).first();
  const createdItems = await env.DB.prepare('SELECT * FROM test_items WHERE round_id = ? ORDER BY position').bind(id).all();
  return Response.json({ round: { ...created, tags, items: createdItems.results } }, { status: 201 });
  } catch (error) { await Promise.all(storedKeys.map((key) => env.FILES.delete(key))); console.error(error); return Response.json({ error: 'Falha ao salvar a rodada' }, { status: 500 }); }
}

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function normalizeTag(value: unknown) { return clean(value).toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').slice(0, 30); }
function normalizeTags(value: unknown) { return [...new Set((Array.isArray(value) ? value : []).map(normalizeTag).filter(Boolean))].slice(0, 12); }
function parseTags(value: unknown) { try { return normalizeTags(JSON.parse(typeof value === 'string' ? value : '[]')); } catch { return []; } }
function safeName(name: string) { return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120); }
