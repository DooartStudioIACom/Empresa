import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';
import { getTeamRole } from '@/lib/report-access';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return new Response('Não autenticado', { status: 401 });
  await ensureDatabase(); const { id } = await params;
  const row = await env.DB.prepare('SELECT a.object_key,a.file_name,a.content_type,r.id AS report_id,r.status,r.author_id,r.author_email FROM attachments a JOIN reports r ON r.id=a.report_id WHERE a.id=?').bind(id).first<{ object_key: string; file_name: string; content_type: string; report_id: string; status: string; author_id: string; author_email: string }>();
  if (!row) return new Response('Anexo não encontrado', { status: 404 });
  const role = await getTeamRole(user.email);
  const isOwner = row.author_id === user.userId || row.author_email.toLowerCase() === user.email.toLowerCase();
  const shared = isOwner ? true : Boolean(await env.DB.prepare('SELECT 1 FROM report_shares WHERE report_id=? AND lower(user_email)=lower(?)').bind(row.report_id, user.email).first());
  const roleAccess = role === 'manager' || (role === 'developer' && ['Com Desenvolvimento', 'Em análise', 'Em correção', 'Em teste', 'Ainda ocorre'].includes(row.status));
  if (!isOwner && !shared && !roleAccess) return new Response('Anexo não disponível para o seu perfil', { status: 403 });
  const object = await env.FILES.get(row.object_key, 'arrayBuffer'); if (!object) return new Response('Arquivo não encontrado', { status: 404 });
  const headers = new Headers(); headers.set('content-type', row.content_type); headers.set('content-disposition', `attachment; filename="${row.file_name.replace(/["\r\n]/g, '')}"`); headers.set('cache-control', 'private, no-store');
  return new Response(object, { headers });
}
