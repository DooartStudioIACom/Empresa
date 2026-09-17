import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';
import { getTeamRole } from '@/lib/report-access';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response('Não autenticado', { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const row = await env.DB.prepare(`SELECT a.object_key,a.file_name,a.content_type,a.byte_size,r.author_email FROM test_item_attachments a JOIN test_items i ON i.id=a.item_id JOIN test_rounds r ON r.id=i.round_id WHERE a.id=?`).bind(id).first<{ object_key: string; file_name: string; content_type: string; byte_size: number; author_email: string }>();
  if (!row) return new Response('Imagem não encontrada', { status: 404 });
  const role = await getTeamRole(user.email);
  const participant = await env.DB.prepare('SELECT 1 FROM round_participants p JOIN test_items i ON i.round_id=p.round_id JOIN test_item_attachments a ON a.item_id=i.id WHERE a.id=? AND lower(p.user_email)=lower(?)').bind(id, user.email).first();
  const allowed = role === 'manager' || row.author_email.toLowerCase() === user.email.toLowerCase() || Boolean(participant);
  if (!allowed) return new Response('Sem permissão', { status: 403 });
  const object = await env.FILES.get(row.object_key, 'arrayBuffer');
  if (!object) return new Response('Imagem não encontrada', { status: 404 });
  const headers = new Headers({ 'content-type': row.content_type, 'content-length': String(row.byte_size), 'cache-control': 'private, max-age=300' });
  return new Response(object, { headers });
}
