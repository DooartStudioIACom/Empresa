import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';
import { getTeamRole } from '@/lib/report-access';

export const dynamic = 'force-dynamic';
const ITEM_STATUSES = new Set(['Pendente', 'Aprovado', 'Com bug']);
type LinkableReport = { id: string; author_id: string; author_email: string; from_test_round: number; test_item_id: string | null };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const data = await request.json().catch(() => null) as { itemId?: string; status?: string; note?: string; existingReportId?: string } | null;
  const itemId = clean(data?.itemId), status = clean(data?.status), note = clean(data?.note), existingReportId = clean(data?.existingReportId);
  if (!itemId || !ITEM_STATUSES.has(status)) return Response.json({ error: 'Item ou status inválido' }, { status: 400 });
  const item = await env.DB.prepare(`SELECT i.id,i.title,r.title AS round_title,r.version AS round_version,r.status AS round_status FROM test_items i JOIN test_rounds r ON r.id=i.round_id WHERE i.id=? AND i.round_id=?`).bind(itemId, id).first<{ id: string; title: string; round_title: string; round_version: string; round_status: string }>();
  if (!item) return Response.json({ error: 'Item de teste não encontrado' }, { status: 404 });
  if (item.round_status === 'Finalizada') return Response.json({ error: 'A rodada já foi encerrada e está disponível somente para consulta.' }, { status: 409 });
  const assignment = await env.DB.prepare('SELECT user_id FROM round_participants WHERE round_id=? AND lower(user_email)=lower(?) LIMIT 1').bind(id, user.email).first<{ user_id: string }>();
  if (!assignment) return Response.json({ error: 'Você não foi selecionado para executar esta rodada.' }, { status: 403 });
  if (existingReportId && status !== 'Com bug') return Response.json({ error: 'Um report só pode ser vinculado a um resultado com bug' }, { status: 400 });
  let reportToLink: LinkableReport | null = null;
  if (existingReportId) {
    reportToLink = await env.DB.prepare('SELECT id,author_id,author_email,from_test_round,test_item_id FROM reports WHERE id=?').bind(existingReportId).first<LinkableReport>();
    if (!reportToLink) return Response.json({ error: 'Report selecionado não encontrado' }, { status: 404 });
    const role = await getTeamRole(user.email);
    const ownsReport = reportToLink.author_id === user.userId || reportToLink.author_email.toLowerCase() === user.email.toLowerCase();
    if (!ownsReport && role !== 'manager') return Response.json({ error: 'Você só pode vincular um report criado por você.' }, { status: 403 });
    if (reportToLink.test_item_id && reportToLink.test_item_id !== itemId) return Response.json({ error: 'Este report já está vinculado a outro cenário de teste.' }, { status: 409 });
    const alreadyLinked = await env.DB.prepare('SELECT id FROM reports WHERE from_test_round=1 AND test_item_id=? AND id<>? LIMIT 1').bind(itemId, existingReportId).first<{ id: string }>();
    if (alreadyLinked) return Response.json({ error: `Este cenário já está vinculado ao report ${alreadyLinked.id}.` }, { status: 409 });
  }
  const now = Date.now();
  const userName = user.fullName || user.displayName || user.email.split('@')[0];
  const statements = [
    env.DB.prepare(`INSERT INTO test_item_responses (id,item_id,round_id,tester_id,tester_email,tester_name,status,result_note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id,tester_id) DO UPDATE SET status=excluded.status,result_note=excluded.result_note,tester_email=excluded.tester_email,tester_name=excluded.tester_name,updated_at=excluded.updated_at`).bind(crypto.randomUUID(), itemId, id, user.userId, user.email, userName, status, note, now, now),
  ];
  if (reportToLink) {
    statements.push(env.DB.prepare('UPDATE reports SET from_test_round=1,test_round_id=?,test_round_title=?,test_round_version=?,test_item_id=?,test_item_title=?,updated_at=? WHERE id=?').bind(id, item.round_title, item.round_version, itemId, item.title, now, reportToLink.id));
    statements.push(env.DB.prepare('INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), reportToLink.id, user.userId, user.email, 'round_linked', `Report vinculado à rodada ${item.round_title}, cenário ${item.title}.`, now));
  }
  await env.DB.batch(statements);
  const pending = await env.DB.prepare(`SELECT COUNT(i.id) AS total FROM test_items i LEFT JOIN test_item_responses r ON r.item_id=i.id AND r.tester_id=? WHERE i.round_id=? AND COALESCE(r.status,'Pendente') IN ('Pendente','Em teste')`).bind(user.userId, id).first<{ total: number }>();
  const completedAt = Number(pending?.total || 0) === 0 ? now : null;
  await env.DB.prepare('UPDATE round_participants SET user_name=?,completed_at=?,updated_at=? WHERE round_id=? AND lower(user_email)=lower(?)').bind(userName, completedAt, now, id, user.email).run();
  let roundCompleted = false;
  if (completedAt) {
    const incompleteParticipants = await env.DB.prepare(`SELECT COUNT(*) AS total FROM round_participants p WHERE p.round_id=? AND EXISTS (SELECT 1 FROM test_items i LEFT JOIN test_item_responses r ON r.item_id=i.id AND lower(r.tester_email)=lower(p.user_email) WHERE i.round_id=p.round_id AND COALESCE(r.status,'Pendente') NOT IN ('Aprovado','Com bug'))`).bind(id).first<{ total: number }>();
    roundCompleted = Number(incompleteParticipants?.total || 0) === 0;
  }
  if (roundCompleted) await env.DB.prepare(`UPDATE test_rounds SET status='Finalizada',updated_at=? WHERE id=?`).bind(now, id).run();
  else await env.DB.prepare('UPDATE test_rounds SET updated_at = ? WHERE id = ?').bind(now, id).run();
  return Response.json({ ok: true, item: { id: itemId, status, result_note: note, tester_email: user.email, tester_name: userName, updated_at: now, linked_report_id: reportToLink?.id || null }, participantCompleted: Boolean(completedAt), roundCompleted });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const data = await request.json().catch(() => null) as { participantEmail?: string; deadline?: string } | null;
  const participantEmail = clean(data?.participantEmail).toLowerCase();
  const deadline = clean(data?.deadline);
  if (!participantEmail || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return Response.json({ error: 'Informe o participante e um novo prazo válido.' }, { status: 400 });
  const parsedDeadline = new Date(`${deadline}T12:00:00Z`);
  if (!Number.isFinite(parsedDeadline.getTime()) || parsedDeadline.toISOString().slice(0, 10) !== deadline) return Response.json({ error: 'Informe uma data válida.' }, { status: 400 });

  const round = await env.DB.prepare('SELECT deadline,status,author_id,author_email FROM test_rounds WHERE id=?').bind(id).first<{ deadline: string; status: string; author_id: string; author_email: string }>();
  if (!round) return Response.json({ error: 'Rodada não encontrada.' }, { status: 404 });
  const ownsRound = round.author_id === user.userId || round.author_email.toLowerCase() === user.email.toLowerCase();
  if (!ownsRound) return Response.json({ error: 'Somente quem criou a rodada pode estender prazos individuais.' }, { status: 403 });
  if (round.status === 'Finalizada') return Response.json({ error: 'A rodada já foi encerrada e está disponível somente para consulta.' }, { status: 409 });

  const participant = await env.DB.prepare('SELECT user_email,deadline_override FROM round_participants WHERE round_id=? AND lower(user_email)=lower(?) LIMIT 1').bind(id, participantEmail).first<{ user_email: string; deadline_override: string | null }>();
  if (!participant) return Response.json({ error: 'Participante não encontrado nesta rodada.' }, { status: 404 });
  const pending = await env.DB.prepare(`SELECT COUNT(*) AS total FROM test_items i WHERE i.round_id=? AND NOT EXISTS (SELECT 1 FROM test_item_responses r WHERE r.item_id=i.id AND lower(r.tester_email)=lower(?) AND r.status IN ('Aprovado','Com bug'))`).bind(id, participantEmail).first<{ total: number }>();
  if (!pending?.total) return Response.json({ error: 'Esta pessoa já concluiu os testes.' }, { status: 409 });
  const currentDeadline = participant.deadline_override || round.deadline;
  if (deadline <= currentDeadline) return Response.json({ error: `O novo prazo deve ser posterior a ${formatIsoDate(currentDeadline)}.` }, { status: 400 });

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE round_participants SET deadline_override=?,updated_at=? WHERE round_id=? AND lower(user_email)=lower(?)').bind(deadline, now, id, participantEmail),
    env.DB.prepare('UPDATE test_rounds SET updated_at=? WHERE id=?').bind(now, id),
  ]);
  return Response.json({ ok: true, participantEmail, deadline_override: deadline });
}

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function formatIsoDate(value: string) { const [year, month, day] = value.split('-'); return year && month && day ? `${day}/${month}/${year}` : value; }
