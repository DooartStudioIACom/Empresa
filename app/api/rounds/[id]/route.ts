import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';
const ITEM_STATUSES = new Set(['Pendente', 'Em teste', 'Aprovado', 'Com bug']);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const data = await request.json().catch(() => null) as { itemId?: string; status?: string; note?: string } | null;
  const itemId = clean(data?.itemId), status = clean(data?.status), note = clean(data?.note);
  if (!itemId || !ITEM_STATUSES.has(status)) return Response.json({ error: 'Item ou status inválido' }, { status: 400 });
  const item = await env.DB.prepare('SELECT id FROM test_items WHERE id = ? AND round_id = ?').bind(itemId, id).first();
  if (!item) return Response.json({ error: 'Item de teste não encontrado' }, { status: 404 });
  const now = Date.now();
  const userName = user.fullName || user.displayName || user.email.split('@')[0];
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO round_participants (round_id,user_id,user_email,user_name,joined_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(round_id,user_id) DO UPDATE SET user_email=excluded.user_email,user_name=excluded.user_name,updated_at=excluded.updated_at`).bind(id, user.userId, user.email, userName, now, now),
    env.DB.prepare(`INSERT INTO test_item_responses (id,item_id,round_id,tester_id,tester_email,tester_name,status,result_note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id,tester_id) DO UPDATE SET status=excluded.status,result_note=excluded.result_note,tester_email=excluded.tester_email,tester_name=excluded.tester_name,updated_at=excluded.updated_at`).bind(crypto.randomUUID(), itemId, id, user.userId, user.email, userName, status, note, now, now),
  ]);
  const pending = await env.DB.prepare(`SELECT COUNT(i.id) AS total FROM test_items i LEFT JOIN test_item_responses r ON r.item_id=i.id AND r.tester_id=? WHERE i.round_id=? AND COALESCE(r.status,'Pendente') IN ('Pendente','Em teste')`).bind(user.userId, id).first<{ total: number }>();
  const completedAt = Number(pending?.total || 0) === 0 ? now : null;
  await env.DB.prepare('UPDATE round_participants SET completed_at = ?, updated_at = ? WHERE round_id = ? AND user_id = ?').bind(completedAt, now, id, user.userId).run();
  await env.DB.prepare('UPDATE test_rounds SET updated_at = ? WHERE id = ?').bind(now, id).run();
  return Response.json({ ok: true, item: { id: itemId, status, result_note: note, tester_email: user.email, tester_name: userName, updated_at: now }, participantCompleted: Boolean(completedAt) });
}

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
