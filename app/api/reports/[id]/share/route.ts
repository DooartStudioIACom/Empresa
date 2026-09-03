import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const report = await env.DB.prepare('SELECT id,author_id,author_email FROM reports WHERE id=?').bind(id).first<{ id: string; author_id: string; author_email: string }>();
  if (!report) return Response.json({ error: 'Report não encontrado' }, { status: 404 });
  if (report.author_id !== user.userId && report.author_email.toLowerCase() !== user.email.toLowerCase()) return Response.json({ error: 'Somente o autor pode compartilhar este report' }, { status: 403 });
  const body = await request.json().catch(() => null) as { email?: string; action?: string } | null;
  const email = String(body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Informe um e-mail válido' }, { status: 400 });
  if (email === user.email.toLowerCase()) return Response.json({ error: 'Você já é o autor deste report' }, { status: 400 });
  const now = Date.now();
  if (body?.action === 'remove') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM report_shares WHERE report_id=? AND lower(user_email)=lower(?)').bind(id, email),
      env.DB.prepare('INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, user.userId, user.email, 'share_removed', `Acesso de edição removido de ${email}.`, now),
    ]);
    return Response.json({ ok: true, removed: email });
  }
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO report_shares (report_id,user_email,permission,shared_by_id,shared_by_email,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(report_id,user_email) DO UPDATE SET permission='edit',shared_by_id=excluded.shared_by_id,shared_by_email=excluded.shared_by_email,created_at=excluded.created_at`).bind(id, email, 'edit', user.userId, user.email, now),
    env.DB.prepare('INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, user.userId, user.email, 'report_shared', `Edição compartilhada com ${email}.`, now),
  ]);
  return Response.json({ ok: true, shared: { user_email: email, permission: 'edit', created_at: now } });
}
