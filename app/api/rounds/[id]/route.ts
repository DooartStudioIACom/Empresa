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
  await env.DB.prepare('UPDATE test_items SET status = ?, tester_id = ?, tester_email = ?, result_note = ?, updated_at = ? WHERE id = ?').bind(status, user.userId, user.email, note, now, itemId).run();
  const pending = await env.DB.prepare("SELECT COUNT(*) AS total FROM test_items WHERE round_id = ? AND status IN ('Pendente','Em teste')").bind(id).first<{ total: number }>();
  const roundStatus = Number(pending?.total || 0) === 0 ? 'Concluída' : 'Em andamento';
  await env.DB.prepare('UPDATE test_rounds SET status = ?, updated_at = ? WHERE id = ?').bind(roundStatus, now, id).run();
  return Response.json({ ok: true, item: { id: itemId, status, result_note: note, tester_email: user.email, updated_at: now }, roundStatus });
}

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
