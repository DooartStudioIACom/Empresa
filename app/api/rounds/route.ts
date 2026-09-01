import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

type NewRound = { title?: string; version?: string; deadline?: string; description?: string; items?: Array<{ title?: string; path?: string; description?: string }> };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const now = Date.now(), userName = user.fullName || user.displayName || user.email.split('@')[0];
  const activeRounds = await env.DB.prepare('SELECT id FROM test_rounds').all<{ id: string }>();
  if (activeRounds.results.length) await env.DB.batch(activeRounds.results.map((round) => env.DB.prepare(`INSERT INTO round_participants (round_id,user_id,user_email,user_name,joined_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(round_id,user_id) DO UPDATE SET user_email=excluded.user_email,user_name=excluded.user_name,updated_at=excluded.updated_at`).bind(round.id, user.userId, user.email, userName, now, now)));
  const [rounds, items] = await Promise.all([
    env.DB.prepare('SELECT * FROM test_rounds ORDER BY CASE WHEN status = ? THEN 0 ELSE 1 END, updated_at DESC').bind('Em andamento').all(),
    env.DB.prepare('SELECT * FROM test_items ORDER BY round_id, position ASC').all(),
  ]);
  const [responses, participantRows] = await Promise.all([
    env.DB.prepare('SELECT * FROM test_item_responses WHERE tester_id = ?').bind(user.userId).all(),
    env.DB.prepare(`SELECT p.round_id,p.user_id,p.user_email,p.user_name,p.joined_at,p.updated_at,p.completed_at,COUNT(i.id) AS total_items,SUM(CASE WHEN r.status IN ('Aprovado','Com bug') THEN 1 ELSE 0 END) AS done_items,SUM(CASE WHEN r.status = 'Com bug' THEN 1 ELSE 0 END) AS bug_items FROM round_participants p JOIN test_items i ON i.round_id=p.round_id LEFT JOIN test_item_responses r ON r.item_id=i.id AND r.tester_id=p.user_id GROUP BY p.round_id,p.user_id,p.user_email,p.user_name,p.joined_at,p.updated_at,p.completed_at ORDER BY done_items DESC,p.user_name`).all(),
  ]);
  const allItems = items.results as Array<Record<string, unknown>>;
  const ownResponses = responses.results as Array<Record<string, unknown>>;
  const participants = participantRows.results as Array<Record<string, unknown>>;
  return Response.json({ rounds: (rounds.results as Array<Record<string, unknown>>).map((round) => ({ ...round, items: allItems.filter((item) => item.round_id === round.id).map((item) => { const response = ownResponses.find((entry) => entry.item_id === item.id); return { ...item, status: response?.status || 'Pendente', tester_id: response?.tester_id || null, tester_email: response?.tester_email || null, tester_name: response?.tester_name || null, result_note: response?.result_note || null, response_updated_at: response?.updated_at || null }; }), participants: participants.filter((participant) => participant.round_id === round.id).map((participant) => ({ ...participant, progress: Number(participant.total_items) ? Math.round((Number(participant.done_items) / Number(participant.total_items)) * 100) : 0, is_current: participant.user_id === user.userId })) })) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const data = await request.json().catch(() => null) as NewRound | null;
  const title = clean(data?.title), version = clean(data?.version), deadline = clean(data?.deadline), description = clean(data?.description);
  const items = (data?.items || []).map((item) => ({ title: clean(item.title), path: clean(item.path), description: clean(item.description) })).filter((item) => item.title);
  if (!title || !version || !deadline || items.length === 0) return Response.json({ error: 'Informe título, versão, prazo e ao menos um item de teste' }, { status: 400 });
  if (items.length > 50) return Response.json({ error: 'A rodada pode ter no máximo 50 itens' }, { status: 400 });
  const now = Date.now(), id = `RND-${new Date(now).getFullYear()}-${String(now).slice(-5)}`;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO test_rounds (id,title,version,deadline,description,status,author_id,author_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, title, version, deadline, description, 'Em andamento', user.userId, user.email, now, now),
    ...items.map((item, index) => env.DB.prepare('INSERT INTO test_items (id,round_id,position,title,path,description,status,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, index + 1, item.title, item.path, item.description, 'Pendente', now)),
  ]);
  const created = await env.DB.prepare('SELECT * FROM test_rounds WHERE id = ?').bind(id).first();
  const createdItems = await env.DB.prepare('SELECT * FROM test_items WHERE round_id = ? ORDER BY position').bind(id).all();
  return Response.json({ round: { ...created, items: createdItems.results } }, { status: 201 });
}

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
