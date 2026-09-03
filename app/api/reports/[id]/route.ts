import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_STATUSES = new Set(['Novo report', 'Com Desenvolvimento', 'Aguardando reteste', 'Finalizado']);
const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  'Novo report': new Set(['Com Desenvolvimento']),
  'Com Desenvolvimento': new Set(['Aguardando reteste']),
  'Aguardando reteste': new Set(['Finalizado', 'Com Desenvolvimento']),
  Finalizado: new Set(['Com Desenvolvimento']),
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
  if (!report) return Response.json({ error: 'Report não encontrado' }, { status: 404 });
  const isOwner = report.author_id === user.userId;
  const shared = isOwner ? true : Boolean(await env.DB.prepare('SELECT 1 FROM report_shares WHERE report_id=? AND lower(user_email)=lower(?)').bind(id, user.email).first());
  const [attachments, activities] = await Promise.all([
    env.DB.prepare('SELECT id, file_name, content_type, byte_size, kind, created_at FROM attachments WHERE report_id = ? ORDER BY created_at ASC').bind(id).all(),
    env.DB.prepare('SELECT id, actor_email, action, message, created_at FROM activities WHERE report_id = ? ORDER BY created_at ASC').bind(id).all(),
  ]);
  const shares = isOwner ? await env.DB.prepare('SELECT user_email,permission,created_at FROM report_shares WHERE report_id=? ORDER BY created_at').bind(id).all() : { results: [] };
  return Response.json({ report, attachments: attachments.results, activities: activities.results, permissions: { isOwner, canEdit: isOwner || shared }, shares: shares.results });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const existing = await env.DB.prepare('SELECT id, status, author_id FROM reports WHERE id = ?').bind(id).first<{ id: string; status: string; author_id: string }>();
  if (!existing) return Response.json({ error: 'Report não encontrado' }, { status: 404 });
  const canEdit = existing.author_id === user.userId || Boolean(await env.DB.prepare('SELECT 1 FROM report_shares WHERE report_id=? AND lower(user_email)=lower(?)').bind(id, user.email).first());
  if (!canEdit) return Response.json({ error: 'Este report está disponível somente para leitura. O autor precisa compartilhar a edição com você.' }, { status: 403 });
  const data = await request.formData();
  const message = field(data, 'message');
  const currentStatus = normalizeStatus(existing.status);
  const requestedStatus = field(data, 'status');
  const status = ALLOWED_STATUSES.has(requestedStatus) ? requestedStatus : currentStatus;
  if (status !== currentStatus && !ALLOWED_TRANSITIONS[currentStatus]?.has(status)) {
    return Response.json({ error: `Esta mudança não é permitida: ${currentStatus} → ${status}` }, { status: 400 });
  }
  const attachmentValue = data.get('attachment');
  const attachment = attachmentValue instanceof File && attachmentValue.size > 0 ? attachmentValue : null;
  if (!message && status === currentStatus && !attachment) return Response.json({ error: 'Escreva uma resposta ou avance o fluxo' }, { status: 400 });
  if (attachment && attachment.size > MAX_FILE_BYTES) return Response.json({ error: 'O anexo excede 10 MB' }, { status: 413 });
  const now = Date.now();
  let objectKey: string | null = null;
  try {
    const changedStatus = status !== currentStatus;
    const statements = [env.DB.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id)];
    if (message || changedStatus) {
      const activityMessage = changedStatus ? [transitionMessage(currentStatus, status), message].filter(Boolean).join(' ') : message;
      statements.push(env.DB.prepare('INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, user.userId, user.email, changedStatus ? 'status_update' : 'comment', activityMessage, now));
    }
    if (attachment) {
      const attachmentId = crypto.randomUUID();
      objectKey = `reports/${id}/${attachmentId}-${safeName(attachment.name)}`;
      await env.FILES.put(objectKey, attachment.stream());
      statements.push(env.DB.prepare('INSERT INTO attachments (id,report_id,object_key,file_name,content_type,byte_size,kind,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(attachmentId, id, objectKey, attachment.name, attachment.type || 'application/octet-stream', attachment.size, 'response', now));
      statements.push(env.DB.prepare('INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, user.userId, user.email, 'attachment_added', `Anexou ${attachment.name}.`, now + 1));
    }
    await env.DB.batch(statements);
    return Response.json({ ok: true, status });
  } catch (error) {
    if (objectKey) await env.FILES.delete(objectKey);
    console.error(error);
    return Response.json({ error: 'Não foi possível registrar a resposta' }, { status: 500 });
  }
}

function field(data: FormData, name: string) { const value = data.get(name); return typeof value === 'string' ? value.trim() : ''; }
function safeName(name: string) { return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120); }
function normalizeStatus(status: string) {
  if (['Corrigido', 'Finalizado'].includes(status)) return 'Finalizado';
  if (status === 'Aguardando reteste') return status;
  if (['Em análise', 'Em correção', 'Em teste', 'Ainda ocorre', 'Com Desenvolvimento'].includes(status)) return 'Com Desenvolvimento';
  return 'Novo report';
}
function transitionMessage(from: string, to: string) {
  if (from === 'Novo report' && to === 'Com Desenvolvimento') return 'Report encaminhado ao Desenvolvimento.';
  if (from === 'Com Desenvolvimento' && to === 'Aguardando reteste') return 'Correção liberada pelo Desenvolvimento para reteste.';
  if (from === 'Aguardando reteste' && to === 'Finalizado') return 'Reteste aprovado. Report finalizado com OK.';
  if (from === 'Aguardando reteste' && to === 'Com Desenvolvimento') return 'O problema continua no reteste. Report devolvido ao Desenvolvimento.';
  if (from === 'Finalizado' && to === 'Com Desenvolvimento') return 'Report reaberto e encaminhado ao Desenvolvimento.';
  return `Status alterado de ${from} para ${to}.`;
}
